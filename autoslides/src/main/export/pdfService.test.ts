import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getName: () => 'AutoSlides', getVersion: () => '0.0.0' } }));
vi.mock('@main/infra/sharpService', () => ({ sharpService: {} }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));

import { PdfService } from './pdfService';

// A 1x1 PNG, enough for PDFKit to place an image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let dir: string;
let service: PdfService;
const options = { aspectRatio: '16:9', size: '1280x720' } as never;
const folders = [{ name: 'Lecture', images: ['/a.png', '/b.png'] }] as unknown as Parameters<PdfService['makePdf']>[0];
type Prepare = (...args: unknown[]) => Promise<unknown>;
const prepareSpy = () =>
  vi.spyOn(service as unknown as { prepareImageForExport: Prepare }, 'prepareImageForExport');
const leftovers = () => fs.readdirSync(dir).filter((name) => name.includes('.partial'));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-export-'));
  service = new PdfService();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('exporting slides to a file', () => {
  it('publishes the finished PDF under its name and leaves nothing beside it', async () => {
    prepareSpy().mockResolvedValue({
      imageBuffer: PNG,
      imageDimensions: { width: 1, height: 1 },
    } );
    const out = path.join(dir, 'Lecture.pdf');
    const result = await service.makePdf(folders, options, out);
    expect(result).toEqual({ success: true, path: out });
    expect(fs.readFileSync(out).subarray(0, 4).toString()).toBe('%PDF');
    expect(leftovers()).toEqual([]);
  });

  it('keeps an existing file and removes the unfinished one when a page fails', async () => {
    const out = path.join(dir, 'Lecture.pdf');
    fs.writeFileSync(out, 'previous export');
    prepareSpy()
      .mockResolvedValueOnce({ imageBuffer: PNG, imageDimensions: { width: 1, height: 1 } } )
      .mockRejectedValueOnce(new Error('image vanished'));
    const result = await service.makePdf(folders, options, out);
    expect(result).toEqual({ success: false, error: 'image vanished' });
    expect(fs.readFileSync(out, 'utf8')).toBe('previous export');
    expect(leftovers()).toEqual([]);
  });

  it('fails cleanly when the output folder cannot be written', async () => {
    const prepare = prepareSpy().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ imageBuffer: PNG, imageDimensions: { width: 1, height: 1 } } ), 20)),
    );
    const out = path.join(dir, 'missing', 'Lecture.pdf');
    const result = await service.makePdf(folders, options, out);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ENOENT/);
    expect(prepare.mock.calls.length).toBeLessThanOrEqual(1);
    expect(fs.existsSync(out)).toBe(false);
  });
});
