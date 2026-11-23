import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { AppHeader } from "@/components/shell/AppHeader";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { Section } from "@/components/ui/forms";
import { NameForm } from "./NameForm";

export const metadata: Metadata = { title: "Account · warbag" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  return (
    <>
      <AppHeader email={user.email} app="Account" isAdmin={user.isAdmin === true} people={user.isPeopleManager === true} />
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-8">
        <h1 className="title">Account</h1>
        <NameForm name={user.name ?? ""} />
        <Section title="Email">
          <p className="break-words">{user.email}</p>
          <p className="text-sm text-soft">You sign in with a code sent here.</p>
        </Section>
        <div className="max-w-xs">
          <SignOutButton />
        </div>
      </main>
    </>
  );
}
