import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGyfte } from "@/lib/gyfte/page";
import { AccessDenied } from "@/lib/access";
import { getImportDraft } from "@/lib/gyfte/imports";
import { AppHeader } from "@/components/shell/AppHeader";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = { title: "Review import · Gyfte" };

export default async function ReviewImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireGyfte(`/gyfte/import/${id}`, { needCreate: true });
  const draft = await getImportDraft(actor, id).catch((err) => {
    if (err instanceof AccessDenied) notFound();
    throw err;
  });
  if (draft.appliedAt) notFound();

  const items = draft.sheet.lists.flatMap((l) => l.items);
  const people = [...new Set(draft.sheet.lists.map((l) => l.person))];
  const years = draft.sheet.lists.map((l) => l.year);
  const myName = (user.name || user.email.split("@")[0]).toLowerCase();
  const me = people.find((p) => p.toLowerCase() === myName) ?? "";

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <div>
          <Link href="/gyfte" className="text-accent underline-offset-4 hover:underline">
            ‹ Lists
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Review import</h1>
          <p className="text-soft break-words">{draft.fileName}</p>
        </div>
        <p>
          Found <span className="font-semibold">{items.length} gifts</span> for {people.length}{" "}
          {people.length === 1 ? "person" : "people"}, {Math.min(...years)} to {Math.max(...years)}.{" "}
          {items.filter((i) => i.received).length} were marked as received and{" "}
          {items.filter((i) => !i.include).length} look like headings (unticked). Untick anything you don&apos;t want.
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
        <ReviewForm draftId={draft.id} lists={draft.sheet.lists} existing={draft.existing} people={people} me={me} />
      </main>
    </>
  );
}
