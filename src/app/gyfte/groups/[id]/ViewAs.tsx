"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Admin-only, sample groups only: see the group as a made-up person would. */
export function ViewAsPicker({ groupId, year, people }: { groupId: string; year: string; people: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">View as</span>
      <select
        defaultValue=""
        onChange={(e) => e.target.value && router.push(`/gyfte/groups/${groupId}?year=${year}&as=${e.target.value}`)}
        className="min-h-13 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base"
      >
        <option value="">Pick a made-up person…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="text-sm text-soft">See exactly what they&apos;d see, read-only. Their own claims stay hidden from them.</span>
    </label>
  );
}

export function ViewAsBanner({ name, exitHref }: { name: string; exitHref: string }) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-ink px-4 py-3 text-page">
      <span className="text-sm">
        Viewing as <span className="font-semibold">{name}</span>. Read-only.
      </span>
      <Link href={exitHref} className="min-h-11 content-center text-sm font-semibold underline underline-offset-4">
        Stop
      </Link>
    </div>
  );
}
