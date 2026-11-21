import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-page";
import { getPerson, listGroups, removalImpact } from "@/lib/people";
import { APPS } from "@/lib/apps";
import { AppHeader } from "@/components/shell/AppHeader";
import { CheckboxListForm, ConfirmForm, Section, TextForm } from "@/components/ui/forms";
import {
  removePersonAction,
  renamePersonAction,
  setPersonAppsAction,
  setPersonGroupsAction,
} from "../../actions";

export const metadata: Metadata = { title: "Person · warbag" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireAdminPage(`/admin/people/${id}`);
  const [person, groups] = await Promise.all([getPerson(actor, id), listGroups(actor)]);
  if (!person) notFound();
  const isMe = person.id === user.id;
  const impact = isMe ? null : await removalImpact(actor, person.id);
  const who = person.name || person.email;
  const removeText = [
    `${who} will be signed out and lose access to everything shared with them. Their share links stop working.`,
    impact && impact.lists > 0
      ? `The ${impact.lists} Gyfte ${impact.lists === 1 ? "list" : "lists"} they manage will move to you.`
      : "",
    impact && impact.claims > 0
      ? `The ${impact.claims} ${impact.claims === 1 ? "gift" : "gifts"} they said they'd get will become unclaimed.`
      : "",
    "This can't be undone, but you can invite them again.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <AppHeader email={user.email} app="People" isAdmin />
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-8">
        <div>
          <Link href="/admin" className="text-accent underline-offset-4 hover:underline">
            ‹ People
          </Link>
          <h1 className="mt-2 title break-words">{person.name || person.email}</h1>
          <p className="text-soft break-words">
            {person.email}
            {person.isAdmin && " · Admin"}
          </p>
        </div>

        <Section title="Name">
          <TextForm action={renamePersonAction} id={person.id} label="Name" value={person.name} />
        </Section>

        <Section
          title="Apps"
          hint={person.isAdmin ? "Admins can use every app." : "Apps given to this person directly. Their groups can add more."}
        >
          <CheckboxListForm
            action={setPersonAppsAction}
            id={person.id}
            legend="Apps"
            options={APPS.map((a) => ({ value: a.id, label: a.name, hint: a.description, disabled: person.isAdmin }))}
            selected={person.isAdmin ? APPS.map((a) => a.id) : person.apps}
          />
        </Section>

        <Section title="Groups">
          <CheckboxListForm
            action={setPersonGroupsAction}
            id={person.id}
            legend="Groups"
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
            selected={person.groupIds}
            empty="No groups yet. Create one on the People page."
          />
        </Section>

        {!isMe && (
          <Section title="Remove from warbag">
            <ConfirmForm
              action={removePersonAction}
              id={person.id}
              label="Remove"
              consequence={removeText}
            />
          </Section>
        )}
      </main>
    </>
  );
}
