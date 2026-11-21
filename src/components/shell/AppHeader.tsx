import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

/**
 * The top bar on every signed-in page: the warbag name (back to the
 * launcher), an optional app name, and the account controls.
 */
export function AppHeader({ email, app, isAdmin }: { email: string; app?: string; isAdmin?: boolean }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4">
        <nav aria-label="Main" className="flex min-h-14 items-center gap-2 text-lg">
          <Link
            href="/home"
            className="font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            warbag
          </Link>
          {app && (
            <>
              <span aria-hidden className="text-soft">
                /
              </span>
              <span>{app}</span>
            </>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-soft sm:inline">{email}</span>
          {isAdmin && (
            <Link href="/admin" className="min-h-11 content-center px-1 text-sm text-accent underline-offset-4 hover:underline">
              People
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
