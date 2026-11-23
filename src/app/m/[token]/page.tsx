import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Monogram } from "@/components/ui/Monogram";
import { getTrip, tripByLink } from "@/lib/mosey/trips";
import { currentActor, currentUser } from "@/lib/session";
import { DayCards, TripHeader } from "@/app/mosey/TripParts";
import { AskToJoinTrip } from "@/app/mosey/TripInvite";

export const metadata: Metadata = { title: "Trip · warbag", robots: { index: false, follow: false } };

/**
 * A trip link: the plan, no sign-in, no money or members-only details, and
 * a way to ask to join (or, for someone already on the trip, to open it).
 */
export default async function TripLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trip = await tripByLink(token);
  if (!trip) notFound();
  const [user, actor] = await Promise.all([currentUser(), currentActor()]);
  const onTrip = actor ? await getTrip(actor, trip.id).then((t) => t.role === "contribute" || t.role === "manage").catch(() => false) : false;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <p className="flex items-center gap-2 text-sm text-soft">
        <Monogram letter="M" size="sm" tone="ember" />
        Mosey · warbag
      </p>
      <TripHeader trip={trip} base={`/m/${token}`} current="plan" />
      <section className="flex flex-col gap-3 rounded-[calc(var(--radius-control)*2)] border border-line bg-field p-4">
        {onTrip ? (
          <p>
            You&apos;re on this trip.{" "}
            <Link href={`/mosey/${trip.id}`} className="font-semibold text-accent underline-offset-4 hover:underline">
              Open it ›
            </Link>
          </p>
        ) : (
          <>
            <h2 className="heading">Join this trip</h2>
            <p className="text-sm text-soft">
              Leave your name and email, now or any time. When the organizer adds you, we&apos;ll email you how to sign in. Then you can add ideas,
              expenses and who&apos;s going.
            </p>
            <AskToJoinTrip token={token} name={user?.name || undefined} email={user?.email} />
          </>
        )}
      </section>
      <DayCards trip={trip} canAdd={false} canPlan={false} viewerOnly />
    </main>
  );
}
