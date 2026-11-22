import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { flushOutput } from './terminal';

const asStream = (stream: PassThrough): NodeJS.WriteStream => stream as unknown as NodeJS.WriteStream;

describe('flushOutput', () => {
  it('waits until a slow reader has taken everything written', async () => {
    const stream = new PassThrough({ highWaterMark: 16 });
    const text = 'x'.repeat(1000);
    stream.write(text);
    let flushed = false;
    const done = flushOutput([asStream(stream)]).then(() => {
      flushed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(flushed).toBe(false);
    let received = '';
    stream.on('data', (chunk) => {
      received += String(chunk);
    });
    await done;
    expect(received).toBe(text);
  });

  it('does not wait on a stream that is already closed', async () => {
    const stream = new PassThrough();
    stream.destroy();
    await expect(flushOutput([asStream(stream)])).resolves.toBeUndefined();
  });

  it('counts a reader that went away as done', async () => {
    const stream = new PassThrough({ highWaterMark: 1 });
    stream.write('queued');
    const done = flushOutput([asStream(stream)]);
    stream.destroy(new Error('EPIPE'));
    await expect(done).resolves.toBeUndefined();
  });
});
