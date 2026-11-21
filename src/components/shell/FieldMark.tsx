/**
 * The launcher's one signature: a very large, faint serif W in the empty
 * part of the navy field. Decorative only: hidden from screen readers,
 * never takes taps, and sits behind the content.
 */
export function FieldMark() {
  return (
    <span
      aria-hidden
      className={
        "display pointer-events-none absolute -right-[0.06em] -bottom-[0.22em] select-none " +
        "text-[20rem] leading-none text-cream/[0.06] md:right-auto md:-left-[0.04em] md:text-[38rem]"
      }
    >
      W
    </span>
  );
}
