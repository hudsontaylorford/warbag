import type { Metadata } from "next";
import Link from "next/link";
import { requireGyfte } from "@/lib/gyfte/page";
import { listsFor, type ListSummary } from "@/lib/gyfte/data";
import { myGroups } from "@/lib/gyfte/groups";
import { GroupTools } from "./GroupTools";
import { GyfteNav } from "./GyfteNav";
import { AppHeader } from "@/components/shell/AppHeader";

export const metadata: Metadata = { title: "Gyfte · warbag" };

const rowLink =
  "flex min-h-14 items-center justify-between gap-4 py-2 hover:bg-wash " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const quietLink = "min-h-11 content-center text-accent underline-offset-4 hover:underline";

function Lists({ lists }: { lists: ListSummary[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {lists.map((l) => (
        <li key={l.id}>
          <Link href={`/gyfte/${l.id}`} className={rowLink}>
            <span className="font-semibold break-words">{l.title}</span>
            <span className="shrink-0 text-sm text-soft">
              {l.itemCount} {l.itemCount === 1 ? "gift" : "gifts"} ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * "My list": the lists you look after (yours, and your kids'). Other
 * people's lists live under Family; lists shared with you outside a
 * group show below yours so nothing goes missing.
 */
export default async function GyftePage({ searchParams }: { searchParams: Promise<{ imported?: string }> }) {
  const { user, actor, canCreate } = await requireGyfte("/gyfte");
  const imported = (await searchParams).imported === "1";
  const [{ current, past }, groups] = await Promise.all([listsFor(actor), myGroups(actor)]);
  const mine = current.filter((l) => l.canManage);
  const sharedOutside = current.filter((l) => !l.canManage && !l.inMyGroup);
  const myPast = past.filter((l) => l.canManage);

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
        <GyfteNav current="mine" />

        {imported && (
          <p role="status" className="rounded-[var(--radius-control)] bg-wash px-4 py-3 text-sm">
            Import done ✓ Past years are under History. They&apos;re private to you until you share them.
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <h1 className="title">My list</h1>
          {canCreate && (
            <Link
              href="/gyfte/new"
              className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-control)] bg-ink px-4 font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              New list
            </Link>
          )}
        </div>

        {mine.length > 0 ? (
          <Lists lists={mine} />
        ) : (
          <p className="text-soft">
            {canCreate
              ? "No list yet. Start one for Christmas or a birthday."
              : "No list yet. Open Family to start yours."}
          </p>
        )}

        {sharedOutside.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="heading">Shared with you</h2>
            <Lists lists={sharedOutside} />
          </section>
        )}

        {myPast.length > 0 && (
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">History ({myPast.length})</summary>
            <div className="mt-2">
              <Lists lists={myPast} />
            </div>
          </details>
        )}

        {(canCreate || actor.isAdmin) && (
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">Manage</summary>
            <div className="mt-2 flex flex-col gap-2">
              {actor.isAdmin && groups.length > 0 && (
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
              {canCreate && (
                <Link href="/gyfte/import" className={quietLink}>
                  Import a spreadsheet ›
                </Link>
              )}
            </div>
          </details>
        )}
      </main>
    </>
  );
}
