import { describe, expect, it } from "vitest";
import {
  allocate,
  balances,
  dollars,
  MoneyError,
  parseDollars,
  settleDirect,
  settles,
  settleThrough,
  shares,
  units,
  type Expense,
  type Person,
  type Transfer,
} from "@/lib/mosey/money";

// Made-up people only.
const person = (id: string, household: string | null = null): Person => ({ id, name: id[0].toUpperCase() + id.slice(1), household });
const exp = (id: string, paidBy: string, totalCents: number, participants: string[]): Expense => ({ id, paidBy, totalCents, participants });
const net = (b: ReturnType<typeof balances>, id: string) => b.find((x) => x.id === id)!.net;

describe("splitting", () => {
  it("splits into whole cents that add up exactly, leftover cents to the first people", () => {
    const people = new Map(["ann", "ben", "cal"].map((p) => [p, person(p)]));
    const s = allocate(exp("e", "ann", 10000, ["ann", "ben", "cal"]), people);
    expect([...s.values()]).toEqual([3334, 3333, 3333]);
    expect([...s.values()].reduce((a, b) => a + b)).toBe(10000);
    expect([...allocate(exp("e", "ann", 2, ["ann", "ben", "cal"]), people).values()]).toEqual([1, 1, 0]);
  });

  it("refuses an expense nobody shares, an unknown payer, or a bad amount", () => {
    const people = new Map(["ann", "ben"].map((p) => [p, person(p)]));
    expect(() => allocate(exp("e", "ann", 40000, []), people)).toThrow(MoneyError);
    expect(() => allocate(exp("e", "zed", 100, ["ann"]), people)).toThrow(/who paid/);
    expect(() => allocate(exp("e", "ann", 100, ["ann", "zed"]), people)).toThrow(/isn't on this trip/);
    for (const bad of [0, -5, 1.5, Number.NaN]) expect(() => allocate(exp("e", "ann", bad, ["ann"]), people)).toThrow(MoneyError);
  });

  it("counts someone in a split only once", () => {
    const people = new Map(["ann", "ben"].map((p) => [p, person(p)]));
    expect([...allocate(exp("e", "ann", 100, ["ann", "ben", "ben"]), people).values()]).toEqual([50, 50]);
  });
});

describe("balances", () => {
  it("three split $120; one already paid the payer their $40", () => {
    const people = [person("ann"), person("ben"), person("cal")];
    const b = balances(people, [exp("e", "ann", 12000, ["ann", "ben", "cal"])], [{ id: "t", from: "cal", to: "ann", amountCents: 4000 }]);
    // Everyone still has a $40 share; the payment doesn't change the split.
    expect(b.map((x) => x.share)).toEqual([4000, 4000, 4000]);
    expect(net(b, "ann")).toBe(4000); // still owed $40
    expect(net(b, "ben")).toBe(-4000); // owes $40
    expect(net(b, "cal")).toBe(0); // all square
    expect(b.reduce((s, x) => s + x.net, 0)).toBe(0);
  });

  it("the payer not sharing an expense is owed all of it", () => {
    const b = balances([person("ann"), person("ben"), person("cal")], [exp("e", "ann", 60000, ["ben", "cal"])]);
    expect([net(b, "ann"), net(b, "ben"), net(b, "cal")]).toEqual([60000, -30000, -30000]);
  });

  it("rounds once per trip: everyone within a cent, equal shares at most a cent apart, totals exact", () => {
    const people = [person("ann"), person("ben"), person("cal")];
    // Seven $1 splits three ways: exactly $2.3333... each.
    const expenses = Array.from({ length: 7 }, (_, i) => exp(`e${i}`, "ann", 100, ["ann", "ben", "cal"]));
    const s = shares(people, expenses);
    expect([...s.values()].reduce((a, b) => a + b)).toBe(700);
    expect([...s.values()].sort()).toEqual([233, 233, 234]);
    // Identical shares come out the same when the cents allow it.
    const four = [person("ann"), person("ben"), person("cal"), person("dee")];
    const ex2 = Array.from({ length: 9 }, (_, i) => exp(`e${i}`, "ann", 1001, ["ann", "ben", "cal"]));
    const s2 = shares(four, [...ex2, exp("x", "dee", 1, ["dee"])]);
    expect(s2.get("ben")).toBe(s2.get("cal"));
  });

  it("refuses odd transfers", () => {
    const people = [person("ann"), person("ben")];
    const t = (x: Partial<Transfer>): Transfer => ({ id: "t", from: "ann", to: "ben", amountCents: 100, ...x });
    expect(() => balances(people, [], [t({ to: "ann" })])).toThrow(MoneyError);
    expect(() => balances(people, [], [t({ to: "zed" })])).toThrow(MoneyError);
    expect(() => balances(people, [], [t({ amountCents: 0 })])).toThrow(MoneyError);
  });
});

describe("households", () => {
  const people = [person("ann", "h1"), person("ben", "h1"), person("cal"), person("dee")];
  const expenses = [exp("e1", "ann", 40000, ["ann", "ben", "cal", "dee"]), exp("e2", "cal", 8000, ["ann", "ben", "cal", "dee"])];

  it("a couple settles as one; two people on their own never combine", () => {
    const us = units(people, balances(people, expenses));
    expect(us.map((u) => [u.id, u.members, u.net])).toEqual([
      ["h1", ["ann", "ben"], 16000],
      ["cal", ["cal"], -4000],
      ["dee", ["dee"], -12000],
    ]);
    expect(us.find((u) => u.id === "h1")!.name).toBe("Ann + Ben");
    expect(units(people, balances(people, expenses), new Map([["h1", "The As"]]))[0].name).toBe("The As");
  });

  it("Direct and Through one person settle the same balances, never within a household", () => {
    const us = units(people, balances(people, expenses));
    const direct = settleDirect(us);
    const hub = settleThrough(us, "cal");
    expect(settles(us, direct)).toBe(true);
    expect(settles(us, hub)).toBe(true);
    for (const p of [...direct, ...hub]) expect(p.from).not.toBe(p.to);
    expect(direct).toEqual([
      { from: "dee", to: "h1", amountCents: 12000 },
      { from: "cal", to: "h1", amountCents: 4000 },
    ]);
    // Through Cal: Dee pays Cal, Cal pays the household.
    expect(hub).toEqual([
      { from: "dee", to: "cal", amountCents: 12000 },
      { from: "cal", to: "h1", amountCents: 16000 },
    ]);
    expect(() => settleThrough(us, "zed")).toThrow(MoneyError);
    // Choosing a style doesn't touch the balances.
    expect(units(people, balances(people, expenses))).toEqual(us);
  });
});

describe("randomized ledgers", () => {
  // A small seeded generator so failures are reproducible.
  function rng(seed: number) {
    return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  }

  it("always nets to zero and both styles always settle, with no zero or self payments", () => {
    const r = rng(7);
    for (let trial = 0; trial < 300; trial++) {
      const n = 2 + Math.floor(r() * 10);
      const people = Array.from({ length: n }, (_, i) => person(`p${i}`, r() < 0.4 ? `h${Math.floor(r() * 3)}` : null));
      const ids = people.map((p) => p.id);
      const expenses = Array.from({ length: 1 + Math.floor(r() * 15) }, (_, i) => {
        const parts = ids.filter(() => r() < 0.7);
        return exp(`e${i}`, ids[Math.floor(r() * n)], 1 + Math.floor(r() * 500000), parts.length ? parts : [ids[0]]);
      });
      const transfers: Transfer[] = r() < 0.5 ? [{ id: "t", from: ids[0], to: ids[n - 1], amountCents: 1 + Math.floor(r() * 50000) }] : [];
      const b = balances(people, expenses, transfers);
      expect(b.reduce((s, x) => s + x.net, 0)).toBe(0);
      const us = units(people, b);
      expect(us.reduce((s, u) => s + u.net, 0)).toBe(0);
      const direct = settleDirect(us);
      expect(settles(us, direct)).toBe(true);
      expect(direct.length).toBeLessThanOrEqual(Math.max(0, us.filter((u) => u.net !== 0).length - 1));
      const hub = settleThrough(us, us[Math.floor(r() * us.length)].id);
      expect(settles(us, hub)).toBe(true);
      // Same inputs, same answer.
      expect(settleDirect(units(people, balances(people, expenses, transfers)))).toEqual(direct);
    }
  });
});

describe("dollars", () => {
  it("formats and parses plain amounts", () => {
    expect(dollars(121141)).toBe("$1,211.41");
    expect(dollars(5)).toBe("$0.05");
    expect(dollars(-1500)).toBe("-$15.00");
    expect(parseDollars("$1,211.41")).toBe(121141);
    expect(parseDollars("40")).toBe(4000);
    expect(parseDollars("40.5")).toBe(4050);
    for (const bad of ["", "abc", "1.234", "-5", "1e3", "12345678"]) expect(parseDollars(bad)).toBeNull();
  });
});
