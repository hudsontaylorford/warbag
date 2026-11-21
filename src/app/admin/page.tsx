import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page";
import { listGroups, listPeople } from "@/lib/people";
import { AppHeader } from "@/components/shell/AppHeader";
import { Section } from "@/components/ui/forms";
import { InviteForm } from "./InviteForm";
import { NewGroupForm } from "./NewGroupForm";

export const metadata: Metadata = { title: "People · warbag" };

const rowLink =
  "flex min-h-14 items-center justify-between gap-4 py-2 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default async function AdminPage() {
  const { user, actor } = await requireAdminPage("/admin");
  const [people, groups] = await Promise.all([listPeople(actor), listGroups(actor)]);

  return (
    <>
      <AppHeader email={user.email} app="People" isAdmin />
      <main className="mx-auto flex max-w-xl flex-col gap-10 px-4 py-8">
        <Section title="Invite someone" hint="They can sign in right away, but see no apps until you give them some.">
          <InviteForm />
        </Section>

        <Section title="People">
          <ul className="divide-y divide-line border-y border-line">
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/people/${p.id}`} className={rowLink}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{p.name || p.email}</span>
                    <span className="truncate text-sm text-soft">
                      {[p.name ? p.email : null, p.isAdmin ? "Admin" : null, ...p.groups].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-soft">{p.lastSignIn ? "" : "Not signed in yet"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Groups" hint="Share apps and items with a whole group at once.">
          {groups.length > 0 && (
            <ul className="divide-y divide-line border-y border-line">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/admin/groups/${g.id}`} className={rowLink}>
                    <span className="font-semibold">{g.name}</span>
                    <span className="text-sm text-soft">
                      {g.members} {g.members === 1 ? "person" : "people"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <NewGroupForm />
        </Section>
      </main>
    </>
  );
}
