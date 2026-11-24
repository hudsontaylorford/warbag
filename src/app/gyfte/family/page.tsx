import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireGyfte } from "@/lib/gyfte/page";
import { myGroups } from "@/lib/gyfte/groups";
import { AppHeader } from "@/components/shell/AppHeader";
import { GyfteNav } from "../GyfteNav";

export const metadata: Metadata = { title: "Family · Gyfte" };

/** Family: your group's people and lists. With one family, go straight to it. */
export default async function FamilyPage() {
  const { user, actor } = await requireGyfte("/gyfte/family");
  const groups = (await myGroups(actor)).filter((g) => !g.isSample);
  if (groups.length === 1) redirect(`/gyfte/groups/${groups[0].id}`);

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" letter="G" appHref="/gyfte" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
        <GyfteNav current="family" />
        <h1 className="title">Family</h1>
        {groups.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/gyfte/groups/${g.id}`}
                  className="flex min-h-14 items-center justify-between gap-4 py-2 hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="font-semibold">{g.name}</span>
                  <span className="shrink-0 text-sm text-soft">
                    {g.members} {g.members === 1 ? "person" : "people"} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-soft">You&apos;re not in a family group yet. Ask whoever sent you here to add you.</p>
        )}
      </main>
    </>
  );
}
