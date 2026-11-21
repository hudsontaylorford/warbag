import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./session";

/** For admin pages: the signed-in admin, or "not found" for anyone else. */
export async function requireAdminPage(path: string) {
  const user = await requireUser(path);
  if (user.isAdmin !== true) notFound();
  return { user, actor: { id: user.id, isAdmin: true } as const };
}
