import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicGroupList } from "@/lib/gyfte/groups";
import { storeName } from "@/lib/gyfte/links";
import { ListTitle } from "@/app/gyfte/ListTitle";

export const metadata: Metadata = { title: "Gift list · warbag", robots: { index: false, follow: false } };

/** One list from a family link: wanted gifts, no claims. */
export default async function FamilyLinkListPage({ params }: { params: Promise<{ token: string; listId: string }> }) {
  const { token, listId } = await params;
  const list = await publicGroupList(token, listId);
  if (!list) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href={`/j/${token}?from=${listId}`} className="inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline">
          ‹ {list.groupName}
        </Link>
        <ListTitle title={list.title} className="mt-2" />
      </div>
      {list.gifts.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">
          {list.gifts.map((g) => {
            const details = [g.size, g.color, g.price, g.links[0] ? storeName(g.links[0]) : ""].filter(Boolean).join(" · ");
            return (
              <li key={g.id} className="flex flex-col py-3">
                {g.links[0] ? (
                  <a href={g.links[0]} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold break-words text-accent underline-offset-4 hover:underline">
                    {g.starred && <span aria-label="Most wanted">★ </span>}
                    {g.name}
                  </a>
                ) : (
                  <span className="font-semibold break-words">
                    {g.starred && <span aria-label="Most wanted">★ </span>}
                    {g.name}
                  </span>
                )}
                {details && <span className="text-sm text-soft break-words">{details}</span>}
                {g.notes && <span className="text-sm break-words whitespace-pre-line">{g.notes}</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-soft">No gifts on this list yet.</p>
      )}
      <p className="text-sm text-soft">
        To claim a gift,{" "}
        <Link href={`/j/${token}?from=${listId}`} className="text-accent underline-offset-4 hover:underline">
          go back
        </Link>{" "}
        and tap <span className="font-semibold text-ink">This is me</span> by your name. The email brings you back to this list.
      </p>
    </main>
  );
}
