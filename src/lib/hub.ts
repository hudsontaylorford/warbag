import "server-only";
import { cache } from "react";
import { appsFor } from "./apps";
import { currentUser, actorOf } from "./session";

/**
 * Who sees warbag itself (the name, the W, the launcher): Hudson and other
 * admins, people managers, and anyone with two or more of warbag's own apps.
 * Everyone else (most family, trip guests, someone with just Mosey or just
 * Gyfte) sees only the app they use; warbag stays the address and nothing more.
 * Hudson, 2026-11-27.
 */
export const seesHub = cache(async (): Promise<boolean> => {
  const user = await currentUser();
  if (!user || user.isGuest) return false;
  if (user.isAdmin || user.isPeopleManager) return true;
  return (await nativeApps(user)).length >= 2;
});

/** The person's own (native) apps, in launcher order. */
export async function nativeApps(user: Parameters<typeof actorOf>[0]) {
  return (await appsFor(actorOf(user))).filter((a) => a.kind === "native");
}

export { appForPath } from "./app-paths";
