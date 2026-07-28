// One-shot first-time prompt when the user turns on slide extraction.
// Kept out of configStore: this is an acknowledgement of "we already asked",
// not a preference, and must survive settings being reset.

const PROMPT_KEY = "autoslides.extractionFeaturesPrompt";
const PROMPT_VERSION = "1";

function readSeen(): boolean {
  try {
    return localStorage.getItem(PROMPT_KEY) === PROMPT_VERSION;
  } catch {
    // Private-mode / storage-disabled: treat as already seen so a broken
    // storage path doesn't trap the user in a modal every toggle.
    return true;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(PROMPT_KEY, PROMPT_VERSION);
  } catch {
    // Ignore — session still continues without re-prompt if storage fails later.
  }
}

export function hasSeenExtractionFeaturesPrompt(): boolean {
  return readSeen();
}

export function markExtractionFeaturesPromptSeen(): void {
  markSeen();
}
