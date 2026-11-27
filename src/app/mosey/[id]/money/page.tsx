import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMosey } from "@/lib/mosey/page";
import { AccessDenied } from "@/lib/access";
import { getTrip } from "@/lib/mosey/trips";
import { ledger, linkableAccounts, moneyLog } from "@/lib/mosey/ledger";
import { dollars } from "@/lib/mosey/money";
import { NotShared } from "../../NotShared";
import { AppHeader } from "@/components/shell/AppHeader";
import { Alert } from "@/components/ui/Alert";
import { TripHeader } from "../../TripParts";
import { ExpenseForm } from "../../ExpenseForm";
import { ExpenseRow, PaymentForm, PaymentRow } from "../../MoneyRows";
import { PeopleManager } from "../../PeopleManager";
import { ReceiptAdd } from "../../ReceiptAdd";
import { receiptsByExpense, receiptsConfigured, unsavedReceipts } from "@/lib/mosey/receipts";

export const metadata: Metadata = { title: "Money · Mosey", robots: { index: false, follow: false } };
// Reading a receipt photo can take a while.
export const maxDuration = 60;

/** Today if it's on the trip, else the trip's first day. */
function defaultDay(start: string, end: string) {
  const today = new Date().toISOString().slice(0, 10);
  return today >= start && today <= end ? today : start;
}

export default async function TripMoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireMosey(`/mosey/${id}/money`, { trip: true });
  const trip = await getTrip(actor, id).catch((err) => {
    if (err instanceof AccessDenied) return null;
    throw err;
  });
  if (!trip) return <NotShared tripId={id} />;
  // Joined by link, on a trip that keeps Money off the link: the plan instead.
  if (!trip.money) redirect(`/mosey/${trip.id}`);
  const l = await ledger(actor, id);
  // Receipt photos need a real sign-in: never for guests who joined by link.
  const photos = receiptsConfigured() && !actor.guest;
  const [accounts, log, receipts, unsaved] = await Promise.all([
    l.organizer ? linkableAccounts(actor, id) : Promise.resolve([]),
    moneyLog(actor, id, 30),
    receiptsByExpense(actor, id),
    photos ? unsavedReceipts(actor, id) : Promise.resolve([]),
  ]);
  const day = defaultDay(trip.startDate, trip.endDate);
  const people = l.people.map((p) => ({ id: p.id, name: p.name, kid: p.kid, householdId: p.householdId }));
  const myUnit = l.me ? l.units.find((u) => u.members.includes(l.me!)) : null;

  return (
    <>
      <AppHeader email={user.email} app="Mosey" letter="M" appHref="/mosey" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
        <TripHeader trip={trip} base={`/mosey/${trip.id}`} current="money" back money />

        {l.problem && <Alert>{l.problem}</Alert>}

        <section className="flex flex-col gap-1 border-t-2 border-ink pt-3">
          {myUnit && !l.problem ? (
            <>
              <p className="heading">
                {myUnit.net < 0 ? `You owe ${dollars(-myUnit.net)}` : myUnit.net > 0 ? `You're owed ${dollars(myUnit.net)}` : "You're all square"}
              </p>
              {myUnit.members.length > 1 && <p className="text-sm text-soft">For your household: {myUnit.name}</p>}
            </>
          ) : (
            <p className="heading">{dollars(l.spentCents)} spent</p>
          )}
          <p className="text-sm text-soft">
            {l.expenses.length} {l.expenses.length === 1 ? "expense" : "expenses"}, {dollars(l.spentCents)} in all.{" "}
            {l.expenses.length > 0 && (
              <Link href={`/mosey/${trip.id}/money/settle`} className="font-semibold text-accent underline-offset-4 hover:underline">
                Settle up ›
              </Link>
            )}
          </p>
        </section>

        {l.people.length === 0 ? (
          <p className="text-soft">
            {l.organizer ? "Add the people on this trip first, below under People." : "The organizer hasn't added the people on this trip yet."}
          </p>
        ) : (
          <section className="flex flex-col gap-3">
            <h2 className="heading">Add an expense</h2>
            {photos && <ReceiptAdd tripId={trip.id} people={people} me={l.me} defaultDay={day} unsaved={unsaved} />}
            <ExpenseForm tripId={trip.id} people={people} me={l.me} defaultDay={day} />
          </section>
        )}

        {l.expenses.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="heading">Expenses</h2>
            <ul className="divide-y divide-line border-y border-line">
              {l.expenses.map((e) => (
                <li key={e.id}>
                  <ExpenseRow e={e} people={people} me={l.me} canEdit={l.organizer || e.mine} defaultDay={day} receiptId={receipts.get(e.id)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {l.people.length > 1 && (
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">
              Payments already made{l.payments.length ? ` (${l.payments.length})` : ""}
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <p className="text-sm text-soft">
                Money someone already sent another person, like paying their share of the rental up front. It counts toward what they owe; it never changes a split.
              </p>
              {l.payments.length > 0 && (
                <ul className="divide-y divide-line border-y border-line">
                  {l.payments.map((p) => (
                    <li key={p.id}>
                      <PaymentRow p={p} people={people} canEdit={l.organizer || p.mine} />
                    </li>
                  ))}
                </ul>
              )}
              <PaymentForm tripId={trip.id} people={people} me={l.me} defaultDay={day} />
            </div>
          </details>
        )}

        {l.organizer && (
          <details open={l.expenses.length === 0}>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">People and households</summary>
            <div className="mt-3">
              <PeopleManager tripId={trip.id} people={l.people} households={l.households} accounts={accounts} />
            </div>
          </details>
        )}

        {log.length > 0 && (
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">Change log</summary>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {log.map((e, i) => (
                <li key={i} className="text-soft">
                  <span className="text-ink">{e.who}</span> {e.summary} ·{" "}
                  {new Date(e.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </>
  );
}
