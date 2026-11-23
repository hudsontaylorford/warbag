import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "../session";
import { canUseRoomTuner } from "./setups";

/** For Room Tuner pages: the signed-in person with app access, else "not found". */
export async function requireRoomTuner(path: string) {
  const user = await requireUser(path);
  const actor = { id: user.id, isAdmin: user.isAdmin === true, peopleManager: user.isPeopleManager === true };
  if (!(await canUseRoomTuner(actor))) notFound();
  return { user, actor };
}
