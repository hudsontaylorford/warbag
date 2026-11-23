/**
 * Mosey's money math. Pure functions: no database, no rounding surprises.
 *
 * - Money is whole cents (integers) everywhere.
 * - Shares are kept exact (as fractions of a cent) across the whole trip and
 *   rounded once per person at the end, largest remainder first, so each
 *   person is within a cent of their true share, people with the same share
 *   differ by at most a cent (only when the cents force it), and the shares
 *   add up to what was spent exactly.
 *   Balances are whole cents, so settle-up never ends a penny off.
 * - Person net = paid + sent - share - received (positive: is owed money).
 * - A transfer is money one person already gave another (e.g. paying their
 *   share of the rental up front). It never changes how an expense is split.
 * - Households (couples who share money) are summed after; people not in a
 *   household are their own unit. Nobody pays someone in their own household.
 * - Settle-up has two styles over the same balances: Direct (debtors pay
 *   creditors, largest first) and Through one person (everyone settles with
 *   one hub). Neither changes any balance.
 */

export type Person = { id: string; name: string; household: string | null };
export type Expense = { id: string; paidBy: string; totalCents: number; participants: string[] };
export type Transfer = { id: string; from: string; to: string; amountCents: number };

export class MoneyError extends Error {}

export type PersonBalance = {
  id: string;
  paid: number;
  share: number;
  sent: number;
  received: number;
  net: number;
};

export type Unit = {
  /** The household id, or the person's id when they're on their own. */
  id: string;
  name: string;
  members: string[];
  net: number;
};

export type Payment = { from: string; to: string; amountCents: number };

function checkCents(n: number, what: string) {
  if (!Number.isSafeInteger(n) || n <= 0) throw new MoneyError(`${what} must be a positive amount in cents.`);
}

/**
 * One expense split into whole cents that add up to it exactly (leftover
 * cents to the first people listed). For showing a single expense; trip
 * balances use `shares`, which rounds once over the whole trip.
 */
export function allocate(expense: Expense, people: Map<string, Person>): Map<string, number> {
  checkCents(expense.totalCents, "An expense");
  if (!people.has(expense.paidBy)) throw new MoneyError("Pick who paid.");
  const parts = [...new Set(expense.participants)];
  if (parts.length === 0) throw new MoneyError("Pick who it's split with (at least one person).");
  for (const p of parts) if (!people.has(p)) throw new MoneyError("Someone in the split isn't on this trip.");
  const base = Math.floor(expense.totalCents / parts.length);
  const extra = expense.totalCents - base * parts.length;
  return new Map(parts.map((p, i) => [p, base + (i < extra ? 1 : 0)]));
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Each person's total share in whole cents: summed exactly, then rounded
 * once, largest remainder first (ties in the order people are listed).
 */
export function shares(people: Person[], expenses: Expense[]): Map<string, number> {
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const e of expenses) allocate(e, byId); // validates
  const counts = expenses.map((e) => BigInt(new Set(e.participants).size));
  const L = counts.reduce((l, n) => (l * n) / gcd(l, n), BigInt(1));
  const exact = new Map(people.map((p) => [p.id, BigInt(0)])); // in 1/L cents
  let total = 0;
  expenses.forEach((e, i) => {
    total += e.totalCents;
    const each = (BigInt(e.totalCents) * L) / counts[i];
    for (const p of new Set(e.participants)) exact.set(p, exact.get(p)! + each);
  });
  const rows = people.map((p, i) => ({ id: p.id, i, floor: exact.get(p.id)! / L, rem: exact.get(p.id)! % L }));
  let left = BigInt(total) - rows.reduce((s, r) => s + r.floor, BigInt(0));
  for (const r of [...rows].sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.i - b.i))) {
    if (left <= 0) break;
    if (r.rem === BigInt(0)) continue;
    r.floor += BigInt(1);
    left -= BigInt(1);
  }
  return new Map(rows.map((r) => [r.id, Number(r.floor)]));
}

/** Everyone's paid, share, transfers and net. */
export function balances(people: Person[], expenses: Expense[], transfers: Transfer[] = []): PersonBalance[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const b = new Map(people.map((p) => [p.id, { id: p.id, paid: 0, share: 0, sent: 0, received: 0, net: 0 }]));
  for (const [p, cents] of shares(people, expenses)) b.get(p)!.share = cents;
  for (const e of expenses) b.get(e.paidBy)!.paid += e.totalCents;
  for (const t of transfers) {
    checkCents(t.amountCents, "A payment");
    if (!byId.has(t.from) || !byId.has(t.to)) throw new MoneyError("A payment involves someone not on this trip.");
    if (t.from === t.to) throw new MoneyError("A payment needs two different people.");
    b.get(t.from)!.sent += t.amountCents;
    b.get(t.to)!.received += t.amountCents;
  }
  const out = [...b.values()];
  for (const x of out) x.net = x.paid + x.sent - x.share - x.received;
  const total = out.reduce((s, x) => s + x.net, 0);
  // Cannot happen with whole-cent shares; checked so a bug can't hide.
  if (total !== 0) throw new Error(`Balances don't add up to zero (${total} cents).`);
  return out;
}

/** People grouped into households; anyone not in one stands alone. */
export function units(people: Person[], nets: PersonBalance[], householdNames: Map<string, string> = new Map()): Unit[] {
  const net = new Map(nets.map((n) => [n.id, n.net]));
  const out = new Map<string, Unit>();
  for (const p of people) {
    const id = p.household ?? p.id;
    const u = out.get(id) ?? { id, name: p.household ? (householdNames.get(p.household) ?? "") : p.name, members: [], net: 0 };
    u.members.push(p.id);
    u.net += net.get(p.id) ?? 0;
    out.set(id, u);
  }
  for (const u of out.values()) {
    if (!u.name) u.name = u.members.map((m) => people.find((p) => p.id === m)!.name).join(" + ");
  }
  return [...out.values()];
}

const byAmountThenId = (a: { amt: number; id: string }, b: { amt: number; id: string }) => b.amt - a.amt || a.id.localeCompare(b.id);

/**
 * Direct: the largest debtor pays the largest creditor, repeatedly. Usually
 * few payments; not guaranteed to be the fewest possible.
 */
export function settleDirect(us: Unit[]): Payment[] {
  const debt = us.filter((u) => u.net < 0).map((u) => ({ id: u.id, amt: -u.net }));
  const cred = us.filter((u) => u.net > 0).map((u) => ({ id: u.id, amt: u.net }));
  const out: Payment[] = [];
  while (debt.length && cred.length) {
    debt.sort(byAmountThenId);
    cred.sort(byAmountThenId);
    const d = debt[0];
    const c = cred[0];
    const amt = Math.min(d.amt, c.amt);
    out.push({ from: d.id, to: c.id, amountCents: amt });
    d.amt -= amt;
    c.amt -= amt;
    if (d.amt === 0) debt.shift();
    if (c.amt === 0) cred.shift();
  }
  return out;
}

/** Through one person (or household): everyone who owes pays the hub; the hub pays everyone owed. */
export function settleThrough(us: Unit[], hubId: string): Payment[] {
  if (!us.some((u) => u.id === hubId)) throw new MoneyError("Pick who collects and pays out.");
  const out: Payment[] = [];
  for (const u of [...us].sort((a, b) => a.net - b.net || a.id.localeCompare(b.id))) {
    if (u.id === hubId || u.net === 0) continue;
    out.push(u.net < 0 ? { from: u.id, to: hubId, amountCents: -u.net } : { from: hubId, to: u.id, amountCents: u.net });
  }
  return out;
}

/** True when the payments leave every unit at exactly zero. */
export function settles(us: Unit[], payments: Payment[]): boolean {
  const left = new Map(us.map((u) => [u.id, u.net]));
  for (const p of payments) {
    if (p.from === p.to || p.amountCents <= 0) return false;
    left.set(p.from, (left.get(p.from) ?? NaN) + p.amountCents);
    left.set(p.to, (left.get(p.to) ?? NaN) - p.amountCents);
  }
  return [...left.values()].every((v) => v === 0);
}

/** "$1,211.41" from 121141. */
export function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
}

/** 121141 from "1,211.41" or "$1211.4". Null when it isn't a plain amount. */
export function parseDollars(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
