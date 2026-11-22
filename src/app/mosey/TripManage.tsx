import type { TripDetail, TripSharing } from "@/lib/mosey/trips";
import { CheckboxListForm, ConfirmForm, Section } from "@/components/ui/forms";
import { TripForm } from "./TripForm";
import { TripLink } from "./TripLink";
import { deleteTripAction, setMembersAction } from "./actions";

/** Organizer tools, closed by default: details, who's on the trip, the view link, delete. */
export function TripManage({ trip, sharing, siteUrl }: { trip: TripDetail; sharing: TripSharing; siteUrl: string }) {
  const options = [
    ...sharing.groups.map((g) => ({ value: `g:${g.id}`, label: g.name, hint: "Group" })),
    ...sharing.people.map((p) => ({ value: `p:${p.id}`, label: p.name })),
  ];
  const selected = sharing.members.map((m) => `${m.kind === "group" ? "g" : "p"}:${m.id}`);
  return (
    <details>
      <summary className="min-h-11 cursor-pointer content-center font-semibold">Manage</summary>
      <div className="mt-4 flex flex-col gap-8">
        <Section title="Who's on the trip" hint="Members can see everything here, add ideas and suggest a day. You put things on the plan.">
          <CheckboxListForm
            action={setMembersAction}
            id={trip.id}
            legend="Members"
            options={options}
            selected={selected}
            empty="Nobody to add yet. Add people under People first."
          />
        </Section>
        <TripLink tripId={trip.id} links={sharing.links} siteUrl={siteUrl} />
        <Section title="Trip details">
          <TripForm trip={trip} />
        </Section>
        <Section title="Delete trip">
          <ConfirmForm
            action={deleteTripAction}
            id={trip.id}
            label="Delete"
            consequence={`${trip.name} and everything on its plan and ideas will be deleted for everyone. This can't be undone.`}
          />
        </Section>
      </div>
    </details>
  );
}
