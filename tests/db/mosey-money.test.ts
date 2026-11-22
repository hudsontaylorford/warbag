import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, grantItem, type Actor } from "@/lib/access";
import { InputError } from "@/lib/errors";
import { createTrip, createTripLink, setTripMembers, tripByLink, tripSharing } from "@/lib/mosey/trips";
import {
  addExpense,
  addPayment,
  addPerson,
  deleteExpense,
  deletePayment,
  freezeStatement,
  ledger,
  moneyLog,
  removePerson,
  setSettle,
  statements,
  updateExpense,
  updatePerson,
} from "@/lib/mosey/ledger";
import { pool } from "@/lib/db";

// Made-up people only.
let org: Actor, mem: Actor, viewer: Actor, outsider: Actor;
let tripId: string;
let ann: string, ben: string, cal: string;

const net = async (id: string) => (await ledger(org, tripId)).units.find((u) => u.members.includes(id))!.net;

describeDb("Mosey money", () => {
  beforeEach(async () => {
    org = await makeUser({ isAdmin: true });
    mem = await makeUser();
    viewer = await makeUser();
    outsider = await makeUser();
    tripId = await createTrip(org, { name: "Test trip", start: "2027-06-05", end: "2027-06-07" });
    await setTripMembers(org, tripId, { groupIds: [], userIds: [mem.id] });
    await grantItem(org, { app: "mosey", type: "trip", id: tripId, ownerId: org.id }, { userId: viewer.id }, "view");
    ann = await addPerson(org, tripId, { name: "Ann", userId: org.id });
    ben = await addPerson(org, tripId, { name: "Ben", userId: mem.id });
    cal = await addPerson(org, tripId, { name: "Cal" });
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("only members see money; viewers, view links and outsiders never do", async () => {
    expect((await ledger(mem, tripId)).me).toBe(ben);
    await expect(ledger(viewer, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(ledger(outsider, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(addExpense(viewer, tripId, { description: "x", amount: "1", spentOn: "2027-06-05", paidBy: ann, participants: [ann] })).rejects.toBeInstanceOf(AccessDenied);
    await addExpense(org, tripId, { description: "Groceries", amount: "90", spentOn: "2027-06-05", paidBy: ann, participants: [ann, ben, cal] });
    await createTripLink(org, tripId);
    const [link] = (await tripSharing(org, tripId)).links;
    const seen = JSON.stringify(await tripByLink(link.token));
    expect(seen).not.toContain("Groceries");
    expect(seen).not.toContain("9000");
  });

  it("three split $120; one already paid the payer $40", async () => {
    await addExpense(mem, tripId, { description: "Dinner", amount: "120.00", spentOn: "2027-06-06", paidBy: ann, participants: [ann, ben, cal] });
    await addPayment(mem, tripId, { from: cal, to: ann, amount: "40", paidOn: "2027-06-06", note: "My share" });
    const l = await ledger(org, tripId);
    expect(l.balances.map((b) => [b.share, b.net])).toEqual([
      [4000, 4000],
      [4000, -4000],
      [4000, 0],
    ]);
    expect(l.plan).toEqual([{ from: ben, to: ann, amountCents: 4000 }]);
  });

  it("refuses an expense with nobody to split with, an unknown payer, or a bad amount", async () => {
    const base = { description: "Gas", amount: "40", spentOn: "2027-06-05", paidBy: ann, participants: [ann] };
    await expect(addExpense(org, tripId, { ...base, participants: [] })).rejects.toThrow(/split with/);
    await expect(addExpense(org, tripId, { ...base, paidBy: "" })).rejects.toThrow(/who paid/);
    await expect(addExpense(org, tripId, { ...base, paidBy: crypto.randomUUID() })).rejects.toBeInstanceOf(InputError);
    for (const amount of ["0", "-5", "abc", "1.234"]) await expect(addExpense(org, tripId, { ...base, amount })).rejects.toBeInstanceOf(InputError);
    // Someone from another trip can't be used.
    const other = await createTrip(org, { name: "Other", start: "2027-07-01", end: "2027-07-02" });
    const zed = await addPerson(org, other, { name: "Zed" });
    await expect(addExpense(org, tripId, { ...base, participants: [zed] })).rejects.toThrow(/isn't on this trip/);
  });

  it("members change only their own entries; organizers anything, and it's all logged", async () => {
    const mine = await addExpense(mem, tripId, { description: "Ice", amount: "10", spentOn: "2027-06-05", paidBy: ben, participants: [ann, ben] });
    const his = await addExpense(org, tripId, { description: "Rent", amount: "300", spentOn: "2027-06-05", paidBy: ann, participants: [ann, ben, cal] });
    await expect(updateExpense(mem, his, { description: "Hijack", amount: "1", spentOn: "2027-06-05", paidBy: ben, participants: [ben] })).rejects.toBeInstanceOf(AccessDenied);
    await expect(deleteExpense(mem, his)).rejects.toBeInstanceOf(AccessDenied);
    await updateExpense(mem, mine, { description: "Ice and cups", amount: "12", spentOn: "2027-06-05", paidBy: ben, participants: [ann, ben] });
    await updateExpense(org, mine, { description: "Ice and cups", amount: "12.50", spentOn: "2027-06-05", paidBy: ben, participants: [ann, ben] });
    await deleteExpense(org, his);
    const l = await ledger(org, tripId);
    expect(l.expenses.map((e) => [e.description, e.totalCents])).toEqual([["Ice and cups", 1250]]);
    const log = await moneyLog(mem, tripId);
    expect(log.map((e) => e.action)).toEqual(["expense.delete", "expense.update", "expense.update", "expense.add", "expense.add", "person.add", "person.add", "person.add"]);
    const rows = await admin.query("select before, after from mosey_money_log where action = 'expense.update' and target_id = $1 order by id", [mine]);
    expect(rows.rows[0].before.total_cents).toBe(1000);
    expect(rows.rows[1].after.totalCents).toBe(1250);
    // The deleted expense is kept, marked deleted.
    expect((await admin.query("select deleted_at from mosey_expenses where id = $1", [his])).rows[0].deleted_at).not.toBeNull();
  });

  it("couples settle as one; Direct and Through give the same balances", async () => {
    await updatePerson(org, tripId, ann, { name: "Ann", userId: org.id, household: "Ann + Ben" });
    await updatePerson(org, tripId, ben, { name: "Ben", userId: mem.id, household: "ann + ben" }); // same household, any case
    await addExpense(org, tripId, { description: "Cabin", amount: "300", spentOn: "2027-06-05", paidBy: cal, participants: [ann, ben, cal] });
    let l = await ledger(org, tripId);
    expect(l.units.map((u) => [u.name, u.net])).toEqual([
      ["Ann + Ben", -20000],
      ["Cal", 20000],
    ]);
    expect(l.plan).toEqual([{ from: l.units[0].id, to: cal, amountCents: 20000 }]);
    const before = l.units;
    await setSettle(org, tripId, "through", l.units[0].id);
    l = await ledger(org, tripId);
    expect(l.mode).toBe("through");
    expect(l.units).toEqual(before);
    await expect(setSettle(mem, tripId, "direct", null)).rejects.toBeInstanceOf(AccessDenied);
    await expect(setSettle(org, tripId, "through", ann)).rejects.toBeInstanceOf(InputError); // in a household
  });

  it("freezes statements as versions that later edits never change", async () => {
    await expect(freezeStatement(org, tripId)).rejects.toBeInstanceOf(InputError); // nothing yet
    await addExpense(org, tripId, { description: "Dinner", amount: "90", spentOn: "2027-06-05", paidBy: ann, participants: [ann, ben, cal] });
    expect(await freezeStatement(org, tripId)).toBe(1);
    await addExpense(org, tripId, { description: "Lunch", amount: "30", spentOn: "2027-06-06", paidBy: ben, participants: [ann, ben, cal] });
    expect(await freezeStatement(org, tripId)).toBe(2);
    await expect(freezeStatement(mem, tripId)).rejects.toBeInstanceOf(AccessDenied);
    const [v2, v1] = await statements(mem, tripId);
    expect(v1.spentCents).toBe(9000);
    expect(v2.spentCents).toBe(12000);
    expect(v1.payments.reduce((s, p) => s + p.amountCents, 0)).toBe(6000);
  });

  it("people: only organizers manage them, accounts must be on the trip, used people stay", async () => {
    await expect(addPerson(mem, tripId, { name: "Dee" })).rejects.toBeInstanceOf(AccessDenied);
    await expect(addPerson(org, tripId, { name: "Out", userId: outsider.id })).rejects.toThrow(/on this trip/);
    await expect(addPerson(org, tripId, { name: "Ben again", userId: mem.id })).rejects.toThrow(/already/);
    await addExpense(org, tripId, { description: "Gas", amount: "20", spentOn: "2027-06-05", paidBy: ann, participants: [ann, cal] });
    await expect(removePerson(org, tripId, cal)).rejects.toThrow(/in expenses or payments/);
    const dee = await addPerson(org, tripId, { name: "Dee" });
    await removePerson(org, tripId, dee);
    expect((await ledger(org, tripId)).people.map((p) => p.name)).toEqual(["Ann", "Ben", "Cal"]);
  });

  it("payments: members add and remove their own; they move balances, not splits", async () => {
    await addExpense(org, tripId, { description: "Boat", amount: "60", spentOn: "2027-06-05", paidBy: ann, participants: [ann, ben, cal] });
    const p = await addPayment(mem, tripId, { from: ben, to: ann, amount: "20", paidOn: "2027-06-07" });
    expect(await net(ben)).toBe(0);
    await expect(addPayment(org, tripId, { from: ann, to: ann, amount: "5", paidOn: "2027-06-07" })).rejects.toBeInstanceOf(InputError);
    const other = await addPayment(org, tripId, { from: cal, to: ann, amount: "5", paidOn: "2027-06-07" });
    await expect(deletePayment(mem, other)).rejects.toBeInstanceOf(AccessDenied);
    await deletePayment(mem, p);
    expect(await net(ben)).toBe(-2000);
    expect((await ledger(org, tripId)).balances.map((b) => b.share)).toEqual([2000, 2000, 2000]);
  });
});
