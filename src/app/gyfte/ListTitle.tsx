/**
 * A list's title as the page heading: the person's name in the serif, the
 * occasion ("Christmas 2026") as a small line above it. Screen readers hear
 * the full title once ("Molly · Christmas 2026").
 */
export function ListTitle({ title, className = "" }: { title: string; className?: string }) {
  const at = title.lastIndexOf(" · ");
  const name = at > 0 ? title.slice(0, at) : title;
  const occasion = at > 0 ? title.slice(at + 3) : "";
  return (
    <div className={className}>
      {occasion && (
        <p aria-hidden className="text-sm font-semibold text-soft">
          {occasion}
        </p>
      )}
      <h1 className="title break-words">
        {name}
        {occasion && <span className="sr-only"> · {occasion}</span>}
      </h1>
    </div>
  );
}
