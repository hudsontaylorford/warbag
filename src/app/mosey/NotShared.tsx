import Link from "next/link";
import { currentUser } from "@/lib/session";
import { AppHeader } from "@/components/shell/AppHeader";
import { AskToJoinById } from "./TripInvite";
import { seesHub } from "@/lib/hub";

/**
 * A trip that isn't shared with you, or doesn't exist: the same words for
 * both, so nobody learns which trips exist. Says who you're signed in as and
 * what to do next. Given the trip's id, offers Ask to join, which answers the
 * same whether or not the trip exists.
 */
export async function NotShared({ tripId }: { tripId?: string }) {
  const user = await currentUser();
  const hub = await seesHub();
  return (
    <>
      {user && <AppHeader email={user.email} app="Mosey" letter="M" appHref="/mosey" isAdmin={user.isAdmin === true} people={user.isPeopleManager === true} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
        <h1 className="title">This trip isn&apos;t shared with you</h1>
        <p>Or it doesn&apos;t exist anymore.</p>
        {user && (
          <p>
            You&apos;re signed in as <span className="font-semibold break-all">{user.email}</span>.{" "}
            {tripId
              ? "If someone sent you here, ask to join and the organizer can add you. Or ask them to add this email under Manage."
              : "If someone invited you, ask them to add this email to the trip under Manage, or open the trip link they sent and ask to join."}
          </p>
        )}
        {user && tripId && (
          <section className="flex flex-col gap-3 rounded-[calc(var(--radius-control)*2)] border border-line bg-field p-4">
            <h2 className="heading">Ask to join</h2>
            <AskToJoinById tripId={tripId} name={user.name || ""} email={user.email} />
          </section>
        )}
        <p className="flex flex-wrap gap-x-5">
          <Link href="/mosey" className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
            Your trips
          </Link>
          {hub && (
            <Link href="/home" className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
              warbag home
            </Link>
          )}
        </p>
      </main>
    </>
  );
}
