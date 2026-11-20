// Access levels, lowest to highest. Each includes everything below it.
//   view        can see the item
//   contribute  can add to it (e.g. add an item, claim a gift)
//   manage      can change it, its settings and who has access
export const ROLES = ["view", "contribute", "manage"] as const;
export type Role = (typeof ROLES)[number];

/** Levels a share link may carry. Links never grant manage. */
export const LINK_ROLES = ["view", "contribute"] as const;
export type LinkRole = (typeof LINK_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** True when `have` is at least `need`. No access never satisfies anything. */
export function atLeast(have: Role | null, need: Role): boolean {
  return have !== null && ROLES.indexOf(have) >= ROLES.indexOf(need);
}

/** The highest of several levels, or null if there are none. */
export function highest(roles: Iterable<Role | null>): Role | null {
  let best: Role | null = null;
  for (const role of roles) {
    if (role !== null && (best === null || ROLES.indexOf(role) > ROLES.indexOf(best))) best = role;
  }
  return best;
}
