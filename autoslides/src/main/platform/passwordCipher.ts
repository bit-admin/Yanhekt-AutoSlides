/**
 * Password ciphertext for remembered SSO logins.
 *
 * `safeStorage` binds the secret to this OS user (Keychain on macOS, DPAPI on
 * Windows, the secret service on Linux). When the OS cannot encrypt, this
 * returns a failure instead of writing the password in the clear.
 */
import { safeStorage } from 'electron';

export type PasswordCipherError = 'encryption_unavailable' | 'decrypt_failed';

export type PasswordCipherResult =
  | { ok: true; value: string }
  | { ok: false; error: PasswordCipherError };

// On Linux without a keyring, Electron falls back to `basic_text`: it still
// reports encryption as available, but the key is hardcoded, so the result is
// only obfuscated. Treat that as unavailable rather than store the password.
function osEncryptionAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    return false;
  }
  return true;
}

export function encryptPassword(plain: string): PasswordCipherResult {
  if (!osEncryptionAvailable()) {
    return { ok: false, error: 'encryption_unavailable' };
  }
  return { ok: true, value: safeStorage.encryptString(plain).toString('base64') };
}

export function decryptPassword(encoded: string): PasswordCipherResult {
  if (!osEncryptionAvailable()) {
    return { ok: false, error: 'encryption_unavailable' };
  }
  try {
    return { ok: true, value: safeStorage.decryptString(Buffer.from(encoded, 'base64')) };
  } catch {
    return { ok: false, error: 'decrypt_failed' };
  }
}
