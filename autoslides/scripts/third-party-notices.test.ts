import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs build script, no type declarations
import { buildNotices, collectPackages } from './third-party-notices.mjs';

type Pkg = { name: string; version: string; licence: string };

describe('third-party notices', () => {
  const packages = collectPackages() as Pkg[];

  it('walks the production tree and leaves out types and dev tools', () => {
    const names = new Set(packages.map((p) => p.name));
    for (const name of ['vue', 'hls.js', 'onnxruntime-web', '@techstark/opencv-js', 'sharp', 'axios']) expect(names.has(name), name).toBe(true);
    // A dependency of a dependency.
    expect(names.has('@vue/runtime-core')).toBe(true);
    for (const name of ['vite', 'vitest', 'electron', 'typescript']) expect(names.has(name), name).toBe(false);
    expect([...names].some((n) => n.startsWith('@types/'))).toBe(false);
  });

  it('carries a licence text for every package (libvips gets its own section)', () => {
    const text = buildNotices({ platform: 'linux' }) as string;
    expect(text).toContain('Copyright (c) 2018-present, Yuxi (Evan) You');
    expect(text).toContain('GNU LESSER GENERAL PUBLIC LICENSE');
    const bare = [...text.matchAll(/This package ships no licence file\. Its package\.json declares: (.*)\./g)];
    // Only libvips, whose text follows in its own section.
    expect(bare.every((m) => m[1].startsWith('LGPL'))).toBe(true);
    expect(text).not.toContain('Sparkle (macOS updates');
  });
});
