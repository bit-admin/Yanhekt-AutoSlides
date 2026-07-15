// Structure for the legal documents rendered by LegalPage.vue.
//
// Every piece of text is a bilingual pair rather than an i18n key: these
// documents are published in both languages at once (English above, 繁體中文
// below, as in docs/terms.md) so that neither version depends on the reader's
// UI language setting, and the pairing stays visible in the source.
//
// `**bold**` is the only markup honoured inside text — see renderInline().

export interface Bilingual {
  en: string;
  zh: string;
}

export interface LegalParagraph extends Bilingual {
  /** Renders as a boxed, heavier block — used for the warranty and liability
   *  disclaimers that are conventionally set apart. */
  emphasis?: boolean;
}

export interface LegalSection {
  /** Anchor id, also the target of the summary index. */
  id: string;
  heading: Bilingual;
  /** One line for the "What's in this document?" index at the top. */
  summary: Bilingual;
  paragraphs: LegalParagraph[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: Bilingual;
  /** ISO date; rendered per the reader's locale. */
  updated: string;
  intro: LegalParagraph[];
  sections: LegalSection[];
}

export type LegalDocId = "terms" | "privacy";
