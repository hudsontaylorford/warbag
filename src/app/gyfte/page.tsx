import type { Metadata } from "next";
import Link from "next/link";
import { requireGyfte } from "@/lib/gyfte/page";
import { listsFor, type ListSummary } from "@/lib/gyfte/data";
import { myGroups } from "@/lib/gyfte/groups";
import { GroupTools } from "./GroupTools";
import { AppHeader } from "@/components/shell/AppHeader";

export const metadata: Metadata = { title: "Gyfte · warbag" };

const rowLink =
  "flex min-h-14 items-center justify-between gap-4 py-2 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Lists({ lists }: { lists: ListSummary[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {lists.map((l) => (
        <li key={l.id}>
          <Link href={`/gyfte/${l.id}`} className={rowLink}>
            <span className="font-semibold">{l.title}</span>
            <span className="shrink-0 text-sm text-soft">
              {l.itemCount} {l.itemCount === 1 ? "gift" : "gifts"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function GyftePage({ searchParams }: { searchParams: Promise<{ imported?: string }> }) {
  const { user, actor, canCreate } = await requireGyfte("/gyfte");
  const imported = (await searchParams).imported === "1";
  const [{ current, past }, groups] = await Promise.all([listsFor(actor), myGroups(actor)]);

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="title">Lists</h1>
          {canCreate && (
          <Link
            href="/gyfte/new"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-ink px-4 font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            New list
          </Link>
          )}
        </div>

        {(groups.length > 0 || actor.isAdmin) && (
          <section className="flex flex-col gap-2">
            <h2 className="heading">Groups</h2>
            {groups.length > 0 && (
              <ul className="divide-y divide-line border-y border-line">
                {groups.map((g) => (
                  <li key={g.id}>
                    <Link href={`/gyfte/groups/${g.id}`} className={rowLink}>
                      <span className="font-semibold">{g.name}</span>
                      <span className="shrink-0 text-sm text-soft">
                        {g.isSample ? "Sample · " : ""}
                        {g.members} {g.members === 1 ? "person" : "people"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {actor.isAdmin && <GroupTools hasSample={groups.some((g) => g.isSample)} />}
          </section>
        )}

        <h2 className="heading">Your lists</h2>

        {imported && (
          <p role="status" className="rounded-[var(--radius-control)] bg-wash px-4 py-3 text-sm">
            Import done ✓ Past years are under History. They&apos;re private to you until you share them.
          </p>
        )}

        {current.length > 0 ? (
          <Lists lists={current} />
        ) : (
          <p className="text-soft">{canCreate ? "No lists yet. Start one for Christmas or a birthday." : "No lists shared with you right now."}</p>
        )}

        <div className="flex flex-wrap gap-x-6">
          <Link href="/gyfte/claims" className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
            My claims ›
          </Link>
          {canCreate && (
            <Link href="/gyfte/import" className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
              Import a spreadsheet ›
            </Link>
          )}
        </div>

        {past.length > 0 && (
          <details className="group">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">History ({past.length})</summary>
            <div className="mt-2">
              <Lists lists={past} />
            </div>
          </details>
        )}
      </main>
    </>
  );
}
