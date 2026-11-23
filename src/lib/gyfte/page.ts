import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "../session";
import { canOpenGyfte, canUseGyfte } from "./data";

/**
 * For Gyfte pages: the signed-in person who may open Gyfte (app access, or
 * a list shared with them), else "not found". `canCreate` says whether they
 * may make lists of their own; pass `needCreate` for pages that make things.
 */
export async function requireGyfte(path: string, opts: { needCreate?: boolean } = {}) {
  const user = await requireUser(path);
  const actor = { id: user.id, isAdmin: user.isAdmin === true, peopleManager: user.isPeopleManager === true };
  const canCreate = await canUseGyfte(actor);
  if (opts.needCreate ? !canCreate : !(canCreate || (await canOpenGyfte(actor)))) notFound();
  return { user, actor, canCreate };
}
