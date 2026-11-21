import "server-only";
import { canUseApp, type Actor } from "./access";

/**
 * Every app warbag knows about, in launcher order. This is the only list:
 * the launcher, access screens and app pages all read it from here.
 *
 * - native: built in warbag, lives at `href` on this site.
 * - external: its own product and login (Chirk, CMX); warbag only links to it.
 * - status "soon": shown to people with access, not openable yet.
 *
 * Who sees an app is decided by `canUseApp` (admins see all; others need
 * app access). App names here never appear on public pages.
 */
export type App = {
  id: string;
  name: string;
  description: string;
  kind: "native" | "external";
  href: string;
  status: "live" | "soon";
};

export const APPS: readonly App[] = [
  {
    id: "gyfte",
    name: "Gyfte",
    description: "Gift lists",
    kind: "native",
    href: "/gyfte",
    status: "live",
  },
  {
    id: "chirk",
    name: "Chirk",
    description: "Invites and plans",
    kind: "external",
    href: "https://chirk.fyi",
    status: "live",
  },
  {
    id: "cmx",
    name: "Crewmaxxing",
    description: "Crew scheduling",
    kind: "external",
    href: "https://app.crewmaxxing.com",
    status: "live",
  },
];

export function getApp(id: string): App | undefined {
  return APPS.find((app) => app.id === id);
}

/** The apps this person may see, in launcher order. */
export async function appsFor(actor: Actor): Promise<App[]> {
  const allowed = await Promise.all(APPS.map((app) => canUseApp(actor, app.id)));
  return APPS.filter((_, i) => allowed[i]);
}

/** "chirk.fyi" from "https://chirk.fyi/x": where an external link goes. */
export function hostOf(href: string): string {
  return new URL(href).host.replace(/^www\./, "");
}
