import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMosey } from "@/lib/mosey/page";
import { AccessDenied } from "@/lib/access";
import { getTrip } from "@/lib/mosey/trips";
import { ledger, statementOf, statements, type Statement } from "@/lib/mosey/ledger";
import { dollars } from "@/lib/mosey/money";
import { AppHeader } from "@/components/shell/AppHeader";
import { Alert } from "@/components/ui/Alert";
import { CopyText, FreezeButton, SettleStyle } from "../../../Settle";

export const metadata: Metadata = { title: "Settle up · Mosey", robots: { index: false, follow: false } };

type Body = Omit<Statement, "version" | "createdAt">;

function result(net: number) {
  return net < 0 ? `Pays ${dollars(-net)}` : net > 0 ? `Receives ${dollars(net)}` : "All square";
}

/** Final payments first, then how each was worked out, then a check. */
function StatementView({ s }: { s: Body }) {
  const paidIn = s.payments.reduce((sum, p) => sum + p.amountCents, 0);
  const balanced = s.units.reduce((sum, u) => sum + u.net, 0) === 0;
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="heading">{s.payments.length === 0 ? "Nobody owes anything" : s.payments.length === 1 ? "One payment settles it" : `${s.payments.length} payments settle it`}</h2>
        {s.payments.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {s.payments.map((p, i) => (
              <li key={i} className="flex min-h-14 items-center justify-between gap-4 py-2">
                <span className="min-w-0 break-words">
                  <span className="font-semibold">{p.from}</span> sends <span className="font-semibold">{p.to}</span>
                </span>
                <span className="shrink-0 text-xl font-semibold tabular-nums">{dollars(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
        {s.hubName && <p className="text-sm text-soft">Everyone settles with {s.hubName}. Nobody else needs to send anything.</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="heading">How each amount was worked out</h2>
        <ul className="divide-y divide-line border-y border-line">
          {s.units.map((u) => {
            const credit = u.paid + u.sent;
            return (
              <li key={u.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-semibold break-words">{u.name}</span>
                  <span className={`shrink-0 font-semibold tabular-nums ${u.net < 0 ? "text-red-800" : u.net > 0 ? "text-green-800" : ""}`}>{result(u.net)}</span>
                </div>
                <p className="text-sm text-soft">
                  Share of the costs {dollars(u.share)}
                  {u.paid > 0 && ` · paid for the group ${dollars(u.paid)}`}
                  {u.sent > 0 && ` · already sent ${dollars(u.sent)}`}
                  {u.received > 0 && ` · already received ${dollars(u.received)}`}
                </p>
                {credit > 0 && u.net < 0 && (
                  <p className="text-sm">
                    {dollars(credit)} they already put in is taken off their {dollars(u.share + u.received)}, so only {dollars(-u.net)} is left to send.
                  </p>
                )}
                {u.members.length > 1 && <p className="text-sm text-soft">One household: {u.members.join(" and ")} never pay each other.</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={`flex flex-col gap-1 rounded-[var(--radius-control)] p-4 text-sm ${balanced ? "bg-wash" : "bg-red-50"}`}>
        <p className="font-semibold">{balanced ? "Everything balances ✓" : "These figures don't balance. Don't send money yet."}</p>
        <p>
          Total spent {dollars(s.spentCents)}. Payments above move {dollars(paidIn)}, leaving $0.00 unaccounted for. Changing how to settle only changes who sends money to whom, never what anyone owes in total.
        </p>
      </section>
    </div>
  );
}

function message(s: Body, tripName: string): string {
  const lines = s.payments.map((p) => `${p.from} → ${p.to}: ${dollars(p.amountCents)}`);
  return [
    `${tripName}: expenses are in. ${dollars(s.spentCents)} total.`,
    "",
    ...(lines.length ? ["To settle up:", ...lines] : ["Nobody owes anything."]),
    "",
    "Anything you already paid for the group has been taken off what you owe, so you're only sending the difference. Questions? Text me.",
  ].join("\n");
}

export default async function SettlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireMosey(`/mosey/${id}/money/settle`);
  const loaded = await Promise.all([getTrip(actor, id), ledger(actor, id), statements(actor, id)]).catch((err) => {
    if (err instanceof AccessDenied) notFound();
    throw err;
  });
  const [trip, l, saved] = loaded;
  const now = l.problem ? null : statementOf(l);

  return (
    <>
      <AppHeader email={user.email} app="Mosey" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
        <div>
          <Link href={`/mosey/${trip.id}/money`} className="text-accent underline-offset-4 hover:underline">
            ‹ Money
          </Link>
          <p className="mt-2 text-sm font-semibold text-soft">{trip.name}</p>
          <h1 className="title">Settle up</h1>
        </div>

        {l.problem && <Alert>{l.problem}</Alert>}
        {now && <StatementView s={now} />}

        {l.organizer && now && (
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">How to settle</summary>
            <div className="mt-3">
              <SettleStyle tripId={trip.id} mode={l.mode} hub={l.hub} units={l.units.map((u) => ({ id: u.id, name: u.name, members: u.members }))} />
            </div>
          </details>
        )}

        {now && (
          <section className="flex flex-col gap-3">
            <h2 className="heading">Message for the group</h2>
            <CopyText text={message(now, trip.name)} />
          </section>
        )}

        {(l.organizer || saved.length > 0) && (
          <section className="flex flex-col gap-3">
            <h2 className="heading">Saved versions</h2>
            <p className="text-sm text-soft">Freeze the settle-up before you send it. A saved version never changes; later edits make a new one.</p>
            {l.organizer && now && <FreezeButton tripId={trip.id} />}
            {saved.map((s) => (
              <details key={s.version}>
                <summary className="min-h-11 cursor-pointer content-center">
                  Version {s.version} · {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {dollars(s.spentCents)}
                </summary>
                <div className="mt-3">
                  <StatementView s={s} />
                </div>
              </details>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
