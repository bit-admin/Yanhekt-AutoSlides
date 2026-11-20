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
// The async methods replace the sync ones (deprecated in Electron 45, removed
// in 46); they read ciphertext written by `encryptString`.
async function osEncryptionAvailable(): Promise<boolean> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    return false;
  }
  return true;
}

export async function encryptPassword(plain: string): Promise<PasswordCipherResult> {
  if (!(await osEncryptionAvailable())) {
    return { ok: false, error: 'encryption_unavailable' };
  }
  const encrypted = await safeStorage.encryptStringAsync(plain);
  return { ok: true, value: encrypted.toString('base64') };
}

export async function decryptPassword(encoded: string): Promise<PasswordCipherResult> {
  if (!(await osEncryptionAvailable())) {
    return { ok: false, error: 'encryption_unavailable' };
  }
  try {
    const { result } = await safeStorage.decryptStringAsync(Buffer.from(encoded, 'base64'));
    return { ok: true, value: result };
  } catch {
    return { ok: false, error: 'decrypt_failed' };
  }
}
