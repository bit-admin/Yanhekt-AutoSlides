import { privacyDoc } from "./privacy";
import { termsDoc } from "./terms";
import type { LegalDoc, LegalDocId } from "./types";

export type { LegalDoc, LegalDocId } from "./types";

/** Order here drives the sidebar nav on the legal pages. */
export const LEGAL_DOCS: LegalDoc[] = [termsDoc, privacyDoc];

export const legalDoc = (id: LegalDocId): LegalDoc =>
  LEGAL_DOCS.find((d) => d.id === id) ?? termsDoc;

/**
 * Renders the one bit of markup the documents use, `**bold**`, to HTML.
 * The input is escaped first: the text is author-written rather than user
 * input, but this output goes through v-html, so it should not depend on that.
 */
export function renderInline(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
