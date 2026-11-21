import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "danger";
};

const base =
  "inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-control)] px-5 text-base font-semibold " +
  "sm:w-auto transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  // The one main action on a screen.
  primary: "bg-ink text-page hover:bg-ink/90",
  // Everything else: outlined, so it never competes with the main action.
  quiet: "border border-ink/40 bg-transparent text-ink hover:border-ink hover:bg-wash",
  // Only to confirm something that can't be undone.
  danger: "bg-red-700 text-white hover:bg-red-800",
};

/**
 * The one button. Primary for the main action on a screen, quiet (outlined)
 * for the rest, danger only to confirm a delete. Full width on phones,
 * sized to its label from tablet up. Navigation uses links, not buttons.
 */
export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
