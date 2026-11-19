// Runs scripts/chromium-locales.mjs on a made-up .app with the same layout as
// a packaged Electron bundle.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs build script, no type declarations
import { isKeptLocale, trimLocales, trimMacLocales } from './chromium-locales.mjs';

const FRAMEWORK = 'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources';
const BASES = ['af', 'de', 'en', 'en_GB', 'es_419', 'fil', 'ja', 'ko', 'pt_BR', 'zh_CN', 'zh_TW'];
const GENDERS = ['', '_FEMININE', '_MASCULINE', '_NEUTER'];

let root: string;
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function makeApp(options: { skip?: string } = {}): string {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'as-locales-'));
  const app = path.join(root, 'AutoSlides.app');
  makeMacBundle(app, options);
  return app;
}

function makeMacBundle(app: string, options: { skip?: string }): void {
  for (const base of BASES) {
    if (base === options.skip) continue;
    for (const gender of GENDERS) {
      const dir = path.join(app, FRAMEWORK, `${base}${gender}.lproj`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'locale.pak'), gender ? 'x'.repeat(18) : 'x'.repeat(1000));
    }
    fs.mkdirSync(path.join(app, 'Contents/Resources', `${base}.lproj`), { recursive: true });
  }
  fs.writeFileSync(path.join(app, FRAMEWORK, 'resources.pak'), 'r');
  fs.writeFileSync(path.join(app, FRAMEWORK, 'icudtl.dat'), 'i');
  fs.mkdirSync(path.join(app, 'Contents/Resources/Base.lproj'));
}

// The 55 packs in Electron 42's win32-x64 `locales/` (Linux uses the same names).
const PAKS = ('af am ar bg bn ca cs da de el en-GB en-US es es-419 et fa fi fil fr gu he hi hr hu id it ja kn ko ' +
  'lt lv ml mr ms nb nl pl pt-BR pt-PT ro ru sk sl sr sv sw ta te th tr uk ur vi zh-CN zh-TW').split(' ');

function makeFolder(options: { skip?: string } = {}): string {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'as-locales-'));
  const locales = path.join(root, 'locales');
  fs.mkdirSync(locales);
  for (const name of PAKS) {
    if (name !== options.skip) fs.writeFileSync(path.join(locales, `${name}.pak`), 'x'.repeat(100));
  }
  fs.writeFileSync(path.join(root, 'resources.pak'), 'r');
  return root;
}

const lproj = (dir: string) => fs.readdirSync(dir).filter(name => name.endsWith('.lproj')).sort();

describe('chromium-locales', () => {
  it('keeps the app languages and their gender variants only', () => {
    const app = makeApp();
    const { packs, markers } = trimMacLocales(app);
    const kept = ['en', 'en_GB', 'ja', 'ko', 'zh_CN', 'zh_TW'];
    expect(lproj(path.join(app, FRAMEWORK))).toEqual(
      kept.flatMap(base => GENDERS.map(gender => `${base}${gender}.lproj`)).sort(),
    );
    expect(lproj(path.join(app, 'Contents/Resources'))).toEqual(
      ['Base', ...kept].map(name => `${name}.lproj`).sort(),
    );
    expect(packs.removed).toHaveLength(5 * 4);
    expect(packs.bytes).toBe(5 * (1000 + 3 * 18));
    expect(markers.removed.sort()).toEqual(['af', 'de', 'es_419', 'fil', 'pt_BR']);
    // Non-locale resources stay.
    expect(fs.existsSync(path.join(app, FRAMEWORK, 'resources.pak'))).toBe(true);
    expect(fs.existsSync(path.join(app, FRAMEWORK, 'icudtl.dat'))).toBe(true);
  });

  it('refuses a bundle without one of the kept packs', () => {
    const app = makeApp({ skip: 'zh_TW' });
    expect(() => trimMacLocales(app)).toThrow(/zh_TW/);
  });

  it('matches whole locale names, not prefixes', () => {
    expect(isKeptLocale('en')).toBe(true);
    expect(isKeptLocale('zh_TW_NEUTER')).toBe(true);
    expect(isKeptLocale('en_AU')).toBe(false);
    expect(isKeptLocale('zh')).toBe(false);
    expect(isKeptLocale('Base')).toBe(true);
  });

  it.each(['win32', 'linux'])('keeps six packs in locales/ on %s', platform => {
    const folder = makeFolder();
    const { packs } = trimLocales(platform, folder);
    expect(fs.readdirSync(path.join(folder, 'locales')).sort()).toEqual(
      ['en-GB', 'en-US', 'ja', 'ko', 'zh-CN', 'zh-TW'].map(name => `${name}.pak`),
    );
    expect(packs.removed).toHaveLength(PAKS.length - 6);
    expect(packs.bytes).toBe((PAKS.length - 6) * 100);
    expect(fs.existsSync(path.join(folder, 'resources.pak'))).toBe(true);
  });

  it('refuses a Windows/Linux folder without en-US and leaves it untouched', () => {
    const folder = makeFolder({ skip: 'en-US' });
    expect(() => trimLocales('win32', folder)).toThrow(/en-US/);
    expect(fs.readdirSync(path.join(folder, 'locales'))).toHaveLength(PAKS.length - 1);
  });

  it('finds the .app inside the macOS output folder', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'as-locales-'));
    makeMacBundle(path.join(root, 'AutoSlides.app'), {});
    expect(trimLocales('darwin', root).markers.removed).toHaveLength(5);
  });
});
