"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { createLinkAction, linkOptionsAction, replaceLinkAction, revokeLinkAction, turnOffJoinerAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Choice } from "@/components/ui/Choice";
import { ConfirmForm, SaveStatus, useAutosave } from "@/components/ui/forms";

const noSubscribe = () => () => {};

type Joiner = { id: string; name: string; joinedAt: Date };

/**
 * The trip link. By default anyone with it sees Plan and Ideas (never money
 * or members-only details) and can ask to join. The owner can let people
 * join and edit from it instead (like chirk), with Money as its own switch.
 */
export function TripLink({
  tripId,
  tripName,
  links,
  siteUrl,
  linkJoin,
  linkMoney,
  joiners,
}: {
  tripId: string;
  tripName: string;
  links: { id: string; token: string }[];
  siteUrl: string;
  linkJoin: boolean;
  linkMoney: boolean;
  joiners: Joiner[];
}) {
  const [makeState, makeAction, making] = useActionState(createLinkAction, {});
  const [offState, offAction, turningOff] = useActionState(revokeLinkAction, {});
  const [copied, setCopied] = useState(false);
  // Phones get the share sheet (Messages, email); everyone gets Copy.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const link = links[0];
  const url = link ? `${siteUrl}/m/${link.token}` : "";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="heading">Trip link</h2>
      <p className="text-sm text-soft">
        {linkJoin
          ? "This is the link to send. Anyone with it can pick their name and join without signing in: add ideas, say what they're going to and pick options. The address in your browser bar is for people already on the trip."
          : "This is the link to send. Anyone with it sees the plan and ideas without signing in (never money or members-only details) and can ask to join with their email. You add them under Asking to join. The address in your browser bar is for people already on the trip."}
      </p>
      {link ? (
        <>
          <input readOnly value={url} aria-label="Trip link" className="min-h-12 rounded-[var(--radius-control)] border border-line bg-wash px-4 text-base" onFocus={(e) => e.target.select()} />
          <div className="flex flex-wrap gap-3">
            {canShare && (
              <Button
                onClick={async () => {
                  try {
                    await navigator.share({ title: tripName, text: `${tripName} on Mosey`, url });
                  } catch {
                    // Closed the share sheet: nothing to do.
                  }
                }}
              >
                Share link
              </Button>
            )}
            <Button
              variant={canShare ? "quiet" : undefined}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </Button>
            <form action={offAction}>
              <input type="hidden" name="id" value={tripId} />
              <input type="hidden" name="linkId" value={link.id} />
              <Button type="submit" variant="quiet" disabled={turningOff}>
                {turningOff ? "Turning off…" : "Turn off"}
              </Button>
            </form>
          </div>
          <ConfirmForm
            action={replaceLinkAction}
            id={tripId}
            label="New link"
            consequence="This link stops working and you get a new one to send. People who already joined keep their own links."
          />
          <LinkOptions tripId={tripId} linkJoin={linkJoin} linkMoney={linkMoney} showMoney={linkJoin || joiners.length > 0} />
        </>
      ) : (
        <form action={makeAction} className="max-w-xs">
          <input type="hidden" name="id" value={tripId} />
          <Button type="submit" variant="quiet" disabled={making}>
            {making ? "Making…" : "Make a trip link"}
          </Button>
        </form>
      )}
      {(makeState.error || offState.error) && <Alert>{makeState.error ?? offState.error}</Alert>}
    </section>
  );
}

/** What the trip link lets people do. Saves itself. */
function LinkOptions({ tripId, linkJoin, linkMoney, showMoney }: { tripId: string; linkJoin: boolean; linkMoney: boolean; showMoney: boolean }) {
  const [state, action, pending] = useActionState(linkOptionsAction, {});
  const { ref, saveSoon } = useAutosave();
  const [mode, setMode] = useState(linkJoin ? "join" : "view");
  return (
    <form ref={ref} action={action} onChange={saveSoon} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={tripId} />
      <Choice
        legend="People with the link can"
        name="mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "view", label: "See the plan and ask to join", hint: "You add them under Asking to join." },
          {
            value: "join",
            label: "Join and edit, no sign-in",
            hint: "They say who they are (anyone with the link sees the names nobody has picked yet), then add ideas, say what they're going to and pick options.",
          },
        ]}
      />
      {(showMoney || mode === "join") && (
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" name="money" defaultChecked={linkMoney} className="mt-0.5 size-5 shrink-0 accent-ink" />
          <span className="flex flex-col">
            <span>Include Money for people who joined by link</span>
            <span className="text-sm text-soft">Expenses, households and who owes whom. Receipt photos always need a sign-in.</span>
          </span>
        </label>
      )}
      <SaveStatus state={state} pending={pending} />
    </form>
  );
}

/** People who joined by the trip link, each with their own link. The owner can turn anyone off. */
export function Joiners({ tripId, joiners }: { tripId: string; joiners: Joiner[] }) {
  if (joiners.length === 0) return <p className="text-sm text-soft">Nobody yet.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {joiners.map((j) => (
        <li key={j.id} className="flex flex-col gap-2 py-3">
          <span className="font-semibold break-words">{j.name}</span>
          <ConfirmForm
            action={turnOffJoinerAction}
            id={tripId}
            hidden={{ userId: j.id }}
            label="Turn off"
            consequence={`${j.name} is taken off this trip and signed out, and their own link stops working. Their name can be picked again from the trip link.`}
          />
        </li>
      ))}
    </ul>
  );
}
