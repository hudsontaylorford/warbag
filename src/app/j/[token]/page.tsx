import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentActor } from "@/lib/session";
import { memberGroupIdForLink, publicGroupPage, type GroupRowView } from "@/lib/gyfte/groups";
import { ThisIsMe } from "../ThisIsMe";

export const metadata: Metadata = { title: "Gift lists · warbag", robots: { index: false, follow: false } };

/**
 * A family link: the group's people, years and wanted gifts, with no claims
 * and no sign-in. "This is me" emails that person a one-tap sign-in link.
 */
export default async function FamilyLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { token } = await params;
  const { year: wantYear } = await searchParams;
  const actor = await currentActor();
  if (actor) {
    const groupId = await memberGroupIdForLink(actor, token);
    if (groupId) redirect(`/gyfte/groups/${groupId}`);
  }
  const page = await publicGroupPage(token, wantYear);
  if (!page) notFound();
  const thisYear = page.year === page.years[page.years.length - 1];

  const Row = ({ r }: { r: GroupRowView }) => (
    <li className="flex min-h-14 items-center justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="font-semibold break-words">{r.name}</span>
        {r.list ? (
          <Link href={`/j/${token}/l/${r.list.id}`} className="text-sm text-accent underline-offset-4 hover:underline">
            {r.list.gifts} {r.list.gifts === 1 ? "gift" : "gifts"} ›
          </Link>
        ) : (
          <span className="text-sm text-soft">No list yet</span>
        )}
      </div>
      {r.userId && thisYear && <ThisIsMe token={token} userId={r.userId} />}
    </li>
  );

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm text-soft">warbag · Gyfte</p>
        <h1 className="mt-1 text-2xl font-semibold break-words">{page.name}</h1>
        <p className="mt-2 text-soft">
          Tap <span className="font-semibold text-ink">This is me</span> by your name. We&apos;ll email you a link that
          signs you in, so you can claim gifts and make your own list.
        </p>
      </div>

      <nav aria-label="Years" className="flex flex-wrap gap-x-4 gap-y-1">
        {page.years.map((y) =>
          y === page.year ? (
            <span key={y} aria-current="page" className="min-h-11 content-center font-semibold">
              {y}
            </span>
          ) : (
            <Link key={y} href={`/j/${token}?year=${y}`} className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
              {y}
            </Link>
          ),
        )}
      </nav>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Christmas {page.year}</h2>
        <ul className="divide-y divide-line border-y border-line">
          {page.christmas.map((r) => (
            <Row key={`${r.userId ?? r.name}-${r.list?.id ?? "none"}`} r={r} />
          ))}
        </ul>
      </section>

      {page.birthdays.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Birthdays in {page.year}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {page.birthdays.map((r) => (
              <Row key={r.list!.id} r={{ ...r, userId: null }} />
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-soft">Not on here? Ask whoever sent you this link to add you.</p>
    </main>
  );
}
