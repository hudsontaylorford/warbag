import type { Metadata } from "next";
import Link from "next/link";
import { requireJot } from "@/lib/jot/page";
import { notesFor, trashCount } from "@/lib/jot/notes";
import { AppHeader } from "@/components/shell/AppHeader";
import { Board } from "./Board";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = { title: "Jot", robots: { index: false, follow: false } };

const tab = "min-h-11 content-center rounded-[var(--radius-control)] px-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Your notes. */
export default async function JotPage({ searchParams }: { searchParams: Promise<{ view?: string; trashed?: string }> }) {
  const { view, trashed } = await searchParams;
  const { user, actor } = await requireJot("/jot");
  const [notes, inTrash] = await Promise.all([notesFor(actor), trashCount(actor)]);
  const byLabel = view === "label";

  return (
    <>
      <AppHeader email={user.email} app="Jot" letter="J" appHref="/jot" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="title">Notes</h1>
          <Link
            href="/jot/new"
            className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-control)] bg-ink px-4 font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            New note
          </Link>
        </div>
        {trashed && (
          <p role="status" className="text-sm text-soft">
            Moved to the Trash ✓ <Link href="/jot/trash" className="text-accent underline underline-offset-4">Open Trash</Link>
          </p>
        )}
        {notes.length > 0 ? (
          <>
            <nav aria-label="View" className="flex gap-4">
              <Link href="/jot" aria-current={!byLabel ? "page" : undefined} className={`${tab} ${!byLabel ? "font-semibold text-ink" : "text-accent underline-offset-4 hover:underline"}`}>
                Your order
              </Link>
              <Link href="/jot?view=label" aria-current={byLabel ? "page" : undefined} className={`${tab} ${byLabel ? "font-semibold text-ink" : "text-accent underline-offset-4 hover:underline"}`}>
                By label
              </Link>
            </nav>
            <Board notes={notes} byLabel={byLabel} />
          </>
        ) : (
          <p className="text-soft">No notes yet. Tap New note to write one.</p>
        )}
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <Link href="/jot/trash" className="min-h-11 content-center self-start text-accent underline-offset-4 hover:underline">
            Trash{inTrash > 0 ? ` (${inTrash})` : ""}
          </Link>
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">Import from Stickies</summary>
            <div className="mt-3">
              <ImportForm />
            </div>
          </details>
        </div>
      </main>
    </>
  );
}
