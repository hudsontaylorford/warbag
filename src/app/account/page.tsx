import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { AppHeader } from "@/components/shell/AppHeader";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { Section } from "@/components/ui/forms";
import { NameForm } from "./NameForm";
import { backFrom } from "@/lib/back";
import { BackLink } from "@/components/shell/BackLink";

export const metadata: Metadata = { title: "Account · warbag" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const user = await requireUser("/account");
  const back = await backFrom({ id: user.id, isAdmin: user.isAdmin === true, peopleManager: user.isPeopleManager === true }, (await searchParams).from);
  return (
    <>
      <AppHeader email={user.email} app="Account" letter="A" appHref="/account" isAdmin={user.isAdmin === true} people={user.isPeopleManager === true} />
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-8">
        <div className="flex flex-col">
          <BackLink back={back} />
          <h1 className="title">Account</h1>
        </div>
        <NameForm name={user.name ?? ""} />
        {user.isGuest ? (
          <Section title="Signing in">
            <p className="text-sm text-soft">You joined a trip by its link, so there&apos;s no email here. This device remembers you; on another device, open your own link from the trip.</p>
          </Section>
        ) : (
          <Section title="Email">
            <p className="break-words">{user.email}</p>
            <p className="text-sm text-soft">You sign in with a code sent here.</p>
          </Section>
        )}
        <div className="max-w-xs">
          <SignOutButton />
        </div>
      </main>
    </>
  );
}
