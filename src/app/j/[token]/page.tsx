import type { Metadata } from "next";
import { previewMetadata } from "@/lib/preview";
import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";
import { notFound, redirect } from "next/navigation";
import { currentActor } from "@/lib/session";
import { memberGroupIdForLink, publicGroupPage, returnPath, type GroupRowView } from "@/lib/gyfte/groups";
import { ThisIsMe } from "../ThisIsMe";
import { AskToJoin } from "../AskToJoin";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const token = (await params).token;
  const page = await publicGroupPage(token);
  if (!page) return { title: "Gift lists · Gyfte", robots: { index: false, follow: false } };
  return previewMetadata({ title: `${page.name} · Gyfte`, headline: `${page.name}: gift lists`, description: "See everyone's lists. Sign in to say what you'll get.", image: `/j/${token}/og` });
}

/**
 * A family link: the group's people, years and wanted gifts, with no claims
 * and no sign-in. "This is me" emails that person a one-tap sign-in link.
 */
export default async function FamilyLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  /** from: the list they opened before coming back here, so sign-in can return to it. */
  searchParams: Promise<{ year?: string; from?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const wantYear = sp.year;
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const actor = await currentActor();
  if (actor) {
    const groupId = await memberGroupIdForLink(actor, token);
    if (groupId) redirect(await returnPath(groupId, from));
  }
  const page = await publicGroupPage(token, wantYear);
  if (!page) notFound();
  const thisYear = page.year === page.years[page.years.length - 1];

  const Row = ({ r }: { r: GroupRowView }) => (
    <li className={`flex min-h-14 items-center justify-between gap-4 py-2 ${r.nested ? "pl-6" : ""}`}>
      <div className="flex min-w-0 flex-col">
        <span className={`break-words ${r.nested ? "" : "font-semibold"}`}>
          {r.nested && <span aria-hidden className="text-soft">↳ </span>}
          {r.list || r.latest ? (
            <Link
              href={`/j/${token}/l/${(r.list ?? r.latest)!.id}`}
              className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {r.name}
            </Link>
          ) : (
            r.name
          )}
        </span>
        {r.list ? (
          <Link href={`/j/${token}/l/${r.list.id}`} className="text-sm text-accent underline-offset-4 hover:underline">
            {r.list.gifts} {r.list.gifts === 1 ? "gift" : "gifts"} ›
          </Link>
        ) : r.latest ? (
          <Link href={`/j/${token}/l/${r.latest.id}`} className="text-sm text-accent underline-offset-4 hover:underline">
            {r.latest.year} list ›
          </Link>
        ) : (
          <span className="text-sm text-soft">No list yet</span>
        )}
      </div>
      {r.userId && thisYear && <ThisIsMe token={token} userId={r.userId} from={from} />}
    </li>
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="flex items-center gap-2 text-sm text-soft">
          <Monogram letter="G" size="sm" tone="ember" />
          Gyfte
        </p>
        <h1 className="mt-1 title break-words">{page.name}</h1>
        <p className="mt-2 text-soft">
          Find your name and tap <span className="font-semibold text-ink">This is me</span>. We&apos;ll email you a sign-in link.
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
        <h2 className="heading">Christmas</h2>
        <ul className="divide-y divide-line border-y border-line">
          {page.christmas.map((r) => (
            <Row key={`${r.userId ?? r.name}-${r.list?.id ?? "none"}`} r={r} />
          ))}
        </ul>
      </section>

      {page.birthdays.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="heading">Birthdays</h2>
          <ul className="divide-y divide-line border-y border-line">
            {page.birthdays.map((r) => (
              <Row key={r.list!.id} r={{ ...r, userId: null }} />
            ))}
          </ul>
        </section>
      )}

      <AskToJoin token={token} />
    </main>
  );
}
