import Link from "next/link";
import { Suspense } from "react";
import { HeaderLink } from "./HeaderLink";
import { Monogram } from "@/components/ui/Monogram";

/**
 * The top bar on every signed-in page: the W mark (back to the launcher),
 * the current app's name in the display serif, then People (admins) and
 * Account (which remember the page you came from). `tone="dark"` is for the navy launcher.
 */
export function AppHeader({
  email,
  app,
  isAdmin,
  people,
  tone = "light",
  letter,
  appHref,
}: {
  email: string;
  app?: string;
  isAdmin?: boolean;
  /** Shows People for a people manager (admins always see it). */
  people?: boolean;
  tone?: "light" | "dark";
  /** An app's own mark (e.g. "M"): shown instead of the W, linking to the app; warbag becomes a quiet link. */
  letter?: string;
  appHref?: string;
}) {
  const dark = tone === "dark";
  const link = `min-h-11 content-center px-1 text-sm underline-offset-4 hover:underline ${dark ? "text-cream" : "text-accent"}`;
  const own = Boolean(letter && appHref);
  return (
    <header className={dark ? "" : "border-b border-line"}>
      <div className={`mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 ${dark ? "md:max-w-5xl" : ""}`}>
        <nav aria-label="Main" className="flex min-h-16 items-center gap-3">
          {own ? (
            <Link
              href={appHref!}
              className="flex items-center gap-3 rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Monogram letter={letter!} size="sm" tone="ember" />
              <span className="display text-2xl text-ink">{app}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/home"
                aria-label="warbag home"
                className="rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Monogram letter="W" size="sm" tone={dark ? "cream" : "ink"} />
              </Link>
              <span className={`display text-2xl ${dark ? "text-page" : "text-ink"}`}>{app ?? "warbag"}</span>
            </>
          )}
        </nav>
        <div className="flex items-center gap-4">
          {own && (
            <Link href="/home" className={link}>
              warbag
            </Link>
          )}
          {(isAdmin || people) && (
            <Suspense
              fallback={
                <Link href="/admin" className={link}>
                  People
                </Link>
              }
            >
              <HeaderLink href="/admin" className={link}>
                People
              </HeaderLink>
            </Suspense>
          )}
          <Suspense
            fallback={
              <Link href="/account" title={email} className={link}>
                Account
              </Link>
            }
          >
            <HeaderLink href="/account" title={email} className={link}>
              Account
            </HeaderLink>
          </Suspense>
        </div>
      </div>
    </header>
  );
}
