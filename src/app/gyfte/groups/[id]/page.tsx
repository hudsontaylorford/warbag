import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { AccessDenied } from "@/lib/access";
import { familyLink, groupPage, viewerFor, type GroupRowView } from "@/lib/gyfte/groups";
import { siteUrl } from "@/lib/site";
import { FamilyLink } from "./FamilyLink";
import { StartKidList, YourKids } from "./Kids";
import { myKids } from "@/lib/gyfte/kids";
import { AppHeader } from "@/components/shell/AppHeader";
import { ConfirmForm } from "@/components/ui/forms";
import { deleteSampleAction } from "../../actions";
import { StartMyList } from "./StartMyList";
import { GyfteNav } from "../../GyfteNav";
import { JoinRequests } from "./JoinRequests";
import { joinRequests } from "@/lib/gyfte/join";
import { ViewAsBanner, ViewAsPicker } from "./ViewAs";

export const metadata: Metadata = { title: "Group · Gyfte" };

const rowCls = "flex min-h-14 items-center justify-between gap-4 py-2";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; as?: string; imported?: string }>;
}) {
  const { id } = await params;
  const { year: wantYear, as, imported } = await searchParams;
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
  const linkToken = actor.isAdmin && !previewName && !page.isSample ? await familyLink(actor, page.id) : null;
  const kids = previewName ? [] : await myKids(viewer);
  const requests = actor.isAdmin && !previewName && !page.isSample ? await joinRequests(actor, page.id) : [];
  const members = page.christmas.filter((r) => r.userId).map((r) => ({ id: r.userId!, name: r.name }));

  const Row = ({ r }: { r: GroupRowView }) =>
    r.list ? (
      <li>
        <Link
          href={`/gyfte/${r.list.id}${keep({})}`}
          className={`${rowCls} ${r.nested ? "pl-6" : ""} hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
        >
          <span className={r.nested ? "" : "font-semibold"}>
            {r.nested && <span aria-hidden className="text-soft">↳ </span>}
            {r.name}
            {r.isYou && <span className="font-normal text-soft"> (you)</span>}
          </span>
          <span className="shrink-0 text-accent">
            {r.list.gifts} {r.list.gifts === 1 ? "gift" : "gifts"} ›
          </span>
        </Link>
      </li>
    ) : (
    <li className={`${rowCls} ${r.nested ? "pl-6" : ""}`}>
      <span className={r.nested ? "" : "font-semibold"}>
        {r.nested && <span aria-hidden className="text-soft">↳ </span>}
        {r.latest ? (
          <Link
            href={`/gyfte/${r.latest.id}${keep({})}`}
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {r.name}
          </Link>
        ) : (
          r.name
        )}
        {r.isYou && <span className="font-normal text-soft"> (you)</span>}
      </span>
      {r.isYou && !previewName && thisYearIsCurrent ? (
        <StartMyList groupId={page.id} year={page.year} />
      ) : r.kidId && r.canStart && !previewName && thisYearIsCurrent ? (
        <StartKidList groupId={page.id} kidIds={[r.kidId]} year={page.year} />
      ) : r.latest ? (
        <Link href={`/gyfte/${r.latest.id}${keep({})}`} className="min-h-11 shrink-0 content-center text-sm text-accent underline-offset-4 hover:underline">
          {r.latest.year} list ›
        </Link>
      ) : (
        <span className="text-sm text-soft">No list yet</span>
      )}
    </li>
  );

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        {previewName && <ViewAsBanner name={previewName} exitHref={`/gyfte/groups/${page.id}${keep({ year: page.year }).replace(/as=[^&]*&?/, "")}`} />}
        {!previewName && <GyfteNav current="family" />}
        <div>
          <h1 className="title break-words">{page.name}</h1>
          {page.isSample && <p className="text-sm text-soft">Made-up people and lists, only visible to you. Delete it any time.</p>}
        </div>

        {imported === "1" && !previewName && (
          <p role="status" className="rounded-[var(--radius-control)] bg-wash px-4 py-3 text-sm">
            Import done ✓ These lists are shared with everyone in {page.name}. Past years are read-only.
          </p>
        )}

        {page.years.length > 1 && (
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
        )}

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
                <Row key={r.list!.id} r={r} />
              ))}
            </ul>
          </section>
        )}

        {!previewName && (thisYearIsCurrent || actor.isAdmin) && (
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">
              Manage
              {requests.length > 0 && (
                <span className="ml-2 rounded-[var(--radius-control)] bg-ember px-2 py-0.5 text-sm text-page">
                  {requests.length} {requests.length === 1 ? "request" : "requests"}
                </span>
              )}
            </summary>
            <div className="mt-4 flex flex-col gap-8">
        {actor.isAdmin && !page.isSample && <JoinRequests requests={requests} />}
        {thisYearIsCurrent && (
          <YourKids
            groupId={page.id}
            year={page.year}
            kids={kids}
            members={members}
            canStartJoint={page.myKids.length > 1 && !page.hasJointForMyKids}
          />
        )}

        {actor.isAdmin && (
          <div className="flex flex-col gap-6">
            {!page.isSample && <FamilyLink groupId={page.id} url={linkToken ? `${siteUrl()}/j/${linkToken}` : null} />}
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
            </div>
          </details>
        )}
      </main>
    </>
  );
}
