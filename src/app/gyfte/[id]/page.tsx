import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGyfte } from "@/lib/gyfte/page";
import { AccessDenied, getList, previousItems, yearsOf } from "@/lib/gyfte/data";
import { storeName } from "@/lib/gyfte/links";
import { atLeast } from "@/lib/access/roles";
import { AppHeader } from "@/components/shell/AppHeader";
import { CheckboxListForm, ConfirmForm, Section } from "@/components/ui/forms";
import { AddBox } from "./AddBox";
import { ItemRow } from "./ItemRow";
import { ListSettings } from "./ListSettings";
import { ShareSection } from "./ShareSection";
import { sharingFor } from "@/lib/gyfte/sharing";
import { siteUrl } from "@/lib/site";
import { bringForwardAction, deleteListAction } from "../actions";

export const metadata: Metadata = { title: "List · Gyfte" };

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireGyfte(`/gyfte/${id}`);
  const list = await getList(actor, id).catch((err) => {
    if (err instanceof AccessDenied) notFound();
    throw err;
  });
  const canEdit = atLeast(list.role, "manage");
  const wanted = list.items.filter((i) => !i.receivedAt);
  const received = list.items.filter((i) => i.receivedAt);
  const previous = canEdit && list.items.length === 0 ? await previousItems(actor, list.id) : null;
  const sharing = canEdit ? await sharingFor(actor, list.id) : null;
  const years = await yearsOf(actor, list.id);
  const at = years.findIndex((y) => y.current);
  const prev = at > 0 ? years[at - 1] : null;
  const next = at >= 0 && at < years.length - 1 ? years[at + 1] : null;

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-8">
        <div>
          <Link href="/gyfte" className="text-accent underline-offset-4 hover:underline">
            ‹ Lists
          </Link>
          <h1 className="mt-2 text-2xl font-semibold break-words">{list.title}</h1>
          <p className="text-soft">{formatDay(list.occasionDate)}</p>
          {(prev || next) && (
            <nav aria-label="Other years" className="mt-2 flex items-center gap-4 text-sm">
              {prev ? (
                <Link href={`/gyfte/${prev.id}`} className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
                  ‹ {prev.year}
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link href={`/gyfte/${next.id}`} className="min-h-11 content-center text-accent underline-offset-4 hover:underline">
                  {next.year} ›
                </Link>
              )}
            </nav>
          )}
        </div>

        {canEdit && <AddBox listId={list.id} />}

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
                <ItemRow item={item} store={item.links[0] ? storeName(item.links[0]) : ""} canEdit={canEdit} canClaim={list.claims.canClaim} />
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
                  <ItemRow item={item} store={item.links[0] ? storeName(item.links[0]) : ""} canEdit={canEdit} canClaim={list.claims.canClaim} />
                </li>
              ))}
            </ul>
          </details>
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
              />
              <Section title="Delete list">
                <ConfirmForm
                  action={deleteListAction}
                  id={list.id}
                  label="Delete"
                  consequence={`${list.title} and all its gifts will be deleted for everyone. This can't be undone.`}
                />
              </Section>
            </div>
          </details>
        )}
      </main>
    </>
  );
}
