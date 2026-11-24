import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGyfte } from "@/lib/gyfte/page";
import { AccessDenied } from "@/lib/access";
import { getImportDraft } from "@/lib/gyfte/imports";
import { groupPage, myGroups } from "@/lib/gyfte/groups";
import { AppHeader } from "@/components/shell/AppHeader";
import { ReviewForm, type TabDefault } from "./ReviewForm";

export const metadata: Metadata = { title: "Review import · Gyfte" };

const first = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
const SIBLINGS = /\s+(?:and|&)\s+|,\s*/i;

export default async function ReviewImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const { id } = await params;
  const { group: wantGroup } = await searchParams;
  const { user, actor } = await requireGyfte(`/gyfte/import/${id}`, { needCreate: true });
  const draft = await getImportDraft(actor, id).catch((err) => {
    if (err instanceof AccessDenied) notFound();
    throw err;
  });
  if (draft.appliedAt) notFound();

  const groups = (await myGroups(actor)).filter((g) => !g.isSample);
  const groupId = groups.find((g) => g.id === wantGroup)?.id ?? groups[0]?.id ?? "";
  // Every group's people up front, so switching groups on the review never
  // reloads the page (which used to reset the choices already made).
  const membersByGroup: Record<string, { id: string; name: string }[]> = {};
  for (const g of groups) {
    membersByGroup[g.id] = (await groupPage(actor, g.id)).christmas
      .filter((r) => r.userId)
      .map((r) => ({ id: r.userId!, name: r.name }));
  }
  const members = membersByGroup[groupId] ?? [];

  const items = draft.sheet.lists.flatMap((l) => l.items);
  const people = [...new Set(draft.sheet.lists.map((l) => l.person))];
  const years = draft.sheet.lists.map((l) => l.year);
  const myName = user.name || "";

  // Starting guesses, all changeable: your tab is you, members match by first
  // name, a tab naming two people ("A and B") is kids to split.
  const defaults: Record<string, TabDefault> = {};
  for (const p of people) {
    if (myName && (p.toLowerCase() === myName.toLowerCase() || first(p) === first(myName))) {
      defaults[p] = { who: "me" };
    } else if (SIBLINGS.test(p)) {
      defaults[p] = { who: "split", parentId: "", kids: p.split(SIBLINGS).map((s) => s.trim()).filter(Boolean) };
    } else {
      const m = members.find((x) => x.id !== actor.id && first(x.name) === first(p));
      defaults[p] = m ? { who: "member", userId: m.id } : { who: "name" };
    }
  }

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" letter="G" appHref="/gyfte" isAdmin={actor.isAdmin} people={actor.peopleManager} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <div>
          <Link href="/gyfte" className="text-accent underline-offset-4 hover:underline">
            ‹ Lists
          </Link>
          <h1 className="mt-2 title">Review import</h1>
          <p className="text-soft break-words">{draft.fileName}</p>
        </div>
        <p>
          Found <span className="font-semibold">{items.length} gifts</span> for {people.length}{" "}
          {people.length === 1 ? "person" : "people"}, {Math.min(...years)} to {Math.max(...years)}.{" "}
          {items.filter((i) => i.received).length} were marked as received and{" "}
          {items.filter((i) => !i.include).length} look like headings (unticked). For each person, check who they are, then
          untick anything you don&apos;t want.
        </p>
        {(draft.sheet.skippedRows.length > 0 || draft.sheet.skippedTabs.length > 0) && (
          <details>
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">
              Left out ({draft.sheet.skippedRows.length + draft.sheet.skippedTabs.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-soft">
              {draft.sheet.skippedTabs.map((t) => (
                <li key={t}>Tab &quot;{t}&quot;: not a gift list</li>
              ))}
              {draft.sheet.skippedRows.map((s) => (
                <li key={`${s.person}-${s.row}`}>
                  {s.person}, row {s.row}: {s.reason} ({s.text})
                </li>
              ))}
            </ul>
          </details>
        )}
        <ReviewForm
          draftId={draft.id}
          lists={draft.sheet.lists}
          existing={draft.existing}
          people={people}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          initialGroupId={groupId}
          membersByGroup={membersByGroup}
          meId={actor.id}
          defaults={defaults}
        />
      </main>
    </>
  );
}
