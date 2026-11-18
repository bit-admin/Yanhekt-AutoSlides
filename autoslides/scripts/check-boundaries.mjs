#!/usr/bin/env node
// Architecture boundaries, checked on resolved files rather than on how an
// import is spelled. ESLint's no-restricted-imports only sees the literal
// `@features/<domain>` / `@main/<domain>` text and does not parse `.vue`
// files at all, so a relative path or a `.vue` script could cross a boundary
// unseen. This script reads every import, re-export and dynamic import in
// `src/**/*.{ts,vue}`, resolves it to a file, and applies the same rules:
//
//   renderer features/<d> → only itself, its whitelisted domains (read from
//                            eslint.config.mjs, so the edge list stays one),
//                            and anything outside features/
//   renderer shared/       → never features/
//   main infra/            → no other main domain
//   main video|extraction|ai|export|download → only itself, infra, platform
//   production code        → never a static import of renderer/demo or
//                            main/demo (a dynamic import() is the guarded seam;
//                            main/demo/demoEnv.ts is the one named exception)
//
// It also fails when a folder under features/ is missing from ESLint's
// FEATURE_DOMAINS, which would leave that domain unlinted.
//
// Usage: node scripts/check-boundaries.mjs [--root <dir>] [--eslint <file>]
// Exit 1 on a violation, listing each as `file -> target: rule`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(option('--root', path.join(here, '..')));
const eslintFile = path.resolve(option('--eslint', path.join(root, 'eslint.config.mjs')));
const src = path.join(root, 'src');

const ALIASES = {
  '@main/': 'src/main/',
  '@renderer/': 'src/renderer/',
  '@shared/': 'src/renderer/shared/',
  '@common/': 'src/shared/',
  '@features/': 'src/renderer/features/',
};
const MAIN_DOMAINS = ['video', 'extraction', 'ai', 'export', 'download'];

// ---- what ESLint already declares --------------------------------------
const eslintText = readFileSync(eslintFile, 'utf8');
const domainList = /const FEATURE_DOMAINS = \[([^\]]*)\]/.exec(eslintText);
if (!domainList) {
  console.error('check-boundaries: FEATURE_DOMAINS not found in eslint.config.mjs');
  process.exit(2);
}
const FEATURE_DOMAINS = [...domainList[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const featureAllow = new Map();
for (const m of eslintText.matchAll(/featureBoundaryRule\('([^']+)'(?:,\s*\[([^\]]*)\])?\)/g)) {
  featureAllow.set(m[1], new Set([m[1], ...[...(m[2] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1])]));
}

// ---- files and their imports -------------------------------------------
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|vue)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function scriptOf(file, text) {
  if (!file.endsWith('.vue')) return text;
  return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
}

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every module a file names: { spec, dynamic }. */
function importsOf(code) {
  const found = [];
  const clean = stripComments(code);
  for (const m of clean.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g)) found.push({ spec: m[1], dynamic: false });
  for (const m of clean.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push({ spec: m[1], dynamic: true });
  return found;
}

function resolveSpec(fromFile, spec) {
  let base = null;
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (spec.startsWith(alias)) base = path.join(root, target, spec.slice(alias.length));
  }
  if (!base && (spec.startsWith('./') || spec.startsWith('../'))) base = path.resolve(path.dirname(fromFile), spec);
  if (!base) return null; // a package
  for (const candidate of [base, `${base}.ts`, `${base}.vue`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return base; // unresolved: still classified by its folder
}

// ---- where a file sits ---------------------------------------------------
function placeOf(file) {
  const rel = path.relative(src, file).split(path.sep);
  if (rel[0] === 'renderer' && rel[1] === 'features') return { kind: 'feature', domain: rel[2] };
  if (rel[0] === 'renderer' && rel[1] === 'shared') return { kind: 'renderer-shared' };
  if (rel[0] === 'renderer' && rel[1] === 'demo') return { kind: 'demo' };
  if (rel[0] === 'main' && rel[1] === 'demo') return { kind: 'demo' };
  if (rel[0] === 'main' && rel.length > 2) return { kind: 'main', domain: rel[1] };
  return { kind: 'other' };
}

// The one production import of demo code, by design: main reads whether this
// is a demo run (and moves userData aside) before anything else loads.
const DEMO_SEAMS = new Set(['src/main/demo/demoEnv.ts']);

function violation(from, to, dynamic, targetFile) {
  if (to.kind === 'demo' && from.kind !== 'demo' && !dynamic && !DEMO_SEAMS.has(path.relative(root, targetFile).split(path.sep).join('/'))) {
    return 'production code must not import demo/ (use @shared/overrideRegistry)';
  }
  if (from.kind === 'feature' && to.kind === 'feature' && from.domain !== to.domain) {
    const allowed = featureAllow.get(from.domain);
    if (!allowed) return `feature domain '${from.domain}' has no boundary rule in eslint.config.mjs`;
    if (!allowed.has(to.domain)) return `feature domain '${from.domain}' may not import from '${to.domain}'`;
  }
  if (from.kind === 'renderer-shared' && to.kind === 'feature') return 'renderer shared/ may not import from features/';
  if (from.kind === 'main' && to.kind === 'main' && from.domain !== to.domain) {
    if (from.domain === 'infra') return `main infra/ may not import from main ${to.domain}/`;
    if (MAIN_DOMAINS.includes(from.domain) && to.domain !== 'infra' && to.domain !== 'platform') {
      return `main domain '${from.domain}' may not import from '${to.domain}'`;
    }
  }
  return null;
}

// ---- run -------------------------------------------------------------------
const problems = [];
const featureDirs = existsSync(path.join(src, 'renderer/features'))
  ? readdirSync(path.join(src, 'renderer/features'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
for (const dir of featureDirs) {
  if (!FEATURE_DOMAINS.includes(dir)) problems.push(`src/renderer/features/${dir}: not in FEATURE_DOMAINS in eslint.config.mjs, so it is not linted`);
}

let edges = 0;
for (const file of walk(src)) {
  const from = placeOf(file);
  for (const { spec, dynamic } of importsOf(scriptOf(file, readFileSync(file, 'utf8')))) {
    const target = resolveSpec(file, spec);
    if (!target) continue;
    edges += 1;
    const why = violation(from, placeOf(target), dynamic, target);
    if (why) problems.push(`${path.relative(root, file)} -> ${path.relative(root, target)}: ${why}`);
  }
}

if (problems.length > 0) {
  console.error(`check-boundaries: ${problems.length} violation(s)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check-boundaries: ${edges} imports, no violations`);
