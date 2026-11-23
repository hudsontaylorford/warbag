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
  setPeopleManagerAction,
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
  // A people manager can't change its own access or an admin's (checked on the server too).
  const locked = !actor.isAdmin && (isMe || person.isAdmin);
  const impact = isMe || !actor.isAdmin ? null : await removalImpact(actor, person.id);
  const who = person.name || person.email;
  const removeText = [
    `${who} will be signed out and lose access to everything shared with them. Their share links stop working.`,
    impact && impact.lists > 0
      ? `The ${impact.lists} Gyfte ${impact.lists === 1 ? "list" : "lists"} they manage will move to you.`
      : "",
    impact && impact.trips > 0
      ? `The ${impact.trips} Mosey ${impact.trips === 1 ? "trip" : "trips"} they organize will move to you, with everything on them.`
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
      <AppHeader email={user.email} app="People" isAdmin={actor.isAdmin} people />
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-8">
        <div>
          <Link href="/admin" className="text-accent underline-offset-4 hover:underline">
            ‹ People
          </Link>
          <h1 className="mt-2 title break-words">{person.name || person.email}</h1>
          <p className="text-soft break-words">
            {person.email}
            {person.isAdmin && " · Admin"}
            {person.peopleManager && " · People manager"}
          </p>
        </div>

        <Section title="Name">
          <TextForm action={renamePersonAction} id={person.id} label="Name" value={person.name} />
        </Section>

        {locked && (
          <p className="text-sm text-soft">{isMe ? "Your own apps and groups are set by an admin." : "Only admins can change an admin's apps and groups."}</p>
        )}
        {!locked && (
        <Section
          title="Apps"
          hint={person.isAdmin ? "Admins can use every app." : "Apps given to this person directly. Their groups can add more. This doesn't put them on a trip: add them from that trip's Manage."}
        >
          <CheckboxListForm
            action={setPersonAppsAction}
            id={person.id}
            legend="Apps"
            options={APPS.map((a) => ({ value: a.id, label: a.name, hint: a.description, disabled: person.isAdmin }))}
            selected={person.isAdmin ? APPS.map((a) => a.id) : person.apps}
          />
        </Section>
        )}

        {!locked && (
          <Section title="Groups" hint="They also get anything shared with these groups, like a trip shared with the whole group.">
            <CheckboxListForm
              action={setPersonGroupsAction}
              id={person.id}
              legend="Groups"
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              selected={person.groupIds}
              empty="No groups yet. Create one on the People page."
            />
          </Section>
        )}

        {actor.isAdmin && !isMe && !person.isAdmin && (
          <Section
            title="People manager"
            hint="Can invite people, rename them, manage groups and give app access. Can't change their own access or an admin's, remove people, delete groups or make admins. For a helper or an assistant."
          >
            <CheckboxListForm
              action={setPeopleManagerAction}
              id={person.id}
              legend="People manager"
              options={[{ value: "on", label: "People manager" }]}
              selected={person.peopleManager ? ["on"] : []}
            />
          </Section>
        )}

        {actor.isAdmin && !isMe && (
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
