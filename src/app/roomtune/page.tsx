import type { Metadata } from "next";
import Link from "next/link";
import { requireRoomTuner } from "@/lib/roomtune/page";
import { setupsFor } from "@/lib/roomtune/setups";
import { AppHeader } from "@/components/shell/AppHeader";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = { title: "Room Tuner", robots: { index: false, follow: false } };

/** Your setups: one per speaker and room. */
export default async function RoomTunerPage() {
  const { user, actor } = await requireRoomTuner("/roomtune");
  const setups = await setupsFor(actor);

  return (
    <>
      <AppHeader email={user.email} app="Room Tuner" letter="R" appHref="/roomtune" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="title">Setups</h1>
          <Link
            href="/roomtune/new"
            className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-control)] bg-ink px-4 font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            New setup
          </Link>
        </div>
        <p className="text-soft">Measure a speaker in its room with two phones, and get the slider values for the speaker&apos;s own EQ app.</p>
        {setups.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line">
            {setups.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/roomtune/${s.id}`}
                  className="flex min-h-14 items-center justify-between gap-4 py-2 hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold break-words">{s.name}</span>
                    <span className="text-sm text-soft">
                      {s.bands} bands · {s.rounds === 0 ? "no rounds yet" : s.rounds === 1 ? "1 round" : `${s.rounds} rounds`}
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
          <p className="text-soft">No setups yet. Make one for each speaker and room you want to tune.</p>
        )}
        <details>
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Import setups</summary>
          <div className="mt-3">
            <ImportForm />
          </div>
        </details>
      </main>
    </>
  );
}
