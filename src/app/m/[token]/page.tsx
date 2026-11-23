import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Monogram } from "@/components/ui/Monogram";
import { tripByLink } from "@/lib/mosey/trips";
import { DayCards, TripHeader } from "@/app/mosey/TripParts";

export const metadata: Metadata = { title: "Trip · warbag", robots: { index: false, follow: false } };

/** A trip's view-only link: the plan, no sign-in, no members-only details. */
export default async function TripLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trip = await tripByLink(token);
  if (!trip) notFound();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <p className="flex items-center gap-2 text-sm text-soft">
        <Monogram letter="M" size="sm" tone="ember" />
        Mosey · warbag
      </p>
      <TripHeader trip={trip} base={`/m/${token}`} current="plan" />
      <DayCards trip={trip} canAdd={false} canPlan={false} viewerOnly />
    </main>
  );
}
