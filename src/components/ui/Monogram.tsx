/**
 * A one-letter mark for warbag's own pages and apps (W, G, M, R), set in
 * the display serif straight on the background: no tile or frame. Letters
 * come from the app registry or the page, never made up per screen.
 * External apps (Chirk, Crewmaxxing) don't get one.
 */
const sizes = {
  sm: "text-[2rem]",
  md: "text-[2.75rem]",
  lg: "text-[3.5rem]",
};

const tones = {
  ink: "text-ink",
  ember: "text-ember",
  cream: "text-cream",
  outline: "text-ink",
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
      className={`display inline-block shrink-0 leading-none select-none ${sizes[size]} ${tones[tone]}`}
    >
      {letter.slice(0, 1).toUpperCase()}
    </span>
  );
}
