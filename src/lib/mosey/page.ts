import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "../session";
import { canOpenMosey, canUseMosey } from "./trips";

/**
 * For Mosey pages: the signed-in person who may open Mosey (app access, or
 * a trip they were added to), else "not found". `canCreate` says whether
 * they may start trips; pass `needCreate` for pages that do.
 */
export async function requireMosey(
  path: string,
  opts: {
    needCreate?: boolean;
    /** The trip list: show an empty list, not "not found". */
    list?: boolean;
    /** A trip's pages: the trip decides (not on it → "isn't shared with you", with Ask to join). */
    trip?: boolean;
  } = {},
) {
  const user = await requireUser(path);
  const actor = { id: user.id, isAdmin: user.isAdmin === true, peopleManager: user.isPeopleManager === true };
  const canCreate = await canUseMosey(actor);
  if (opts.list || opts.trip) return { user, actor, canCreate };
  if (opts.needCreate ? !canCreate : !(canCreate || (await canOpenMosey(actor)))) notFound();
  return { user, actor, canCreate };
}
