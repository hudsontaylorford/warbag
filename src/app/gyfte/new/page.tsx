import type { Metadata } from "next";
import Link from "next/link";
import { requireGyfte } from "@/lib/gyfte/page";
import { suggestedDate } from "@/lib/gyfte/data";
import { AppHeader } from "@/components/shell/AppHeader";
import { NewListForm } from "./NewListForm";

export const metadata: Metadata = { title: "New list · Gyfte" };

export default async function NewListPage() {
  const { user, actor } = await requireGyfte("/gyfte/new");
  const myName = user.name || user.email.split("@")[0].replace(/^./, (c) => c.toUpperCase());
  const myBirthday = await suggestedDate(actor, "birthday", { me: true, name: myName });

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <div>
          <Link href="/gyfte" className="text-accent underline-offset-4 hover:underline">
            ‹ Lists
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">New list</h1>
        </div>
        <NewListForm myName={myName} myBirthday={myBirthday} />
      </main>
    </>
  );
}
