import Link from "next/link";
import { currentUser } from "@/lib/session";
import { AppHeader } from "@/components/shell/AppHeader";

/**
 * A trip that isn't shared with you, or doesn't exist: the same words for
 * both, so nobody learns which trips exist. Says who you're signed in as and
 * what to do next.
 */
export default async function MoseyNotFound() {
  const user = await currentUser();
  return (
    <>
      {user && <AppHeader email={user.email} app="Mosey" letter="M" appHref="/mosey" isAdmin={user.isAdmin === true} people={user.isPeopleManager === true} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
        <h1 className="title">This trip isn&apos;t shared with you</h1>
        <p>Or it doesn&apos;t exist anymore.</p>
        {user && (
          <p>
            You&apos;re signed in as <span className="font-semibold break-all">{user.email}</span>. If someone invited you, ask them to add this email to the
            trip under Manage, or open the trip link they sent and ask to join.
          </p>
        )}
        <p className="flex flex-wrap gap-x-5">
          <Link href="/mosey" className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
            Your trips
          </Link>
          <Link href="/home" className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
            warbag home
          </Link>
        </p>
      </main>
    </>
  );
}
