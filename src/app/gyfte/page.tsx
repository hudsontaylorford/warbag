import type { Metadata } from "next";
import Link from "next/link";
import { requireGyfte } from "@/lib/gyfte/page";
import { listsFor, type ListSummary } from "@/lib/gyfte/data";
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

export default async function GyftePage() {
  const { user, actor } = await requireGyfte("/gyfte");
  const { current, past } = await listsFor(actor);

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Lists</h1>
          <Link
            href="/gyfte/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            New list
          </Link>
        </div>

        {current.length > 0 ? (
          <Lists lists={current} />
        ) : (
          <p className="text-soft">No lists yet. Start one for Christmas or a birthday.</p>
        )}

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
