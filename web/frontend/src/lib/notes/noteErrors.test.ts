import { afterEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../../stores/authStore';
import { i18n } from '../../i18n';
import { notesClient } from './notesClient';
import { noteErrorText } from './noteErrors';

function stubEnvelope(body: Record<string, unknown>): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

describe('note API errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    authStore.token.value = null;
  });

  it('turns a displayable: false envelope into yanhekt-error:<code>', async () => {
    authStore.token.value = '0'.repeat(32);
    stubEnvelope({ code: 12101114, message: 'service runtime exception', displayable: false, data: null });
    const res = await notesClient.updateContent(1, '{}');
    expect(res).toEqual({ ok: false, error: 'yanhekt-error:12101114' });
  });

  it('keeps a displayable message as is', async () => {
    authStore.token.value = '0'.repeat(32);
    stubEnvelope({ code: 400, message: 'Title too long', data: null });
    const res = await notesClient.updateTitle(1, 'x');
    expect(res).toEqual({ ok: false, error: 'Title too long' });
  });

  it('words the machine code and passes other errors through', () => {
    i18n.global.locale.value = 'en';
    expect(noteErrorText('yanhekt-error:12101114')).toBe(
      "Yanhekt's note service failed (error code 12101114). This is a problem on Yanhekt's side; try again later.",
    );
    expect(noteErrorText('not-signed-in')).toBe('not-signed-in');
    expect(noteErrorText('service runtime exception')).toBe('service runtime exception');
  });
});
