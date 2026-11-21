import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { AccessDenied } from "@/lib/access";
import { groupPage, viewerFor, type GroupRowView } from "@/lib/gyfte/groups";
import { AppHeader } from "@/components/shell/AppHeader";
import { ConfirmForm } from "@/components/ui/forms";
import { deleteSampleAction } from "../../actions";
import { StartMyList } from "./StartMyList";
import { ViewAsBanner, ViewAsPicker } from "./ViewAs";

export const metadata: Metadata = { title: "Group · Gyfte" };

const rowCls = "flex min-h-14 items-center justify-between gap-4 py-2";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; as?: string }>;
}) {
  const { id } = await params;
  const { year: wantYear, as } = await searchParams;
  const user = await requireUser(`/gyfte/groups/${id}`);
  const actor = { id: user.id, isAdmin: user.isAdmin === true };
  const { viewer, previewName } = await viewerFor(actor, as);
  const page = await groupPage(viewer, id, wantYear).catch((err) => {
    if (err instanceof AccessDenied) notFound();
    throw err;
  });
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...(previewName && as ? { as } : {}), ...extra });
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  const thisYearIsCurrent = page.year === page.years[page.years.length - 1];

  const Row = ({ r }: { r: GroupRowView }) => (
    <li className={rowCls}>
      <span className="font-semibold">
        {r.name}
        {r.isYou && <span className="font-normal text-soft"> (you)</span>}
      </span>
      {r.list ? (
        <Link href={`/gyfte/${r.list.id}${keep({})}`} className="text-accent underline-offset-4 hover:underline">
          {r.list.gifts} {r.list.gifts === 1 ? "gift" : "gifts"} ›
        </Link>
      ) : r.isYou && !previewName && thisYearIsCurrent ? (
        <StartMyList groupId={page.id} year={page.year} />
      ) : (
        <span className="text-sm text-soft">No list yet</span>
      )}
    </li>
  );

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        {previewName && <ViewAsBanner name={previewName} exitHref={`/gyfte/groups/${page.id}${keep({ year: page.year }).replace(/as=[^&]*&?/, "")}`} />}
        <div>
          <Link href={`/gyfte${keep({})}`} className="text-accent underline-offset-4 hover:underline">
            ‹ Gyfte
          </Link>
          <h1 className="mt-2 text-2xl font-semibold break-words">{page.name}</h1>
          {page.isSample && <p className="text-sm text-soft">Made-up people and lists, only visible to you. Delete it any time.</p>}
        </div>

        <nav aria-label="Years" className="flex flex-wrap gap-x-4 gap-y-1">
          {page.years.map((y) =>
            y === page.year ? (
              <span key={y} aria-current="page" className="min-h-11 content-center font-semibold">
                {y}
              </span>
            ) : (
              <Link key={y} href={`/gyfte/groups/${page.id}${keep({ year: y })}`} className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
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
                <Row key={r.list!.id} r={r} />
              ))}
            </ul>
          </section>
        )}

        {actor.isAdmin && !previewName && (
          <div className="flex flex-col gap-6 border-t border-line pt-6">
            <Link href={`/admin/groups/${page.accessGroupId}`} className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
              Manage who&apos;s in this group ›
            </Link>
            {page.isSample && (
              <>
                <ViewAsPicker groupId={page.id} year={page.year} people={page.samplePeople} />
                <ConfirmForm
                  action={deleteSampleAction}
                  id={page.id}
                  label="Delete sample family"
                  consequence="The sample group, its made-up people and all their lists will be deleted. Your real lists aren't touched."
                />
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
