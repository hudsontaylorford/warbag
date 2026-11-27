import type { Metadata } from "next";
import Link from "next/link";
import { requireJot } from "@/lib/jot/page";
import { trashFor } from "@/lib/jot/notes";
import { AppHeader } from "@/components/shell/AppHeader";
import { ConfirmForm } from "@/components/ui/forms";
import { emptyTrashAction } from "../actions";
import { TrashRow } from "./TrashRow";

export const metadata: Metadata = { title: "Trash · Jot", robots: { index: false, follow: false } };

export default async function TrashPage() {
  const { user, actor } = await requireJot("/jot/trash");
  const notes = await trashFor(actor);
  return (
    <>
      <AppHeader email={user.email} app="Jot" letter="J" appHref="/jot" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
        <div className="flex flex-col">
          <Link href="/jot" className="min-h-11 content-center self-start text-accent underline-offset-4 hover:underline">
            ‹ Notes
          </Link>
          <h1 className="title">Trash</h1>
        </div>
        <p className="text-soft">Notes stay here for 30 days, then they&apos;re deleted for good. Restore puts one back at the top of your notes.</p>
        {notes.length > 0 ? (
          <>
            <ul className="divide-y divide-line border-y border-line">
              {notes.map((n) => (
                <TrashRow key={n.id} note={n} />
              ))}
            </ul>
            <ConfirmForm
              action={emptyTrashAction}
              id="trash"
              label="Empty trash"
              consequence={`${notes.length === 1 ? "The note" : `All ${notes.length} notes`} in the Trash will be deleted for good. This can't be undone.`}
            />
          </>
        ) : (
          <p className="text-soft">The Trash is empty.</p>
        )}
      </main>
    </>
  );
}
