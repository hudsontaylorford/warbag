import type { Metadata } from "next";
import Link from "next/link";
import { requireRoomTuner } from "@/lib/roomtune/page";
import { AppHeader } from "@/components/shell/AppHeader";
import { SetupBuilder } from "../SetupBuilder";
import { eqAiConfigured } from "@/lib/roomtune/eq-ai";

export const metadata: Metadata = { title: "New setup · Room Tuner · warbag", robots: { index: false, follow: false } };

export default async function NewSetupPage() {
  const { user, actor } = await requireRoomTuner("/roomtune/new");
  return (
    <>
      <AppHeader email={user.email} app="Room Tuner" letter="R" appHref="/roomtune" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col">
          <Link href="/roomtune" className="min-h-11 content-center self-start text-accent underline-offset-4 hover:underline">
            ‹ Setups
          </Link>
          <h1 className="title">New setup</h1>
        </div>
        <p className="text-soft">One setup per speaker and room. Enter the EQ the way the speaker&apos;s app shows it.</p>
        <SetupBuilder canReadScreenshots={eqAiConfigured()} />
      </main>
    </>
  );
}
