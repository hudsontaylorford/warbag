import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMosey } from "@/lib/mosey/page";
import { AccessDenied } from "@/lib/access";
import { getTrip } from "@/lib/mosey/trips";
import { AppHeader } from "@/components/shell/AppHeader";
import { IdeaList, TripHeader } from "../../TripParts";

export const metadata: Metadata = { title: "Ideas · Mosey", robots: { index: false, follow: false } };

export default async function TripIdeasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireMosey(`/mosey/${id}/ideas`);
  const trip = await getTrip(actor, id).catch((err) => {
    if (err instanceof AccessDenied) notFound();
    throw err;
  });
  const canAdd = trip.role === "manage" || trip.role === "contribute";

  return (
    <>
      <AppHeader email={user.email} app="Mosey" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <TripHeader trip={trip} base={`/mosey/${trip.id}`} current="ideas" back money={canAdd} />
        <IdeaList trip={trip} canAdd={canAdd} canPlan={trip.organizer} viewerOnly={!canAdd} />
      </main>
    </>
  );
}
