#!/usr/bin/env node
// CI's audit gate: `npm audit --json > audit.json; node audit-gate.mjs audit.json`.
// Fails on any advisory at --level or above, like `npm audit --audit-level`,
// except the ones passed as --allow <GHSA id>:<package>:<<major>. An allowed
// advisory still fails when an installed copy of that package is at or above
// the major (so a copy that really has the bug cannot hide behind it).
//
// Each allowance needs a reason next to it in ci.yml and goes away when
// upstream ships a fix in the flagged majors.
import fs from 'node:fs';
import path from 'node:path';

const LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];

const args = process.argv.slice(2);
let file;
let level = 'moderate';
const allow = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--level') level = args[++i];
  else if (args[i] === '--allow') {
    const [id, name, below] = args[++i].split(':');
    const major = Number(/^<(\d+)$/.exec(below ?? '')?.[1]);
    if (!id || !name || !Number.isInteger(major)) {
      throw new Error(`--allow wants <GHSA id>:<package>:<<major>, got ${args[i]}`);
    }
    allow.push({ id, name, major });
  } else file = args[i];
}
if (!file || !LEVELS.includes(level)) {
  throw new Error('usage: audit-gate.mjs <audit.json> [--level moderate] [--allow id:pkg:<major]');
}

const report = JSON.parse(fs.readFileSync(file, 'utf8'));
if (report.error) throw new Error(`npm audit failed: ${JSON.stringify(report.error)}`);
const root = path.dirname(path.resolve(file));
const min = LEVELS.indexOf(level);
const failures = [];
const allowed = new Set();

for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    // A string names another vulnerable package; its advisory is checked there.
    if (typeof via === 'string' || LEVELS.indexOf(via.severity) < min) continue;
    const id = via.url?.split('/').pop() ?? String(via.source);
    const rule = allow.find(a => a.id === id && a.name === name);
    if (!rule) {
      failures.push(`${name} ${via.range}: ${via.severity} ${id} ${via.title}`);
      continue;
    }
    for (const node of vuln.nodes) {
      const version = JSON.parse(fs.readFileSync(path.join(root, node, 'package.json'), 'utf8')).version;
      if (Number(version.split('.')[0]) >= rule.major) {
        failures.push(`${node}@${version}: ${id} is allowed only below ${name}@${rule.major}`);
      }
    }
    allowed.add(`${id} (${name} <${rule.major})`);
  }
}

for (const entry of allowed) process.stdout.write(`allowed: ${entry}\n`);
if (failures.length > 0) {
  process.stdout.write(`${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`audit gate: nothing at ${level} or above outside the allowlist\n`);
