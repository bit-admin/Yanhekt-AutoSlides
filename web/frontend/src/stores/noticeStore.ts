import { ref } from "vue";

// First-run notice. Kept out of configStore deliberately: this records that a
// specific version of the notice was shown, which is an acknowledgement rather
// than a preference, and it must survive settings being reset.
//
// The stored value is the version, not a boolean — bump NOTICE_VERSION when the
// notice's substance changes and every visitor sees it once more. Existing
// acknowledgements of an older version simply stop matching.

const NOTICE_KEY = "autoslides.notice";
const NOTICE_VERSION = "1";

const acknowledged = ref(readAcknowledged());

function readAcknowledged(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === NOTICE_VERSION;
  } catch {
    // Private-mode / storage-disabled browsers: show the notice rather than
    // crash. Without storage the app can't keep you signed in anyway.
    return false;
  }
}

function acknowledge(): void {
  try {
    localStorage.setItem(NOTICE_KEY, NOTICE_VERSION);
  } catch {
    // Ignore — dismissing still works for this session.
  }
  acknowledged.value = true;
}

export const noticeStore = { acknowledged, acknowledge };
