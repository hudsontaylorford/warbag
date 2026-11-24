"use client";

import { useId, useState } from "react";
import { isLongNote, noteBlocks } from "@/lib/notes";

/**
 * Notes as short paragraphs and bulleted lists ("- " starts a bullet). Long
 * notes show their first few lines with "Show all", so a day stays scannable.
 */
export function Notes({ text, className = "" }: { text: string; className?: string }) {
  const id = useId();
  const long = isLongNote(text);
  const [all, setAll] = useState(false);
  const folded = long && !all;
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div id={id} className={`space-y-1.5 text-sm break-words ${folded ? "line-clamp-3" : ""}`}>
        {noteBlocks(text).map((b, i) =>
          b.kind === "list" ? (
            <ul key={i} className="list-disc pl-5">
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          ) : (
            <p key={i} className="whitespace-pre-line">
              {b.lines.join("\n")}
            </p>
          ),
        )}
      </div>
      {long && (
        <button type="button" aria-expanded={all} aria-controls={id} onClick={() => setAll(!all)} className="min-h-11 text-sm text-button">
          {all ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}
