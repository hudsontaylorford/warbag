import type { Metadata } from "next";
import { previewMetadata } from "@/lib/preview";
import { tripPreview } from "@/lib/mosey/preview";
import { notFound } from "next/navigation";
import { Monogram } from "@/components/ui/Monogram";
import { tripByLink } from "@/lib/mosey/trips";
import { IdeaList, TripHeader } from "@/app/mosey/TripParts";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const trip = await tripByLink(token);
  if (!trip) return { title: "Trip · Mosey", robots: { index: false, follow: false } };
  return previewMetadata({ title: `${trip.name} · Ideas · Mosey`, ...tripPreview(trip, token) });
}

export default async function TripLinkIdeasPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trip = await tripByLink(token);
  if (!trip) notFound();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <p className="flex items-center gap-2 text-sm text-soft">
        <Monogram letter="M" size="sm" tone="ember" />
        Mosey
      </p>
      <TripHeader trip={trip} base={`/m/${token}`} current="ideas" />
      <IdeaList trip={trip} canAdd={false} canPlan={false} viewerOnly />
    </main>
  );
}
