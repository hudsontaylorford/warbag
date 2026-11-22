import "server-only";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { InputError } from "../errors";
import { AccessDenied, listItemGrants, type Actor } from "../access";
import { parseDay, tripWithRole } from "./trips";
import {
  balances,
  MoneyError,
  parseDollars,
  settleDirect,
  settles,
  settleThrough,
  units,
  type Expense,
  type Payment,
  type Person,
  type PersonBalance,
  type Transfer,
  type Unit,
} from "./money";

/**
 * A trip's money. Members (contribute) and organizers (manage) only: view
 * links and view grants never see any of it. Members add expenses and
 * payments and change their own; organizers change anything and set up
 * people, households and how the trip settles. Every change is logged.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CENTS = 100_000_000;

export type TripPerson = { id: string; name: string; userId: string | null; householdId: string | null; you: boolean };
export type Household = { id: string; name: string };
export type ExpenseRow = {
  id: string;
  description: string;
  spentOn: string;
  totalCents: number;
  paidBy: string;
  participants: string[];
  notes: string;
  mine: boolean;
};
export type PaymentRow = { id: string; from: string; to: string; amountCents: number; paidOn: string; note: string; mine: boolean };
export type SettleMode = "direct" | "through";

export type Ledger = {
  tripId: string;
  organizer: boolean;
  people: TripPerson[];
  households: Household[];
  expenses: ExpenseRow[];
  payments: PaymentRow[];
  mode: SettleMode;
  hub: string | null;
  /** The trip person linked to the viewer's account, if any. */
  me: string | null;
  balances: PersonBalance[];
  units: Unit[];
  plan: Payment[];
  spentCents: number;
  /** Set when the figures can't be computed (e.g. a broken row); shown, never hidden. */
  problem: string | null;
};

async function member(actor: Actor, tripId: string) {
  const { trip, role } = await tripWithRole(actor, tripId, "contribute");
  return { trip, organizer: role === "manage" };
}

async function organizer(actor: Actor, tripId: string) {
  const { trip, organizer: isOrg } = await member(actor, tripId);
  if (!isOrg) throw new AccessDenied();
  return trip;
}

async function log(db: Pick<PoolClient, "query">, tripId: string, actor: Actor, action: string, target: string | null, before: unknown, after: unknown) {
  await db.query(
    `insert into mosey_money_log (trip_id, actor_id, action, target_id, before, after) values ($1, $2, $3, $4, $5, $6)`,
    [tripId, actor.id, action, target, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after)],
  );
}

async function inTx<T>(work: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const out = await work(c);
    await c.query("commit");
    return out;
  } catch (err) {
    await c.query("rollback");
    throw err;
  } finally {
    c.release();
  }
}

// ------------------------------------------------------------ reading

export async function ledger(actor: Actor, tripId: string): Promise<Ledger> {
  const { trip, organizer: isOrg } = await member(actor, tripId);
  const people = (
    await pool.query<{ id: string; name: string; user_id: string | null; household_id: string | null }>(
      "select id, name, user_id, household_id from mosey_people where trip_id = $1 order by position, created_at",
      [trip.id],
    )
  ).rows.map((r) => ({ id: r.id, name: r.name, userId: r.user_id, householdId: r.household_id, you: r.user_id === actor.id }));
  const households = (
    await pool.query<Household>("select id, name from mosey_households where trip_id = $1 order by lower(name)", [trip.id])
  ).rows;
  const ex = await pool.query<{
    id: string;
    description: string;
    spent_on: string;
    total_cents: string;
    paid_by: string;
    notes: string;
    created_by: string | null;
    participants: string[];
  }>(
    `select e.id, e.description, to_char(e.spent_on, 'YYYY-MM-DD') as spent_on, e.total_cents, e.paid_by, e.notes, e.created_by,
       array(select ep.person_id::text from mosey_expense_people ep join mosey_people p on p.id = ep.person_id
             where ep.expense_id = e.id order by p.position, p.created_at) as participants
     from mosey_expenses e where e.trip_id = $1 and e.deleted_at is null
     order by e.spent_on, e.created_at`,
    [trip.id],
  );
  const expenses: ExpenseRow[] = ex.rows.map((r) => ({
    id: r.id,
    description: r.description,
    spentOn: r.spent_on,
    totalCents: Number(r.total_cents),
    paidBy: r.paid_by,
    participants: r.participants,
    notes: r.notes,
    mine: r.created_by === actor.id,
  }));
  const payments: PaymentRow[] = (
    await pool.query<{ id: string; from_person: string; to_person: string; amount_cents: string; paid_on: string; note: string; created_by: string | null }>(
      `select id, from_person, to_person, amount_cents, to_char(paid_on, 'YYYY-MM-DD') as paid_on, note, created_by
       from mosey_payments where trip_id = $1 and deleted_at is null order by paid_on, created_at`,
      [trip.id],
    )
  ).rows.map((r) => ({ id: r.id, from: r.from_person, to: r.to_person, amountCents: Number(r.amount_cents), paidOn: r.paid_on, note: r.note, mine: r.created_by === actor.id }));
  const s = (await pool.query<{ mode: SettleMode; hub: string | null }>("select mode, hub from mosey_settle where trip_id = $1", [trip.id])).rows[0];
  let mode: SettleMode = s?.mode ?? "direct";
  let hub = s?.hub ?? null;

  const mp: Person[] = people.map((p) => ({ id: p.id, name: p.name, household: p.householdId }));
  let bal: PersonBalance[] = [];
  let us: Unit[] = [];
  let plan: Payment[] = [];
  let problem: string | null = null;
  try {
    bal = balances(
      mp,
      expenses.map((e): Expense => ({ id: e.id, paidBy: e.paidBy, totalCents: e.totalCents, participants: e.participants })),
      payments.map((p): Transfer => ({ id: p.id, from: p.from, to: p.to, amountCents: p.amountCents })),
    );
    us = units(mp, bal, new Map(households.map((h) => [h.id, h.name])));
    // If the chosen hub no longer stands alone (e.g. joined a household), say Direct rather than pretend.
    if (mode === "through" && !(hub && us.some((u) => u.id === hub))) {
      mode = "direct";
      hub = null;
    }
    plan = mode === "through" ? settleThrough(us, hub!) : settleDirect(us);
    if (!settles(us, plan)) throw new Error("Settle-up doesn't balance.");
  } catch (err) {
    problem = err instanceof MoneyError ? err.message : "These numbers don't add up. Nothing is lost; tell Hudson.";
    if (!(err instanceof MoneyError)) console.error("mosey ledger", err);
  }
  return {
    tripId: trip.id,
    organizer: isOrg,
    people,
    households,
    expenses,
    payments,
    mode,
    hub,
    me: people.find((p) => p.you)?.id ?? null,
    balances: bal,
    units: us,
    plan,
    spentCents: expenses.reduce((sum, e) => sum + e.totalCents, 0),
    problem,
  };
}

// ------------------------------------------------------------ people and households

function cleanName(raw: string, what = "A name"): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) throw new InputError(`${what} can't be empty.`);
  if (s.length > 80) throw new InputError(`${what} is at most 80 characters.`);
  return s;
}

/** Accounts an organizer may link people to: the trip's members (and themselves). */
export async function linkableAccounts(actor: Actor, tripId: string): Promise<{ id: string; name: string }[]> {
  const trip = await organizer(actor, tripId);
  const grants = await listItemGrants(actor, { app: "mosey", type: "trip", id: trip.id, ownerId: trip.owner_id });
  const groupIds = grants.filter((g) => g.groupId).map((g) => g.groupId!);
  const userIds = grants.filter((g) => g.userId).map((g) => g.userId!);
  const { rows } = await pool.query<{ id: string; name: string; email: string }>(
    `select distinct u.id, u.name, u.email from "user" u
     where u.id = $1 or u.id = any($2::text[])
        or u.id in (select user_id from group_members where group_id = any($3::uuid[]))
     order by 1`,
    [trip.owner_id, userIds, groupIds],
  );
  return rows.map((r) => ({ id: r.id, name: r.name?.trim() || r.email.split("@")[0] }));
}

/** Adds someone to the trip's money, by name, optionally linked to an account on the trip. */
export async function addPerson(actor: Actor, tripId: string, input: { name: string; userId?: string; household?: string }): Promise<string> {
  const trip = await organizer(actor, tripId);
  const name = cleanName(input.name);
  if (input.userId && !(await linkableAccounts(actor, tripId)).some((a) => a.id === input.userId)) {
    throw new InputError("Link only someone who's on this trip.");
  }
  return inTx(async (c) => {
    const householdId = input.household?.trim() ? await householdId_(c, trip.id, input.household) : null;
    const { rows } = await c.query<{ id: string }>(
      `insert into mosey_people (trip_id, name, user_id, household_id, position)
       values ($1, $2, $3, $4, coalesce((select max(position) + 1 from mosey_people where trip_id = $1), 0)) returning id`,
      [trip.id, name, input.userId || null, householdId],
    ).catch((err) => {
      if (err?.code === "23505") throw new InputError("That account is already on this trip's money.");
      throw err;
    });
    await log(c, trip.id, actor, "person.add", rows[0].id, null, { name, userId: input.userId || null, householdId });
    return rows[0].id;
  });
}

/** A household by name in this trip, made if needed. */
async function householdId_(c: PoolClient, tripId: string, raw: string): Promise<string> {
  const name = cleanName(raw, "A household name");
  const found = await c.query<{ id: string }>("select id from mosey_households where trip_id = $1 and lower(name) = lower($2)", [tripId, name]);
  if (found.rows[0]) return found.rows[0].id;
  return (await c.query<{ id: string }>("insert into mosey_households (trip_id, name) values ($1, $2) returning id", [tripId, name])).rows[0].id;
}

async function personIn(c: Pick<PoolClient, "query">, tripId: string, personId: string) {
  if (!UUID.test(personId)) throw new AccessDenied();
  const { rows } = await c.query<{ id: string; name: string; user_id: string | null; household_id: string | null }>(
    "select id, name, user_id, household_id from mosey_people where id = $1 and trip_id = $2",
    [personId, tripId],
  );
  if (!rows[0]) throw new AccessDenied();
  return rows[0];
}

/**
 * Changes someone's name, linked account or household (empty = on their
 * own). Balances are recomputed from the expenses; the statement shows the
 * change only once someone freezes a new version.
 */
export async function updatePerson(
  actor: Actor,
  tripId: string,
  personId: string,
  input: { name: string; userId?: string; household?: string },
): Promise<void> {
  const trip = await organizer(actor, tripId);
  const name = cleanName(input.name);
  if (input.userId && !(await linkableAccounts(actor, tripId)).some((a) => a.id === input.userId)) {
    throw new InputError("Link only someone who's on this trip.");
  }
  await inTx(async (c) => {
    const before = await personIn(c, trip.id, personId);
    const householdId = input.household?.trim() ? await householdId_(c, trip.id, input.household) : null;
    await c.query("update mosey_people set name = $2, user_id = $3, household_id = $4 where id = $1", [personId, name, input.userId || null, householdId]).catch(
      (err) => {
        if (err?.code === "23505") throw new InputError("That account is already linked to someone else on this trip.");
        throw err;
      },
    );
    // Households nobody is in anymore go away.
    await c.query("delete from mosey_households h where trip_id = $1 and not exists (select 1 from mosey_people p where p.household_id = h.id)", [trip.id]);
    await log(c, trip.id, actor, "person.update", personId, before, { name, userId: input.userId || null, householdId });
  });
}

/** Removes someone who isn't in any expense or payment. */
export async function removePerson(actor: Actor, tripId: string, personId: string): Promise<void> {
  const trip = await organizer(actor, tripId);
  await inTx(async (c) => {
    const before = await personIn(c, trip.id, personId);
    const used = await c.query(
      `select 1 from mosey_expenses e where e.paid_by = $1 and e.deleted_at is null
       union all select 1 from mosey_expense_people ep join mosey_expenses e on e.id = ep.expense_id where ep.person_id = $1 and e.deleted_at is null
       union all select 1 from mosey_payments where (from_person = $1 or to_person = $1) and deleted_at is null limit 1`,
      [personId],
    );
    if (used.rowCount) throw new InputError(`${before.name} is in expenses or payments. Take them out of those first.`);
    // Deleted rows still point at them; keep the person if so (hidden from nothing, just unused).
    const old = await c.query(
      `select 1 from mosey_expenses where paid_by = $1 union all select 1 from mosey_expense_people where person_id = $1
       union all select 1 from mosey_payments where from_person = $1 or to_person = $1 limit 1`,
      [personId],
    );
    if (old.rowCount) throw new InputError(`${before.name} appears in deleted entries kept for the record, so they stay on the list.`);
    await c.query("delete from mosey_people where id = $1", [personId]);
    await c.query("delete from mosey_households h where trip_id = $1 and not exists (select 1 from mosey_people p where p.household_id = h.id)", [trip.id]);
    await log(c, trip.id, actor, "person.remove", personId, before, null);
  });
}

// ------------------------------------------------------------ expenses

type ExpenseInput = { description: string; amount: string; spentOn: string; paidBy: string; participants: string[]; notes?: string };

async function readExpense(c: Pick<PoolClient, "query">, tripId: string, input: ExpenseInput) {
  const description = String(input.description ?? "").trim();
  if (!description) throw new InputError("Say what it was for.");
  if (description.length > 200) throw new InputError("Keep the description under 200 characters.");
  const totalCents = parseDollars(String(input.amount ?? ""));
  if (totalCents === null || totalCents <= 0 || totalCents > MAX_CENTS) throw new InputError("Enter the amount in dollars, like 42.50.");
  const spentOn = parseDay(String(input.spentOn ?? ""));
  if (!spentOn) throw new InputError("Pick the date.");
  const notes = String(input.notes ?? "").trim();
  if (notes.length > 1000) throw new InputError("Notes are at most 1000 characters.");
  if (!input.paidBy) throw new InputError("Pick who paid.");
  await personIn(c, tripId, input.paidBy).catch(() => {
    throw new InputError("Pick who paid.");
  });
  const participants = [...new Set(input.participants)];
  if (participants.length === 0) throw new InputError("Pick who it's split with (at least one person).");
  for (const p of participants) {
    await personIn(c, tripId, p).catch(() => {
      throw new InputError("Someone in the split isn't on this trip.");
    });
  }
  return { description, totalCents, spentOn, notes, paidBy: input.paidBy, participants };
}

export async function addExpense(actor: Actor, tripId: string, input: ExpenseInput): Promise<string> {
  const { trip } = await member(actor, tripId);
  return inTx(async (c) => {
    const e = await readExpense(c, trip.id, input);
    const { rows } = await c.query<{ id: string }>(
      `insert into mosey_expenses (trip_id, description, spent_on, total_cents, paid_by, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [trip.id, e.description, e.spentOn, e.totalCents, e.paidBy, e.notes, actor.id],
    );
    for (const p of e.participants) await c.query("insert into mosey_expense_people (expense_id, person_id) values ($1, $2)", [rows[0].id, p]);
    await log(c, trip.id, actor, "expense.add", rows[0].id, null, e);
    return rows[0].id;
  });
}

async function expenseFor(c: Pick<PoolClient, "query">, actor: Actor, expenseId: string) {
  if (!UUID.test(expenseId)) throw new AccessDenied();
  const { rows } = await c.query<{ trip_id: string; created_by: string | null; description: string; spent_on: string; total_cents: string; paid_by: string; notes: string }>(
    `select trip_id, created_by, description, to_char(spent_on, 'YYYY-MM-DD') as spent_on, total_cents, paid_by, notes
     from mosey_expenses where id = $1 and deleted_at is null`,
    [expenseId],
  );
  if (!rows[0]) throw new AccessDenied();
  const { trip, organizer: isOrg } = await member(actor, rows[0].trip_id);
  if (!isOrg && rows[0].created_by !== actor.id) throw new AccessDenied();
  const parts = await c.query<{ person_id: string }>("select person_id from mosey_expense_people where expense_id = $1", [expenseId]);
  return { trip, before: { ...rows[0], total_cents: Number(rows[0].total_cents), participants: parts.rows.map((r) => r.person_id) } };
}

/** Changes an expense. The member who added it, or an organizer (logged with who). */
export async function updateExpense(actor: Actor, expenseId: string, input: ExpenseInput): Promise<void> {
  await inTx(async (c) => {
    const { trip, before } = await expenseFor(c, actor, expenseId);
    const e = await readExpense(c, trip.id, input);
    await c.query(
      `update mosey_expenses set description = $2, spent_on = $3, total_cents = $4, paid_by = $5, notes = $6, updated_at = now() where id = $1`,
      [expenseId, e.description, e.spentOn, e.totalCents, e.paidBy, e.notes],
    );
    await c.query("delete from mosey_expense_people where expense_id = $1", [expenseId]);
    for (const p of e.participants) await c.query("insert into mosey_expense_people (expense_id, person_id) values ($1, $2)", [expenseId, p]);
    await log(c, trip.id, actor, "expense.update", expenseId, before, e);
  });
}

/** Removes an expense from the figures. It's kept, marked deleted, for the log. */
export async function deleteExpense(actor: Actor, expenseId: string): Promise<void> {
  await inTx(async (c) => {
    const { trip, before } = await expenseFor(c, actor, expenseId);
    await c.query("update mosey_expenses set deleted_at = now() where id = $1", [expenseId]);
    await log(c, trip.id, actor, "expense.delete", expenseId, before, null);
  });
}

// ------------------------------------------------------------ payments

export async function addPayment(actor: Actor, tripId: string, input: { from: string; to: string; amount: string; paidOn: string; note?: string }): Promise<string> {
  const { trip } = await member(actor, tripId);
  const amountCents = parseDollars(String(input.amount ?? ""));
  if (amountCents === null || amountCents <= 0 || amountCents > MAX_CENTS) throw new InputError("Enter the amount in dollars, like 40.");
  const paidOn = parseDay(String(input.paidOn ?? ""));
  if (!paidOn) throw new InputError("Pick the date.");
  const note = String(input.note ?? "").trim().slice(0, 200);
  if (!input.from || !input.to) throw new InputError("Pick who paid whom.");
  if (input.from === input.to) throw new InputError("Pick two different people.");
  return inTx(async (c) => {
    await personIn(c, trip.id, input.from).catch(() => {
      throw new InputError("Pick who paid.");
    });
    await personIn(c, trip.id, input.to).catch(() => {
      throw new InputError("Pick who they paid.");
    });
    const { rows } = await c.query<{ id: string }>(
      `insert into mosey_payments (trip_id, from_person, to_person, amount_cents, paid_on, note, created_by) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [trip.id, input.from, input.to, amountCents, paidOn, note, actor.id],
    );
    await log(c, trip.id, actor, "payment.add", rows[0].id, null, { from: input.from, to: input.to, amountCents, paidOn, note });
    return rows[0].id;
  });
}

export async function deletePayment(actor: Actor, paymentId: string): Promise<void> {
  if (!UUID.test(paymentId)) throw new AccessDenied();
  await inTx(async (c) => {
    const { rows } = await c.query<{ trip_id: string; created_by: string | null; from_person: string; to_person: string; amount_cents: string }>(
      "select trip_id, created_by, from_person, to_person, amount_cents from mosey_payments where id = $1 and deleted_at is null",
      [paymentId],
    );
    if (!rows[0]) throw new AccessDenied();
    const { organizer: isOrg } = await member(actor, rows[0].trip_id);
    if (!isOrg && rows[0].created_by !== actor.id) throw new AccessDenied();
    await c.query("update mosey_payments set deleted_at = now() where id = $1", [paymentId]);
    await log(c, rows[0].trip_id, actor, "payment.delete", paymentId, rows[0], null);
  });
}

// ------------------------------------------------------------ settle-up

/** Direct, or Through one person (a household id or a person on their own). Organizers only. */
export async function setSettle(actor: Actor, tripId: string, mode: string, hub: string | null): Promise<void> {
  const trip = await organizer(actor, tripId);
  if (mode !== "direct" && mode !== "through") throw new InputError("Pick how to settle.");
  if (mode === "through") {
    if (!hub) throw new InputError("Pick who collects and pays out.");
    const ok = await pool.query(
      `select 1 from mosey_households where id::text = $2 and trip_id = $1
       union all select 1 from mosey_people where id::text = $2 and trip_id = $1 and household_id is null`,
      [trip.id, hub],
    );
    if (!ok.rowCount) throw new InputError("Pick someone on this trip.");
  }
  await pool.query(
    `insert into mosey_settle (trip_id, mode, hub) values ($1, $2, $3)
     on conflict (trip_id) do update set mode = excluded.mode, hub = excluded.hub`,
    [trip.id, mode, mode === "through" ? hub : null],
  );
}

export type Statement = {
  version: number;
  createdAt: string;
  mode: SettleMode;
  hubName: string | null;
  spentCents: number;
  units: { id: string; name: string; members: string[]; paid: number; share: number; sent: number; received: number; net: number }[];
  payments: { from: string; to: string; amountCents: number }[];
};

/** The settle-up as it stands, in the shape a frozen statement keeps. */
export function statementOf(l: Ledger): Omit<Statement, "version" | "createdAt"> {
  const name = new Map(l.people.map((p) => [p.id, p.name]));
  const bal = new Map(l.balances.map((b) => [b.id, b]));
  const unitName = new Map(l.units.map((u) => [u.id, u.name]));
  return {
    mode: l.mode,
    hubName: l.mode === "through" && l.hub ? (unitName.get(l.hub) ?? null) : null,
    spentCents: l.spentCents,
    units: l.units.map((u) => {
      const sum = (k: "paid" | "share" | "sent" | "received") => u.members.reduce((s, m) => s + (bal.get(m)?.[k] ?? 0), 0);
      return { id: u.id, name: u.name, members: u.members.map((m) => name.get(m) ?? ""), paid: sum("paid"), share: sum("share"), sent: sum("sent"), received: sum("received"), net: u.net };
    }),
    payments: l.plan.map((p) => ({ from: unitName.get(p.from) ?? "", to: unitName.get(p.to) ?? "", amountCents: p.amountCents })),
  };
}

/** Saves the current settle-up as the next version. Organizers only; never changed afterwards. */
export async function freezeStatement(actor: Actor, tripId: string): Promise<number> {
  const trip = await organizer(actor, tripId);
  const l = await ledger(actor, trip.id);
  if (l.problem) throw new InputError(l.problem);
  if (l.expenses.length === 0) throw new InputError("Add expenses before freezing a settle-up.");
  const body = statementOf(l);
  return inTx(async (c) => {
    await c.query("select pg_advisory_xact_lock(hashtext($1))", [trip.id]);
    const { rows } = await c.query<{ v: number }>(
      `insert into mosey_statements (trip_id, version, body, created_by)
       values ($1, coalesce((select max(version) + 1 from mosey_statements where trip_id = $1), 1), $2, $3) returning version as v`,
      [trip.id, JSON.stringify(body), actor.id],
    );
    return rows[0].v;
  });
}

export async function statements(actor: Actor, tripId: string): Promise<Statement[]> {
  const { trip } = await member(actor, tripId);
  const { rows } = await pool.query<{ version: number; created_at: Date; body: Omit<Statement, "version" | "createdAt"> }>(
    "select version, created_at, body from mosey_statements where trip_id = $1 order by version desc",
    [trip.id],
  );
  return rows.map((r) => ({ ...r.body, version: r.version, createdAt: r.created_at.toISOString() }));
}

// ------------------------------------------------------------ log

export type LogEntry = { at: string; who: string; action: string; summary: string };

export async function moneyLog(actor: Actor, tripId: string, limit = 50): Promise<LogEntry[]> {
  const { trip } = await member(actor, tripId);
  const { rows } = await pool.query<{ at: Date; name: string | null; email: string | null; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }>(
    `select l.at, u.name, u.email, l.action, l.before, l.after from mosey_money_log l
     left join "user" u on u.id = l.actor_id where l.trip_id = $1 order by l.at desc, l.id desc limit $2`,
    [trip.id, limit],
  );
  const word: Record<string, string> = {
    "expense.add": "added",
    "expense.update": "changed",
    "expense.delete": "deleted",
    "payment.add": "recorded a payment",
    "payment.delete": "deleted a payment",
    "person.add": "added",
    "person.update": "changed",
    "person.remove": "removed",
  };
  return rows.map((r) => {
    const thing = (r.after ?? r.before ?? {}) as { description?: string; name?: string };
    return {
      at: r.at.toISOString(),
      who: r.name?.trim() || (r.email ?? "Someone").split("@")[0],
      action: r.action,
      summary: `${word[r.action] ?? r.action} ${thing.description ?? thing.name ?? ""}`.trim(),
    };
  });
}
