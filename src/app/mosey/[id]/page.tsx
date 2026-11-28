import type { Metadata } from "next";
import { requireMosey } from "@/lib/mosey/page";
import { AccessDenied } from "@/lib/access";
import { getTrip, tripSharing } from "@/lib/mosey/trips";
import { tripJoinRequests } from "@/lib/mosey/invites";
import { siteUrl } from "@/lib/site";
import { NotShared } from "../NotShared";
import { AppHeader } from "@/components/shell/AppHeader";
import { DayCards, TripHeader } from "../TripParts";
import { TripManage } from "../TripManage";
import { YourLink } from "../LinkJoin";
import { myGuestLink } from "@/lib/mosey/link-join";

export const metadata: Metadata = { title: "Trip · Mosey", robots: { index: false, follow: false } };

export default async function TripPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireMosey(`/mosey/${id}`, { trip: true });
  const trip = await getTrip(actor, id).catch((err) => {
    if (err instanceof AccessDenied) return null;
    throw err;
  });
  if (!trip) return <NotShared tripId={id} />;
  const canAdd = trip.role === "manage" || trip.role === "contribute";
  const sharing = trip.owner ? await tripSharing(actor, id) : null;
  const requests = trip.owner ? await tripJoinRequests(actor, id) : [];
  const guestToken = trip.guest ? await myGuestLink(actor, id) : null;
  const myName = trip.people?.find((p) => p.me)?.name ?? user.name;

  return (
    <>
      <AppHeader email={user.email} app="Mosey" letter="M" appHref="/mosey" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <TripHeader trip={trip} base={`/mosey/${trip.id}`} current="plan" back money={trip.money} manage={trip.organizer} />
        {guestToken && <YourLink name={myName} url={`${siteUrl()}/m/me/${guestToken}`} />}
        {requests.length > 0 && (
          <a href="#asking" className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-control)] bg-wash px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span>
              {requests.length} asking to join
            </span>
            <span className="text-accent">Review ›</span>
          </a>
        )}
        <DayCards trip={trip} canAdd={canAdd} canPlan={trip.organizer} viewerOnly={!canAdd} />
        {trip.organizer && (
          <TripManage trip={trip} sharing={sharing} siteUrl={siteUrl()} requests={requests} canInvite={actor.isAdmin || actor.peopleManager === true} open={(await searchParams).manage === "1"} />
        )}
      </main>
    </>
  );
}
