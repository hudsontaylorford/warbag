import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMosey } from "@/lib/mosey/page";
import { AccessDenied } from "@/lib/access";
import { getTrip, tripSharing } from "@/lib/mosey/trips";
import { siteUrl } from "@/lib/site";
import { AppHeader } from "@/components/shell/AppHeader";
import { DayCards, TripHeader } from "../TripParts";
import { TripManage } from "../TripManage";

export const metadata: Metadata = { title: "Trip · Mosey", robots: { index: false, follow: false } };

export default async function TripPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireMosey(`/mosey/${id}`);
  const trip = await getTrip(actor, id).catch((err) => {
    if (err instanceof AccessDenied) notFound();
    throw err;
  });
  const canAdd = trip.role === "manage" || trip.role === "contribute";
  const sharing = trip.organizer ? await tripSharing(actor, id) : null;

  return (
    <>
      <AppHeader email={user.email} app="Mosey" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <TripHeader trip={trip} base={`/mosey/${trip.id}`} current="plan" back money={canAdd} />
        <DayCards trip={trip} canAdd={canAdd} canPlan={trip.organizer} viewerOnly={!canAdd} />
        {sharing && <TripManage trip={trip} sharing={sharing} siteUrl={siteUrl()} />}
      </main>
    </>
  );
}
