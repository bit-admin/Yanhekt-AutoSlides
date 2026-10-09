# braces (patched 3.0.4)

Local override of [`braces@3.0.3`](https://www.npmjs.com/package/braces)
(MIT, [micromatch/braces](https://github.com/micromatch/braces)).

## Why this exists

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) /
CVE-2026-93687: `compile`, `expand` and `stringify` walk the parsed pattern
recursively with no depth limit. A pattern of a few thousand nested `{`, well
under the 10,000 character limit, overflows the call stack with an uncaught
`RangeError`. There is **no patched npm release** (latest is still 3.0.3).

It reaches the tree through build tooling only: `micromatch` (`fast-glob`, in
`@electron-forge/core`) and `chokidar@3` (`vite-plugin-static-copy`).

This copy is 3.0.3 plus:

1. `lib/parse.js` throws a `SyntaxError` when braces or parentheses nest more
   than `MAX_DEPTH` (256, `lib/constants.js`) deep, the same way it already
   rejects an over-long input. Every nested block is created in the parser, so
   no walker sees a deeper tree.
2. Version **3.0.4** so `npm audit` (advisory range `<=3.0.3`) goes quiet.

Root install is `braces: file:vendor/braces` plus
`"overrides": { "braces": "$braces" }`.

When upstream publishes a real fix, delete this directory, the root `braces`
dep, and the matching override.
