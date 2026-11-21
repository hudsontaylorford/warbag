import type { Metadata } from "next";
import { ListTitle } from "@/app/gyfte/ListTitle";
import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";
import { notFound } from "next/navigation";
import { listByLink } from "@/lib/gyfte/sharing";
import { storeName } from "@/lib/gyfte/links";

export const metadata: Metadata = { title: "Gift list · warbag", robots: { index: false, follow: false } };

/**
 * A Gyfte list opened from a share link: the wanted gifts only. No claim
 * information, since whoever opens it might be the person it's for.
 */
export default async function SharedListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const list = await listByLink(token);
  if (!list) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="flex items-center gap-2 text-sm text-soft">
          <Monogram letter="G" size="sm" tone="ember" />
          Gyfte · warbag
        </p>
        <ListTitle title={list.title} className="mt-1" />
      </div>
      {list.items.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">
          {list.items.map((item) => {
            const store = item.links[0] ? storeName(item.links[0]) : "";
            const details = [item.size, item.color, item.price, store].filter(Boolean).join(" · ");
            return (
              <li key={item.id} className="flex flex-col py-3">
                {item.links[0] ? (
                  <a href={item.links[0]} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold break-words text-accent underline-offset-4 hover:underline">
                    {item.starred && <span aria-label="Most wanted">★ </span>}
                    {item.name}
                  </a>
                ) : (
                  <span className="font-semibold break-words">
                    {item.starred && <span aria-label="Most wanted">★ </span>}
                    {item.name}
                  </span>
                )}
                {details && <span className="text-sm text-soft break-words">{details}</span>}
                {item.notes && <span className="text-sm break-words whitespace-pre-line">{item.notes}</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-soft">No gifts on this list yet.</p>
      )}
      <p className="text-sm text-soft">
        Family on warbag can{" "}
        <Link href="/sign-in" className="text-accent underline-offset-4 hover:underline">
          sign in
        </Link>{" "}
        to claim gifts.
      </p>
    </main>
  );
}
