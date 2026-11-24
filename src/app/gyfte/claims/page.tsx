import type { Metadata } from "next";
import Link from "next/link";
import { requireGyfte } from "@/lib/gyfte/page";
import { myClaims } from "@/lib/gyfte/claims";
import { AppHeader } from "@/components/shell/AppHeader";
import { GyfteNav } from "../GyfteNav";
import { ClaimRow } from "./ClaimRow";

export const metadata: Metadata = { title: "I'm getting · Gyfte" };

/** Your shopping list: everything you said you'd get, across lists. */
export default async function MyClaimsPage() {
  const { user, actor } = await requireGyfte("/gyfte/claims");
  const claims = await myClaims(actor);

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" letter="G" appHref="/gyfte" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
        <GyfteNav current="getting" />
        <h1 className="title">I&apos;m getting</h1>
        {claims.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line">
            {claims.map((c) => (
              <li key={c.id}>
                <ClaimRow claim={c} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-soft">Nothing yet. When you tap &quot;I&apos;ll get this&quot; on a gift, it shows up here.</p>
            <Link href="/gyfte/family" className="min-h-11 content-center font-semibold text-accent underline-offset-4 hover:underline">
              Find something on Family ›
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
