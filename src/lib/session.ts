import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { Actor } from "./access";

/** The signed-in user, or null. Checked on the server every time. */
export async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/** For signed-in pages: the user, or a redirect to sign in. */
export async function requireUser(next = "/home") {
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

/** The signed-in person in the shape the access rules use, or null. */
export async function currentActor(): Promise<Actor | null> {
  const user = await currentUser();
  return user ? actorOf(user) : null;
}

/** The access-rules shape of a signed-in user. */
export function actorOf(user: { id: string; isAdmin?: boolean | null; isPeopleManager?: boolean | null; isGuest?: boolean | null }): Actor {
  return { id: user.id, isAdmin: user.isAdmin === true, peopleManager: user.isPeopleManager === true, guest: user.isGuest === true };
}
