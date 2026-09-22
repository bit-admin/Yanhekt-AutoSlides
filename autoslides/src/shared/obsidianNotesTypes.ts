// Types shared by the Obsidian watch-notes bridge (main service, preload,
// renderer sink/panel). Plain data only — every value crosses IPC.

/** Where a watch tab's slides are going. Paths are absolute (main-resolved). */
export interface ObsidianTargetInfo {
  notePath: string;
  /** Vault-relative note path for display; the file name when there is no vault. */
  displayPath: string;
  /** Vault holding the note, or null when the note is outside any vault. */
  vaultPath: string | null;
  vaultName: string | null;
}

export type ObsidianErrorCode =
  | 'no_vault'
  | 'not_a_vault'
  | 'bad_subfolder'
  | 'bad_request'
  | 'no_target'
  | 'io';

export type ObsidianResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ObsidianErrorCode; message?: string };

export interface ObsidianVaultProbe {
  exists: boolean;
  isVault: boolean;
}
