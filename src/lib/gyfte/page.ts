import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "../session";
import { canUseGyfte } from "./data";

/** For Gyfte pages: the signed-in person with Gyfte access, else "not found". */
export async function requireGyfte(path: string) {
  const user = await requireUser(path);
  const actor = { id: user.id, isAdmin: user.isAdmin === true };
  if (!(await canUseGyfte(actor))) notFound();
  return { user, actor };
}
