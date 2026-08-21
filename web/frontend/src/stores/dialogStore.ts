import { ref } from "vue";

// In-app confirm/alert host. Native window.confirm/alert paint "origin says"
// chrome and cannot be themed; Playback route guards also need a Promise that
// outlives the page being left. ConfirmHost on App.vue renders `active`.

export interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface ActiveDialog extends DialogOptions {
  kind: "confirm" | "alert";
}

interface QueuedDialog {
  kind: "confirm" | "alert";
  options: DialogOptions;
  resolve: (ok: boolean) => void;
}

const active = ref<ActiveDialog | null>(null);
const queue: QueuedDialog[] = [];
let activeResolve: ((ok: boolean) => void) | null = null;

function pump(): void {
  if (active.value || queue.length === 0) return;
  const next = queue.shift()!;
  activeResolve = next.resolve;
  active.value = { kind: next.kind, ...next.options };
}

function enqueue(kind: "confirm" | "alert", options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ kind, options, resolve });
    pump();
  });
}

function confirm(options: DialogOptions): Promise<boolean> {
  return enqueue("confirm", options);
}

async function alert(options: Omit<DialogOptions, "cancelText" | "danger">): Promise<void> {
  await enqueue("alert", options);
}

function resolve(ok: boolean): void {
  if (!activeResolve) return;
  const done = activeResolve;
  activeResolve = null;
  active.value = null;
  done(ok);
  pump();
}

export const dialogStore = { active, confirm, alert, resolve };
