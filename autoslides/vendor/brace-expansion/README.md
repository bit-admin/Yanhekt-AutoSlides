# brace-expansion dual-export shim

Local override of [`brace-expansion@5.0.8`](https://www.npmjs.com/package/brace-expansion)
(MIT, [juliangruber/brace-expansion](https://github.com/juliangruber/brace-expansion)).

## Why this exists

[GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) /
CVE-2026-14257 marks every release `<= 5.0.7` as vulnerable and lists
**only** `5.0.8` as patched — there are no backports to the 1.x / 2.x lines
that older `minimatch` (pulled in by eslint, electron-builder, forge, …)
still depend on.

A plain `"brace-expansion": "5.0.8"` override fails at runtime: 5.x switched
from a callable default export to a named `expand` export, and minimatch
3/5/9 all do `const expand = require('brace-expansion'); expand(pattern)`.

This package is the 5.0.8 implementation with a dual export:

| Consumer | Expectation | How it is met |
|---|---|---|
| minimatch 3 / 5 | `require(...)` is callable | `module.exports` is the expand function |
| minimatch 9 | `__importDefault(require(...)).default(...)` | non-`__esModule` module → wrapped as `{ default: fn }` |
| minimatch 10 | `require(...).expand(...)` | `.expand` property on the function |

`npm audit` matches on the package version (`5.0.8`), so the advisory clears.

`balanced-match@^4.0.2` is a normal dependency of this package (not checked in
under `node_modules/` — that path is gitignored). Root install is
`brace-expansion: file:vendor/brace-expansion` plus
`"overrides": { "brace-expansion": "$brace-expansion" }`, so npm hoists
`balanced-match` where the linked shim can resolve it by walking up from
`vendor/brace-expansion/`.

When upstream ships backports for 1.x/2.x, or the toolchain moves fully onto
minimatch ≥ 10, delete this directory, the root `brace-expansion` dependency,
and the matching `overrides` entry.
