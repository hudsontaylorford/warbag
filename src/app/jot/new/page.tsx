import type { Metadata } from "next";
import { requireJot } from "@/lib/jot/page";
import { AppHeader } from "@/components/shell/AppHeader";
import { Editor } from "../Editor";

export const metadata: Metadata = { title: "New note · Jot", robots: { index: false, follow: false } };

export default async function NewNotePage() {
  const { user, actor } = await requireJot("/jot/new");
  return (
    <>
      <AppHeader email={user.email} app="Jot" letter="J" appHref="/jot" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
        <Editor note={null} email={user.email} />
      </main>
    </>
  );
}
