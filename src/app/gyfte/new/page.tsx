import type { Metadata } from "next";
import Link from "next/link";
import { requireGyfte } from "@/lib/gyfte/page";
import { suggestedDate } from "@/lib/gyfte/data";
import { AppHeader } from "@/components/shell/AppHeader";
import { NewListForm } from "./NewListForm";

export const metadata: Metadata = { title: "New list · Gyfte" };

export default async function NewListPage() {
  const { user, actor } = await requireGyfte("/gyfte/new", { needCreate: true });
  // Your account name; never guessed from your email. Blank until you set one.
  const myName = user.name?.trim() ?? "";
  const myBirthday = await suggestedDate(actor, "birthday", { me: true, name: myName });

  return (
    <>
      <AppHeader email={user.email} app="Gyfte" isAdmin={actor.isAdmin} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <div>
          <Link href="/gyfte" className="text-accent underline-offset-4 hover:underline">
            ‹ Lists
          </Link>
          <h1 className="mt-2 title">New list</h1>
        </div>
        <NewListForm myName={myName} myBirthday={myBirthday} />
      </main>
    </>
  );
}
