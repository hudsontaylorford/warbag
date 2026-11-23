import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./session";

/** For the People pages: an admin or a people manager, or "not found" for anyone else. */
export async function requireAdminPage(path: string) {
  const user = await requireUser(path);
  const isAdmin = user.isAdmin === true;
  const peopleManager = user.isPeopleManager === true;
  if (!isAdmin && !peopleManager) notFound();
  return { user, actor: { id: user.id, isAdmin, peopleManager } };
}
