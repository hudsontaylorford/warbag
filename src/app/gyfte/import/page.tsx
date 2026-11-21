import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireGyfte } from "@/lib/gyfte/page";
import { openDraftId } from "@/lib/gyfte/imports";
import { AppHeader } from "@/components/shell/AppHeader";
import { UploadForm } from "./UploadForm";

export const metadata: Metadata = { title: "Import · Gyfte" };

export default async function ImportPage() {
  const { user, actor } = await requireGyfte("/gyfte/import", { needCreate: true });
  const open = await openDraftId(actor);
  if (open) redirect(`/gyfte/import/${open}`);

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <div>
          <Link href="/gyfte" className="text-accent underline-offset-4 hover:underline">
            ‹ Lists
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Import a gift spreadsheet</h1>
        </div>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            Open the spreadsheet in Google Sheets and choose <span className="font-semibold">File, Download, Microsoft Excel (.xlsx)</span>.
          </li>
          <li>Choose that file below. Nothing is added yet: you&apos;ll review everything first.</li>
        </ol>
        <p className="text-sm text-soft">
          Each person&apos;s tab becomes one Christmas list per year. Imported lists are private to you until you share
          them. Your spreadsheet isn&apos;t changed.
        </p>
        <UploadForm />
      </main>
    </>
  );
}
