export interface ChatCitation {
  ref: string;
  post_id: string;
  title: string | null;
  event_date: string | null;
  is_hidden: boolean;
}

export type AnswerSegment =
  | { type: "text"; text: string }
  | { type: "cite"; number: number; citation: ChatCitation };

/** Public posts open on the public page; hidden ones only exist in the editor. */
export function citationHref(citation: ChatCitation): string {
  return citation.is_hidden ? `/admin/edit/${citation.post_id}` : `/log/${citation.post_id}`;
}

/** A message's time in the viewer's timezone, for example 11/4 14:32. */
export function formatMessageTime(value: string): string {
  return new Date(value).toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const CITATION_GROUP = /\[[0-9a-f]{8}(?:[\s,，、]+[0-9a-f]{8})*\]/g;
// A citation the stream has only delivered part of so far.
const PARTIAL_CITATION = /\[[0-9a-f\s,，、]*$/;

export interface AnswerBlock {
  type: "paragraph" | "quote";
  text: string;
}

/**
 * Separates the author's quoted words (lines the model starts with `> `) from
 * the assistant's own text. Consecutive quote lines form one block.
 */
export function splitBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  for (const line of text.split("\n")) {
    const quote = line.match(/^\s*[>＞]\s?(.*)$/);
    const type = quote ? "quote" : "paragraph";
    const last = blocks[blocks.length - 1];
    const value = quote ? quote[1] : line;
    if (last?.type === type) {
      last.text += `\n${value}`;
    } else {
      blocks.push({ type, text: value });
    }
  }
  return blocks
    .map((block) => ({ ...block, text: block.text.replace(/^\n+|\n+$/g, "") }))
    .filter((block) => block.text.trim());
}

/**
 * Turns an answer's raw `[a1b2c3d4]` markers into numbered citations. A marker
 * the backend didn't confirm is dropped rather than shown as a bare id: that
 * covers ids the model made up, and every marker while still streaming, since
 * the confirmed list only arrives at the end.
 */
export function splitAnswer(text: string, citations: ChatCitation[]): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  const clean = text.replace(PARTIAL_CITATION, "");
  const pushText = (value: string) => {
    if (value) segments.push({ type: "text", text: value });
  };
  let cursor = 0;
  for (const match of clean.matchAll(CITATION_GROUP)) {
    pushText(clean.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    for (const ref of match[0].match(/[0-9a-f]{8}/g) ?? []) {
      const index = citations.findIndex((citation) => citation.ref === ref);
      if (index >= 0) {
        segments.push({ type: "cite", number: index + 1, citation: citations[index] });
      }
    }
  }
  pushText(clean.slice(cursor));
  return segments;
}
