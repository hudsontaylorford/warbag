import Link from "next/link";

export type GyfteView = "mine" | "family" | "getting";

const views: { id: GyfteView; label: string; href: string }[] = [
  { id: "mine", label: "My list", href: "/gyfte" },
  { id: "family", label: "Family", href: "/gyfte/family" },
  { id: "getting", label: "I'm getting", href: "/gyfte/claims" },
];

/** The three everyday places in Gyfte. Organizer tools live under Manage, not here. */
export function GyfteNav({ current }: { current: GyfteView | null }) {
  return (
    <nav aria-label="Gyfte" className="-mx-1 flex gap-1 border-b border-line">
      {views.map((v) => {
        const on = v.id === current;
        return (
          <Link
            key={v.id}
            href={v.href}
            aria-current={on ? "page" : undefined}
            className={
              "-mb-px flex min-h-12 items-center border-b-2 px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (on ? "border-ink text-ink" : "border-transparent text-soft hover:text-ink")
            }
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
