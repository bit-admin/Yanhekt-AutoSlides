import { ref } from "vue";

// First-open banner on Notes about Yanhekt public note-image storage.
// Kept out of configStore deliberately: this records that a specific version
// of the banner was shown, which is an acknowledgement rather than a
// preference, and it must survive settings being reset.
//
// The stored value is the version, not a boolean — bump STORAGE_VERSION when
// the banner's substance changes and every visitor sees it once more.

const STORAGE_KEY = "autoslides.publicStorageNotice";
// Bump when the banner's substance changes so every visitor sees it once more.
// v1 (2026-08-01): note images on Yanhekt public storage; link to /disclosure.
const STORAGE_VERSION = "1";

const acknowledged = ref(readAcknowledged());

function readAcknowledged(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === STORAGE_VERSION;
  } catch {
    // Private-mode / storage-disabled: show the banner rather than crash.
    return false;
  }
}

function acknowledge(): void {
  try {
    localStorage.setItem(STORAGE_KEY, STORAGE_VERSION);
  } catch {
    // Ignore — dismissing still works for this session.
  }
  acknowledged.value = true;
}

export const publicStorageNoticeStore = { acknowledged, acknowledge };
