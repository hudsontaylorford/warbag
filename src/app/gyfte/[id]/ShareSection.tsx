"use client";

import { useActionState, useState } from "react";
import type { Sharing } from "@/lib/gyfte/sharing";
import { createLinkAction, revokeLinkAction, setSharingAction, shareLikeLastAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/components/ui/form-state";

function Saved({ ok, pending, message }: { ok?: boolean; pending: boolean; message?: string }) {
  if (!ok || pending) return null;
  return (
    <p role="status" className="text-sm text-soft">
      {message ?? "Saved"} ✓
    </p>
  );
}

/** Who can see this list, the one-tap suggestion, and the share link. */
export function ShareSection({ listId, sharing, siteUrl }: { listId: string; sharing: Sharing; siteUrl: string }) {
  const [editing, setEditing] = useState(false);
  const [suggestState, suggestAction, suggesting] = useActionState(shareLikeLastAction, {});
  const summary = sharing.shared.map((s) => (s.canEdit ? `${s.name} (can edit)` : s.name)).join(", ");

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Sharing</h2>

      {sharing.shared.length > 0 ? (
        <p>
          Shared with <span className="font-semibold">{summary}</span>. They can see this list and claim gifts.
        </p>
      ) : (
        <p className="text-soft">Only you can see this list.</p>
      )}

      {sharing.suggestion && !editing && (
        <form action={suggestAction} className="flex flex-col gap-3 rounded-lg bg-wash p-4">
          <input type="hidden" name="id" value={listId} />
          <p>
            Share with <span className="font-semibold">{sharing.suggestion.names.join(", ")}</span>, like{" "}
            {sharing.suggestion.from}?
          </p>
          <div className="flex gap-3">
            <Button type="submit" disabled={suggesting}>
              {suggesting ? "Sharing…" : "Share"}
            </Button>
            <Button variant="quiet" onClick={() => setEditing(true)}>
              Change
            </Button>
          </div>
          {suggestState.error && <Alert>{suggestState.error}</Alert>}
        </form>
      )}

      {editing ? (
        <ShareForm listId={listId} sharing={sharing} onDone={() => setEditing(false)} />
      ) : (
        !sharing.suggestion && (
          <div className="max-w-xs">
            <Button variant="quiet" onClick={() => setEditing(true)}>
              {sharing.shared.length > 0 ? "Change who can see it" : "Share"}
            </Button>
          </div>
        )
      )}

      <LinkPart listId={listId} links={sharing.links} siteUrl={siteUrl} />
    </section>
  );
}

function ShareForm({ listId, sharing, onDone }: { listId: string; sharing: Sharing; onDone: () => void }) {
  // Close on success, so the "Shared with ..." line confirms what changed.
  const [state, formAction, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const next = await setSharingAction(prev, form);
    if (next.ok) onDone();
    return next;
  }, {});
  const has = (kind: "group" | "person", id: string) => sharing.shared.some((s) => s.kind === kind && s.id === id);
  const [people, setPeople] = useState<string[]>(sharing.shared.filter((s) => s.kind === "person").map((s) => s.id));
  const box = "size-5 accent-ink";
  const row = "flex min-h-13 cursor-pointer items-center gap-3 py-2";

  if (sharing.groups.length === 0 && sharing.people.length === 0) {
    return <p className="text-soft">You&apos;re not in any groups yet, so there&apos;s no one to share with. A link works for anyone.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={listId} />
      {sharing.groups.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">Groups</legend>
          <div className="flex flex-col divide-y divide-line border-y border-line">
          {sharing.groups.map((g) => (
            <label key={g.id} className={row}>
              <input type="checkbox" name="group" value={g.id} defaultChecked={has("group", g.id)} className={box} />
              <span>{g.name}</span>
            </label>
          ))}
          </div>
        </fieldset>
      )}
      {sharing.people.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">People</legend>
          <div className="flex flex-col divide-y divide-line border-y border-line">
          {sharing.people.map((p) => {
            const on = people.includes(p.id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <label className={row}>
                  <input
                    type="checkbox"
                    name="person"
                    value={p.id}
                    checked={on}
                    onChange={(e) => setPeople(e.target.checked ? [...people, p.id] : people.filter((x) => x !== p.id))}
                    className={box}
                  />
                  <span>{p.name}</span>
                </label>
                {on && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="editor"
                      value={p.id}
                      defaultChecked={sharing.shared.some((s) => s.id === p.id && s.canEdit)}
                      className="size-4 accent-ink"
                    />
                    Can edit
                  </label>
                )}
              </div>
            );
          })}
          </div>
        </fieldset>
      )}
      <p className="text-sm text-soft">
        Everyone you pick can see the list and claim gifts. &quot;Can edit&quot; also lets them add and change gifts (a
        partner or other parent).
      </p>
      {state.error && <Alert>{state.error}</Alert>}
      <Saved ok={state.ok} pending={pending} />
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Close
        </Button>
      </div>
    </form>
  );
}

function LinkPart({ listId, links, siteUrl }: { listId: string; links: { id: string; token: string }[]; siteUrl: string }) {
  const [makeState, makeAction, making] = useActionState(createLinkAction, {});
  const [offState, offAction, turningOff] = useActionState(revokeLinkAction, {});
  const [copied, setCopied] = useState(false);
  const link = links[0];
  const url = link ? `${siteUrl}/g/${link.token}` : "";

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="font-semibold">Link for people without an account</h3>
      {link ? (
        <>
          <p className="text-sm text-soft">Anyone with this link can see the gifts, but not what&apos;s been claimed, and can&apos;t claim.</p>
          <input readOnly value={url} aria-label="Share link" className="min-h-11 rounded-lg border border-line bg-wash px-3 text-sm" />
          <div className="flex gap-3">
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </Button>
            <form action={offAction} className="w-full">
              <input type="hidden" name="id" value={listId} />
              <input type="hidden" name="linkId" value={link.id} />
              <Button type="submit" variant="quiet" disabled={turningOff}>
                {turningOff ? "Turning off…" : "Turn off link"}
              </Button>
            </form>
          </div>
        </>
      ) : (
        <form action={makeAction} className="max-w-xs">
          <input type="hidden" name="id" value={listId} />
          <Button type="submit" variant="quiet" disabled={making}>
            {making ? "Making…" : "Make a link"}
          </Button>
        </form>
      )}
      {(makeState.error || offState.error) && <Alert>{makeState.error ?? offState.error}</Alert>}
    </div>
  );
}
