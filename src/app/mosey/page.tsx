import type { Metadata } from "next";
import Link from "next/link";
import { requireMosey } from "@/lib/mosey/page";
import { tripsFor } from "@/lib/mosey/trips";
import { AppHeader } from "@/components/shell/AppHeader";
import { rangeLabel } from "./format";

export const metadata: Metadata = { title: "Mosey · warbag", robots: { index: false, follow: false } };

/** Your trips: ones you organize or were added to. */
export default async function MoseyPage() {
  const { user, actor, canCreate } = await requireMosey("/mosey");
  const trips = await tripsFor(actor);

  return (
    <>
      <AppHeader email={user.email} app="Mosey" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="title">Trips</h1>
          {canCreate && (
            <Link
              href="/mosey/new"
              className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-control)] bg-ink px-4 font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              New trip
            </Link>
          )}
        </div>
        {trips.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line">
            {trips.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/mosey/${t.id}`}
                  className="flex min-h-14 items-center justify-between gap-4 py-2 hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold break-words">{t.name}</span>
                    <span className="text-sm text-soft">
                      {[rangeLabel(t.startDate, t.endDate), t.place].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span aria-hidden className="text-accent">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-soft">{canCreate ? "No trips yet. Start one with its dates; the days fill in." : "No trips shared with you yet."}</p>
        )}
      </main>
    </>
  );
}
