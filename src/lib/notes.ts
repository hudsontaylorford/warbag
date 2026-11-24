/**
 * Plain-text notes, read as a few simple blocks so long notes don't land as one
 * wall of text. Nothing is stored differently: this only shapes how notes show.
 * - A blank line starts a new paragraph.
 * - Lines starting with "-", "*" or "•" (then a space) are a bulleted list.
 * - Other single line breaks stay as line breaks.
 */
export type NoteBlock = { kind: "text"; lines: string[] } | { kind: "list"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;

export function noteBlocks(text: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let current: NoteBlock | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      current = null;
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      if (current?.kind !== "list") {
        current = { kind: "list", items: [] };
        blocks.push(current);
      }
      current.items.push(bullet[1].trim());
    } else {
      if (current?.kind !== "text") {
        current = { kind: "text", lines: [] };
        blocks.push(current);
      }
      current.lines.push(line.trim());
    }
  }
  return blocks;
}

/** Long enough to fold to a few lines until someone taps Show all. */
export function isLongNote(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").length;
  return text.length > 220 || lines > 4;
}
