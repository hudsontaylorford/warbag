"use client";

import { useActionState, useMemo, useState } from "react";
import type { ImportedList } from "@/lib/gyfte/sheet-import";
import { storeName } from "@/lib/gyfte/links";
import { applyImportAction, discardImportAction } from "../../actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/** Every row from the sheet, grouped by person and year, ticked or not. */
export function ReviewForm({
  draftId,
  lists,
  existing,
  people,
  me,
}: {
  draftId: string;
  lists: ImportedList[];
  existing: string[];
  people: string[];
  me: string;
}) {
  const [applyState, applyAction, applying] = useActionState(applyImportAction, {});
  const [discardState, discardAction, discarding] = useActionState(discardImportAction, {});
  const [keep, setKeep] = useState<Set<string>>(
    () => new Set(lists.filter((l) => !existing.includes(l.key)).flatMap((l) => l.items.filter((i) => i.include).map((i) => i.key))),
  );
  const [meName, setMeName] = useState(me);
  const byPerson = useMemo(() => people.map((p) => ({ person: p, lists: lists.filter((l) => l.person === p) })), [people, lists]);
  const listCount = lists.filter((l) => !existing.includes(l.key) && l.items.some((i) => keep.has(i.key))).length;

  const toggle = (key: string, on: boolean) => {
    const next = new Set(keep);
    if (on) next.add(key);
    else next.delete(key);
    setKeep(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <form action={applyAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={draftId} />
        {[...keep].map((k) => (
          <input key={k} type="hidden" name="keep" value={k} />
        ))}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Which tab is you?</span>
          <select
            name="me"
            value={meName}
            onChange={(e) => setMeName(e.target.value)}
            className="min-h-13 rounded-lg border border-line bg-page px-3 text-base"
          >
            <option value="">None of them</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className="text-sm text-soft">
            Your lists are marked as yours. The others are lists you manage for that person until they join.
          </span>
        </label>

        <div className="flex flex-col divide-y divide-line border-y border-line">
          {byPerson.map(({ person, lists: theirs }) => {
            const ticked = theirs.flatMap((l) => l.items).filter((i) => keep.has(i.key)).length;
            return (
              <details key={person} className="py-2">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
                  <span className="font-semibold">
                    {person}
                    {person === meName && <span className="font-normal text-soft"> (you)</span>}
                  </span>
                  <span className="text-sm text-soft">
                    {ticked} gifts, {theirs.length} {theirs.length === 1 ? "year" : "years"}
                  </span>
                </summary>
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
                            return (
                              <label key={item.key} className="flex min-h-12 cursor-pointer items-start gap-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={!already && keep.has(item.key)}
                                  onChange={(e) => toggle(item.key, e.target.checked)}
                                  className="mt-0.5 size-5 shrink-0 accent-ink"
                                />
                                <span className="flex min-w-0 flex-col">
                                  <span className="break-words">{item.name}</span>
                                  {detail && <span className="text-sm text-soft break-words">{detail}</span>}
                                  {item.flags.length > 0 && (
                                    <span className="text-xs text-soft break-words">{item.flags.join(" · ")}</span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>

        {applyState.error && <Alert>{applyState.error}</Alert>}
        <div className="max-w-sm">
          <Button type="submit" disabled={applying || keep.size === 0}>
            {applying ? "Importing…" : `Import ${listCount} lists, ${keep.size} gifts`}
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
