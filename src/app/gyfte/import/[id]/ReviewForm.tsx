"use client";

import { useActionState, useMemo, useState } from "react";
import type { ImportedList } from "@/lib/gyfte/sheet-import";
import { storeName } from "@/lib/gyfte/links";
import { applyImportAction, discardImportAction } from "../../actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export type TabDefault =
  | { who: "me" }
  | { who: "member"; userId: string }
  | { who: "kid"; parentId: string; kidName: string }
  | { who: "split"; parentId: string; kids: string[] }
  | { who: "name" }
  | { who: "skip" };

type Who = TabDefault["who"];
type TabState = { who: Who; userId: string; parentId: string; kidName: string; kids: string };

const select = "min-h-11 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base";

/** Every row from the sheet, grouped by person and year, with who each person is. */
export function ReviewForm({
  draftId,
  lists,
  existing,
  people,
  groups,
  initialGroupId,
  membersByGroup,
  meId,
  defaults,
}: {
  draftId: string;
  lists: ImportedList[];
  existing: string[];
  people: string[];
  groups: { id: string; name: string }[];
  initialGroupId: string;
  membersByGroup: Record<string, { id: string; name: string }[]>;
  meId: string;
  defaults: Record<string, TabDefault>;
}) {
  const [groupId, setGroupId] = useState(initialGroupId);
  const members = membersByGroup[groupId] ?? [];
  const [applyState, applyAction, applying] = useActionState(applyImportAction, {});
  const [discardState, discardAction, discarding] = useActionState(discardImportAction, {});
  const [keep, setKeep] = useState<Set<string>>(
    () => new Set(lists.filter((l) => !existing.includes(l.key)).flatMap((l) => l.items.filter((i) => i.include).map((i) => i.key))),
  );
  const [tabs, setTabs] = useState<Record<string, TabState>>(() =>
    Object.fromEntries(
      people.map((p) => {
        const d = defaults[p] ?? { who: "name" };
        return [
          p,
          {
            who: d.who,
            userId: d.who === "member" ? d.userId : "",
            parentId: d.who === "kid" || d.who === "split" ? d.parentId : "",
            kidName: d.who === "kid" ? d.kidName : p,
            kids: d.who === "split" ? d.kids.join(", ") : "",
          },
        ];
      }),
    ),
  );
  // Split tabs: which kid (or "both") each row goes to. Rows start as "both".
  const [rows, setRows] = useState<Record<string, string>>({});
  const byPerson = useMemo(() => people.map((p) => ({ person: p, lists: lists.filter((l) => l.person === p) })), [people, lists]);

  const kidNames = (p: string) =>
    tabs[p].kids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const plan = JSON.stringify({
    groupId: groupId || null,
    tabs: Object.fromEntries(
      people.map((p) => {
        const t = tabs[p];
        switch (t.who) {
          case "member":
            return [p, { who: "member", userId: t.userId }];
          case "kid":
            return [p, { who: "kid", parentId: t.parentId, kidName: t.kidName }];
          case "split":
            return [
              p,
              {
                who: "split",
                parentId: t.parentId,
                kids: kidNames(p),
                rows: Object.fromEntries(
                  lists.filter((l) => l.person === p).flatMap((l) => l.items.map((i) => [i.key, rows[i.key] ?? "both"])),
                ),
              },
            ];
          default:
            return [p, { who: t.who }];
        }
      }),
    ),
  });

  const update = (p: string, patch: Partial<TabState>) => setTabs({ ...tabs, [p]: { ...tabs[p], ...patch } });
  // Switching groups keeps every choice, except people who aren't in the new
  // group: those picks are cleared (and "someone in the group" needs a group).
  const changeGroup = (next: string) => {
    const inNext = new Set([meId, ...(membersByGroup[next] ?? []).map((m) => m.id)]);
    setGroupId(next);
    setTabs(
      Object.fromEntries(
        Object.entries(tabs).map(([p, t]) => {
          const fixed = { ...t };
          if (fixed.who === "member" && (!next || !inNext.has(fixed.userId))) {
            if (!next) fixed.who = "name";
            fixed.userId = "";
          }
          if (fixed.parentId && !inNext.has(fixed.parentId)) fixed.parentId = "";
          return [p, fixed];
        }),
      ),
    );
  };
  const toggle = (key: string, on: boolean) => {
    const next = new Set(keep);
    if (on) next.add(key);
    else next.delete(key);
    setKeep(next);
  };
  const people2 = [{ id: meId, name: "Me" }, ...members.filter((m) => m.id !== meId)];
  const keptCount = [...keep].filter((k) => tabs[k.split("|")[0]]?.who !== "skip").length;

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Put the lists in</span>
        <select
          value={groupId}
          onChange={(e) => changeGroup(e.target.value)}
          className={select}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value="">No group (private to me)</option>
        </select>
        <span className="text-sm text-soft">
          Lists in a group are shared with it. Past years stay read-only either way.
        </span>
      </label>

      <form action={applyAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={draftId} />
        <input type="hidden" name="plan" value={plan} />
        {[...keep].map((k) => (
          <input key={k} type="hidden" name="keep" value={k} />
        ))}

        <div className="flex flex-col divide-y divide-line border-y border-line">
          {byPerson.map(({ person, lists: theirs }) => {
            const t = tabs[person];
            const ticked = theirs.flatMap((l) => l.items).filter((i) => keep.has(i.key)).length;
            const kids = t.who === "split" ? kidNames(person) : [];
            return (
              <details key={person} className="py-2">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
                  <span className="font-semibold">{person}</span>
                  <span className="text-sm text-soft">
                    {t.who === "skip" ? "Skipped" : `${ticked} gifts, ${theirs.length} ${theirs.length === 1 ? "year" : "years"}`}
                  </span>
                </summary>

                <div className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-wash p-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">Who is this?</span>
                    <select value={t.who} onChange={(e) => update(person, { who: e.target.value as Who })} className={select}>
                      <option value="me">Me</option>
                      {groupId && <option value="member">Someone in the group</option>}
                      <option value="kid">A kid</option>
                      <option value="split">Kids together (split rows)</option>
                      <option value="name">Just a name (I manage it)</option>
                      <option value="skip">Skip this tab</option>
                    </select>
                  </label>
                  {t.who === "member" && (
                    <select aria-label={`Who ${person} is`} value={t.userId} onChange={(e) => update(person, { userId: e.target.value })} className={select}>
                      <option value="">Pick a person…</option>
                      {members.filter((m) => m.id !== meId).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {(t.who === "kid" || t.who === "split") && (
                    <select aria-label={`${person}'s parent`} value={t.parentId} onChange={(e) => update(person, { parentId: e.target.value })} className={select}>
                      <option value="">Parent…</option>
                      {people2.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {t.who === "kid" && (
                    <input aria-label="Kid's name" value={t.kidName} onChange={(e) => update(person, { kidName: e.target.value })} className={select} />
                  )}
                  {t.who === "split" && (
                    <label className="flex flex-col gap-1">
                      <span className="text-sm">Kids&apos; names, separated by commas</span>
                      <input value={t.kids} onChange={(e) => update(person, { kids: e.target.value })} className={select} />
                      <span className="text-sm text-soft">
                        Each row below goes to one kid, or to all of them on a joint list (so it&apos;s claimed once).
                      </span>
                    </label>
                  )}
                </div>

                {t.who !== "skip" && (
                  <div className="flex flex-col gap-4 py-2">
                    {theirs.map((list) => {
                      const already = existing.includes(list.key);
                      return (
                        <fieldset key={list.key} className="flex flex-col gap-1.5" disabled={already}>
                          <legend className="mb-1 text-sm font-semibold">
                            Christmas {list.year}
                            {list.yearAssumed && <span className="font-normal text-soft"> (no year in the sheet; newest year assumed)</span>}
                            {already && <span className="font-normal text-soft"> · already in Gyfte, skipped</span>}
                          </legend>
                          <div className="flex flex-col divide-y divide-line">
                            {list.items.map((item) => {
                              const detail = [
                                item.received ? "Got it" : "",
                                item.size,
                                item.color,
                                item.price,
                                item.links[0] ? storeName(item.links[0]) : "",
                                item.links.length > 1 ? `${item.links.length} links` : "",
                              ]
                                .filter(Boolean)
                                .join(" · ");
                              const text = `${item.name} ${item.notes} ${item.size}`.toLowerCase();
                              const mentions = kids.filter((k) => k && text.includes(k.toLowerCase()));
                              return (
                                <div key={item.key} className="flex flex-col gap-1 py-2">
                                  <label className="flex min-h-11 cursor-pointer items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={!already && keep.has(item.key)}
                                      onChange={(e) => toggle(item.key, e.target.checked)}
                                      className="mt-0.5 size-5 shrink-0 accent-ink"
                                    />
                                    <span className="flex min-w-0 flex-col">
                                      <span className="break-words">{item.name}</span>
                                      {detail && <span className="text-sm text-soft break-words">{detail}</span>}
                                      {item.flags.length > 0 && <span className="text-xs text-soft break-words">{item.flags.join(" · ")}</span>}
                                    </span>
                                  </label>
                                  {t.who === "split" && keep.has(item.key) && kids.length > 1 && (
                                    <div className="flex flex-wrap items-center gap-2 pl-8">
                                      <select
                                        aria-label={`Who ${item.name} is for`}
                                        value={rows[item.key] ?? "both"}
                                        onChange={(e) => setRows({ ...rows, [item.key]: e.target.value })}
                                        className="min-h-11 rounded-[var(--radius-control)] border border-line bg-field px-2 text-sm"
                                      >
                                        <option value="both">Both / all (joint list)</option>
                                        {kids.map((k) => (
                                          <option key={k} value={k}>
                                            {k}
                                          </option>
                                        ))}
                                      </select>
                                      {mentions.length > 0 && <span className="text-xs text-soft">Mentions {mentions.join(", ")}</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </fieldset>
                      );
                    })}
                  </div>
                )}
              </details>
            );
          })}
        </div>

        <p className="text-sm">
          {groupId
            ? `Everyone in ${groups.find((g) => g.id === groupId)?.name ?? "the group"} will see these lists. Claims stay hidden from the person each list is for.`
            : "Only you will see these lists until you share them."}
        </p>
        {applyState.error && <Alert>{applyState.error}</Alert>}
        <div className="max-w-sm">
          <Button type="submit" disabled={applying || keptCount === 0}>
            {applying ? "Importing…" : `Import ${keptCount} gifts`}
          </Button>
        </div>
      </form>

      <form action={discardAction} className="max-w-xs">
        <input type="hidden" name="id" value={draftId} />
        <Button type="submit" variant="quiet" disabled={discarding}>
          {discarding ? "Discarding…" : "Discard and start over"}
        </Button>
        {discardState.error && <Alert>{discardState.error}</Alert>}
      </form>
    </div>
  );
}
