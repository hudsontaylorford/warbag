/**
 * A one-letter mark for warbag's own pages and apps (W, G, P, A...), set in
 * the display serif. Letters come from the app registry or the page, never
 * made up per screen. External apps (Chirk, Crewmaxxing) don't get one.
 */
const sizes = {
  sm: "size-8 text-[1.35rem]",
  md: "size-11 text-[1.9rem]",
  lg: "size-14 text-[2.4rem]",
};

const tones = {
  ink: "bg-ink text-cream",
  ember: "bg-ember text-page",
  cream: "bg-cream text-ink",
  outline: "border border-ink text-ink",
};

export function Monogram({
  letter,
  size = "md",
  tone = "ink",
  label,
}: {
  letter: string;
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  /** Read out instead of the letter, e.g. "Gyfte". Omit when text sits next to it. */
  label?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`display inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] leading-none select-none ${sizes[size]} ${tones[tone]}`}
    >
      <span className="translate-y-[0.06em]">{letter.slice(0, 1).toUpperCase()}</span>
    </span>
  );
}
