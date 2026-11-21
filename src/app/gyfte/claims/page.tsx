import type { Metadata } from "next";
import Link from "next/link";
import { requireGyfte } from "@/lib/gyfte/page";
import { myClaims } from "@/lib/gyfte/claims";
import { AppHeader } from "@/components/shell/AppHeader";
import { ClaimRow } from "./ClaimRow";

export const metadata: Metadata = { title: "My claims · Gyfte" };

/** Your shopping list: everything you said you'd get, across lists. */
export default async function MyClaimsPage() {
  const { user, actor } = await requireGyfte("/gyfte/claims");
  const claims = await myClaims(actor);

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <div>
          <Link href="/gyfte" className="text-accent underline-offset-4 hover:underline">
            ‹ Lists
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">My claims</h1>
        </div>
        {claims.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line">
            {claims.map((c) => (
              <li key={c.id}>
                <ClaimRow claim={c} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-soft">Nothing yet. Tap &quot;I&apos;ll get this&quot; on a gift and it shows up here.</p>
        )}
      </main>
    </>
  );
}
