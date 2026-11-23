import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRoomTuner } from "@/lib/roomtune/page";
import { getSetup } from "@/lib/roomtune/setups";
import { AccessDenied } from "@/lib/access";
import { AppHeader } from "@/components/shell/AppHeader";
import { SetupBuilder } from "../../SetupBuilder";

export const metadata: Metadata = { title: "EQ layout · Room Tuner · warbag", robots: { index: false, follow: false } };

export default async function EditBandsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireRoomTuner(`/roomtune/${id}/bands`);
  let setup;
  try {
    setup = await getSetup(actor, id);
  } catch (e) {
    if (e instanceof AccessDenied) notFound();
    throw e;
  }
  return (
    <>
      <AppHeader email={user.email} app="Room Tuner" letter="R" appHref="/roomtune" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <h1 className="title">EQ layout</h1>
        <p className="text-soft break-words">{setup.name}</p>
        <SetupBuilder setup={setup} />
      </main>
    </>
  );
}
