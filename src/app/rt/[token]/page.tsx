import type { Metadata } from "next";
import { previewMetadata } from "@/lib/preview";
import { notFound } from "next/navigation";
import { Monogram } from "@/components/ui/Monogram";
import { setupByLink } from "@/lib/roomtune/setups";
import { SetupView } from "@/app/roomtune/SetupView";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const token = (await params).token;
  const setup = await setupByLink(token);
  if (!setup) return { title: "Room Tuner", robots: { index: false, follow: false } };
  return previewMetadata({ title: `${setup.name} · Room Tuner`, headline: setup.name, description: "Room EQ · view the setup", image: `/rt/${token}/og` });
}

/** A setup's view-only link: the latest result, presets and rounds, no sign-in, no editing. */
export default async function SetupLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const setup = await setupByLink(token);
  if (!setup) notFound();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <p className="flex items-center gap-2 text-sm text-soft">
        <Monogram letter="R" size="sm" tone="ember" />
        Room Tuner
      </p>
      <SetupView setup={setup} />
    </main>
  );
}
