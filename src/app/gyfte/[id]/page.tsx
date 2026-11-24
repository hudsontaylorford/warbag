import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGyfte } from "@/lib/gyfte/page";
import { AccessDenied, copyTargetYear, getList, previousItems, yearsOf } from "@/lib/gyfte/data";
import { occasionLabel } from "@/lib/gyfte/occasions";
import { storeName } from "@/lib/gyfte/links";
import { atLeast } from "@/lib/access/roles";
import { AppHeader } from "@/components/shell/AppHeader";
import { viewerFor } from "@/lib/gyfte/groups";
import { ViewAsBanner } from "../groups/[id]/ViewAs";
import { CheckboxListForm, ConfirmForm, Section } from "@/components/ui/forms";
import { AddBox } from "./AddBox";
import { ListTitle } from "../ListTitle";
import { ItemRow } from "./ItemRow";
import { ListSettings } from "./ListSettings";
import { ShareSection } from "./ShareSection";
import { sharingFor } from "@/lib/gyfte/sharing";
import { siteUrl } from "@/lib/site";
import { bringForwardAction, copyForwardAction, deleteListAction } from "../actions";

export const metadata: Metadata = { title: "List · Gyfte" };

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; as?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const wantsHistoryEdit = sp.edit === "history";
  const { user, actor: me } = await requireGyfte(`/gyfte/${id}`);
  // "View as" (admins, made-up sample people only) renders read-only as them.
  const { viewer: actor, previewName } = await viewerFor(me, sp.as);
  const asQ = previewName ? `?as=${sp.as}` : "";
  const list = await getList(actor, id).catch((err) => {
    if (err instanceof AccessDenied) notFound();
    throw err;
  });
  const canManage = !previewName && atLeast(list.role, "manage");
  // Past lists are read-only until the manager turns on Edit history.
  const editHistory = list.past && canManage && wantsHistoryEdit;
  const canEdit = canManage && (!list.past || editHistory);
  const hidden: Record<string, string> = editHistory ? { history: "1" } : {};
  const copyYear = !previewName && list.canCopyForward ? copyTargetYear(list.occasion, list.occasionDate) : null;
  const wanted = list.items.filter((i) => !i.receivedAt);
  const received = list.items.filter((i) => i.receivedAt);
  const previous = canEdit && !list.past && list.items.length === 0 ? await previousItems(actor, list.id) : null;
  // Sharing doesn't change the record, so it stays available on past lists.
  const sharing = canManage ? await sharingFor(actor, list.id) : null;
  const years = await yearsOf(actor, list.id);
  const at = years.findIndex((y) => y.current);
  const prev = at > 0 ? years[at - 1] : null;
  const next = at >= 0 && at < years.length - 1 ? years[at + 1] : null;

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" letter="G" appHref="/gyfte" isAdmin={me.isAdmin} people={user.isPeopleManager === true} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
        {previewName && <ViewAsBanner name={previewName} exitHref={`/gyfte/${list.id}`} />}
        <div>
          <Link
            href={list.groupId ? `/gyfte/groups/${list.groupId}${asQ}` : "/gyfte"}
            className="text-accent underline-offset-4 hover:underline"
          >
            {list.groupId ? "‹ Family" : "‹ My list"}
          </Link>
          <ListTitle title={list.title} className="mt-2" />
          <p className="text-soft">{formatDay(list.occasionDate)}</p>
          {(prev || next) && (
            <nav aria-label="Other years" className="mt-2 flex items-center gap-4 text-sm">
              {prev ? (
                <Link href={`/gyfte/${prev.id}${asQ}`} className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
                  ‹ {prev.year}
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link href={`/gyfte/${next.id}${asQ}`} className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
                  {next.year} ›
                </Link>
              )}
            </nav>
          )}
        </div>

        {list.past && canManage && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] bg-wash px-4 py-3">
            <p className="text-sm">
              {editHistory ? "Editing history. Changes save to this past list." : "This list is in History, so it's read-only."}
            </p>
            <Link
              href={editHistory ? `/gyfte/${list.id}` : `/gyfte/${list.id}?edit=history`}
              className="min-h-11 content-center text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
              {editHistory ? "Done" : "Edit history"}
            </Link>
          </div>
        )}

        {canEdit && <AddBox listId={list.id} history={editHistory} />}

        {previous && (
          <Section title={`Bring gifts forward from ${previous.title}?`} hint="Untick anything you don't want anymore.">
            <CheckboxListForm
              action={bringForwardAction}
              id={list.id}
              legend="Gifts to bring forward"
              options={previous.items.map((i) => ({ value: i.id, label: i.name }))}
              selected={previous.items.map((i) => i.id)}
              submitLabel="Bring forward"
            />
          </Section>
        )}

        {wanted.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line">
            {wanted.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} store={item.links[0] ? storeName(item.links[0]) : ""} canEdit={canEdit} canClaim={list.claims.canClaim} history={editHistory} readOnly={Boolean(previewName)} />
              </li>
            ))}
          </ul>
        ) : (
          !previous && <p className="text-soft">No gifts on this list yet.</p>
        )}

        {received.length > 0 && (
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">Got it ({received.length})</summary>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {received.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} store={item.links[0] ? storeName(item.links[0]) : ""} canEdit={canEdit} canClaim={list.claims.canClaim} history={editHistory} readOnly={Boolean(previewName)} />
                </li>
              ))}
            </ul>
          </details>
        )}

        {copyYear && !editHistory && list.items.length > 0 && (
          <Section
            title={`Copy to ${copyYear}`}
            hint={`Copies the gifts you pick to ${list.recipientName}'s ${occasionLabel(list.occasion, `${copyYear}-01-01`)} list (made if needed${list.groupName ? `, in ${list.groupName}` : ""}). Claims aren't copied, gifts already there are skipped, and this list stays as it is.`}
          >
            <CheckboxListForm
              action={copyForwardAction}
              id={list.id}
              legend="Gifts to copy"
              options={list.items.map((i) => ({ value: i.id, label: i.receivedAt ? `${i.name} (got it)` : i.name }))}
              selected={list.items.filter((i) => !i.receivedAt).map((i) => i.id)}
              submitLabel={`Copy to ${copyYear}`}
            />
          </Section>
        )}

        {sharing && <ShareSection listId={list.id} sharing={sharing} siteUrl={siteUrl()} />}

        {canEdit && (
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold">List settings</summary>
            <div className="mt-4 flex flex-col gap-8">
              <ListSettings
                listId={list.id}
                recipientName={list.recipientName}
                date={list.occasionDate}
                claimsMode={list.claimsMode}
                history={editHistory}
              />
              <Section title="Delete list">
                <ConfirmForm
                  action={deleteListAction}
                  id={list.id}
                  label="Delete"
                  consequence={`${list.title} and all its gifts will be deleted for everyone. This can't be undone.`}
                  hidden={hidden}
                />
              </Section>
            </div>
          </details>
        )}
      </main>
    </>
  );
}
