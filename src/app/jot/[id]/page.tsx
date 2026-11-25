import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireJot } from "@/lib/jot/page";
import { getNote } from "@/lib/jot/notes";
import { AccessDenied } from "@/lib/access";
import { AppHeader } from "@/components/shell/AppHeader";
import { Editor } from "../Editor";

export const metadata: Metadata = { title: "Note · Jot · warbag", robots: { index: false, follow: false } };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireJot(`/jot/${id}`);
  let note;
  try {
    note = await getNote(actor, id);
  } catch (e) {
    if (e instanceof AccessDenied) notFound();
    throw e;
  }
  // A note in the Trash is restored from the Trash, not edited.
  if (note.trashedAt) redirect("/jot/trash");
  return (
    <>
      <AppHeader email={user.email} app="Jot" letter="J" appHref="/jot" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
        <Editor key={note.id} note={note} email={user.email} />
      </main>
    </>
  );
}
