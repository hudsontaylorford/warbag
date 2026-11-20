import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet";
};

const base =
  "inline-flex min-h-13 w-full items-center justify-center rounded-lg px-5 text-base font-semibold " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: "bg-ink text-page",
  quiet: "bg-wash text-ink",
};

/** The one button. Primary for the main action on a screen, quiet for the rest. */
export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
