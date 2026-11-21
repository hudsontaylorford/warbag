import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";

/**
 * The top bar on every signed-in page: the W mark (back to the launcher),
 * the current app's name in the display serif, then People (admins) and
 * Account. `tone="dark"` is for the navy launcher.
 */
export function AppHeader({
  email,
  app,
  isAdmin,
  tone = "light",
}: {
  email: string;
  app?: string;
  isAdmin?: boolean;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const link = `min-h-11 content-center px-1 text-sm underline-offset-4 hover:underline ${dark ? "text-cream" : "text-accent"}`;
  return (
    <header className={dark ? "" : "border-b border-line"}>
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4">
        <nav aria-label="Main" className="flex min-h-16 items-center gap-3">
          <Link
            href="/home"
            aria-label="warbag home"
            className="rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Monogram letter="W" size="sm" tone={dark ? "cream" : "ink"} />
          </Link>
          <span className={`display text-2xl ${dark ? "text-page" : "text-ink"}`}>{app ?? "warbag"}</span>
        </nav>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link href="/admin" className={link}>
              People
            </Link>
          )}
          <Link href="/account" title={email} className={link}>
            Account
          </Link>
        </div>
      </div>
    </header>
  );
}
