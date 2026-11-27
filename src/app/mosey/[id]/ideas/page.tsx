import type { Metadata } from "next";
import { requireMosey } from "@/lib/mosey/page";
import { AccessDenied } from "@/lib/access";
import { getTrip } from "@/lib/mosey/trips";
import { NotShared } from "../../NotShared";
import { AppHeader } from "@/components/shell/AppHeader";
import { IdeaList, TripHeader } from "../../TripParts";

export const metadata: Metadata = { title: "Ideas · Mosey", robots: { index: false, follow: false } };

export default async function TripIdeasPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string }> }) {
  const { id } = await params;
  const { show } = await searchParams;
  const { user, actor } = await requireMosey(`/mosey/${id}/ideas`, { trip: true });
  const trip = await getTrip(actor, id).catch((err) => {
    if (err instanceof AccessDenied) return null;
    throw err;
  });
  if (!trip) return <NotShared tripId={id} />;
  const canAdd = trip.role === "manage" || trip.role === "contribute";

  return (
    <>
      <AppHeader email={user.email} app="Mosey" letter="M" appHref="/mosey" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <TripHeader trip={trip} base={`/mosey/${trip.id}`} current="ideas" back money={trip.money} />
        <IdeaList trip={trip} canAdd={canAdd} canPlan={trip.organizer} viewerOnly={!canAdd} food={show === "food"} base={`/mosey/${trip.id}/ideas`} />
      </main>
    </>
  );
}
