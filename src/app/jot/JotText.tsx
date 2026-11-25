import { noteBlocks } from "@/lib/notes";
import { inlineParts } from "@/lib/jot/note";

function Line({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((p, i) =>
        p.kind === "bold" ? (
          <strong key={i}>{p.text}</strong>
        ) : p.kind === "italic" ? (
          <em key={i}>{p.text}</em>
        ) : p.kind === "link" ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className="[overflow-wrap:anywhere] text-accent underline underline-offset-2">
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/**
 * A note's text: paragraphs and "- " lists like notes everywhere in warbag,
 * plus **bold**, *italic* and web links (opening in a new tab).
 * `linkless` shows links as plain text, for a card that is itself a link.
 */
export function JotText({ text, linkless = false }: { text: string; linkless?: boolean }) {
  return (
    <div className="space-y-1.5 break-words">
      {noteBlocks(text).map((b, i) =>
        b.kind === "list" ? (
          <ul key={i} className="list-disc pl-5">
            {b.items.map((item, j) => (
              <li key={j}>{linkless ? <Plain text={item} /> : <Line text={item} />}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {linkless ? <Plain text={l} /> : <Line text={l} />}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

/** Bold and italic, but links as text (no link inside a link). */
function Plain({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((p, i) =>
        p.kind === "bold" ? <strong key={i}>{p.text}</strong> : p.kind === "italic" ? <em key={i}>{p.text}</em> : <span key={i} className={p.kind === "link" ? "[overflow-wrap:anywhere] underline underline-offset-2" : ""}>{p.text}</span>,
      )}
    </>
  );
}
