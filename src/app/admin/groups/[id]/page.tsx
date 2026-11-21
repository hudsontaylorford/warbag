import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-page";
import { getGroup, listPeople } from "@/lib/people";
import { APPS } from "@/lib/apps";
import { AppHeader } from "@/components/shell/AppHeader";
import { CheckboxListForm, ConfirmForm, Section, TextForm } from "@/components/ui/forms";
import { deleteGroupAction, renameGroupAction, setGroupAppsAction, setGroupMembersAction } from "../../actions";

export const metadata: Metadata = { title: "Group · warbag" };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, actor } = await requireAdminPage(`/admin/groups/${id}`);
  const [group, people] = await Promise.all([getGroup(actor, id), listPeople(actor)]);
  if (!group) notFound();

  return (
    <>
      <AppHeader email={user.email} app="People" isAdmin />
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-8">
        <div>
          <Link href="/admin" className="text-accent underline-offset-4 hover:underline">
            ‹ People
          </Link>
          <h1 className="mt-2 title break-words">{group.name}</h1>
          <p className="text-soft">
            {group.memberIds.length} {group.memberIds.length === 1 ? "person" : "people"}
          </p>
        </div>

        <Section title="People">
          <CheckboxListForm
            action={setGroupMembersAction}
            id={group.id}
            legend="People in this group"
            options={people.map((p) => ({ value: p.id, label: p.name || p.email, hint: p.name ? p.email : undefined }))}
            selected={group.memberIds}
          />
        </Section>

        <Section title="Apps" hint="Everyone in the group can use these.">
          <CheckboxListForm
            action={setGroupAppsAction}
            id={group.id}
            legend="Apps"
            options={APPS.map((a) => ({ value: a.id, label: a.name, hint: a.description }))}
            selected={group.apps}
          />
        </Section>

        <Section title="Name">
          <TextForm action={renameGroupAction} id={group.id} label="Group name" value={group.name} required />
        </Section>

        <Section title="Delete group">
          <ConfirmForm
            action={deleteGroupAction}
            id={group.id}
            label="Delete"
            consequence={`Everyone in ${group.name} loses the apps and items shared with the group. The people themselves stay on warbag.`}
          />
        </Section>
      </main>
    </>
  );
}
