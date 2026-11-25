import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "../session";
import { canUseJot } from "./notes";

/** For Jot pages: the signed-in person with app access, else "not found". */
export async function requireJot(path: string) {
  const user = await requireUser(path);
  const actor = { id: user.id, isAdmin: user.isAdmin === true, peopleManager: user.isPeopleManager === true };
  if (!(await canUseJot(actor))) notFound();
  return { user, actor };
}
