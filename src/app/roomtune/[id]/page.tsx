import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRoomTuner } from "@/lib/roomtune/page";
import { getSetup, setupLinks } from "@/lib/roomtune/setups";
import { AccessDenied } from "@/lib/access";
import { siteUrl } from "@/lib/site";
import { AppHeader } from "@/components/shell/AppHeader";
import { Tuner } from "../Tuner";

export const metadata: Metadata = { title: "Room Tuner · warbag", robots: { index: false, follow: false } };

export default async function SetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireRoomTuner(`/roomtune/${id}`);
  let setup;
  let links;
  try {
    setup = await getSetup(actor, id);
    links = await setupLinks(actor, id);
  } catch (e) {
    if (e instanceof AccessDenied) notFound();
    throw e;
  }
  return (
    <>
      <AppHeader email={user.email} app="Room Tuner" letter="R" appHref="/roomtune" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <Tuner key={setup.id} initial={setup} links={links} siteUrl={siteUrl()} />
      </main>
    </>
  );
}
