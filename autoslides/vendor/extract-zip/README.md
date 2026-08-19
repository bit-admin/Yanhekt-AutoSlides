# extract-zip (patched 2.0.2)

Local override of [`extract-zip@2.0.1`](https://www.npmjs.com/package/extract-zip)
(BSD-2-Clause, [max-mapper/extract-zip](https://github.com/max-mapper/extract-zip)).

## Why this exists

[GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) /
CVE-2026-56876: `extract-zip` does not validate **symlink targets**. A zip can
plant `link -> ../../../../etc/passwd` inside the extract directory. There is
**no patched npm release** (latest is still 2.0.1). `npm audit fix --force`
would downgrade `@electron-forge/cli` to 6.4.2 — not a real fix.

Electron Forge 7.11.x still `require()`s CJS `@electron/packager@18`, which
calls `extract-zip` to unpack official Electron zips. Packager 20.0.1+ replaced
this with `@electron-internal/extract-zip`, but 19+/20 are ESM-only and need
Forge 8 (still alpha).

This copy is 2.0.1 plus:

1. Dest path (not just the parent dir) must stay inside `opts.dir` **before**
   `mkdir`.
2. Symlink targets must be relative and resolve inside `opts.dir`.
3. Version **2.0.2** so `npm audit` (advisory range `<=2.0.1`) goes quiet.

Electron's own macOS zips use *relative* in-tree symlinks (`Current -> 1.2.3`);
those still extract.

Root install is `extract-zip: file:vendor/extract-zip` plus
`"overrides": { "extract-zip": "$extract-zip" }`.

When upstream publishes a real 2.0.2+ or Forge 8 stable pulls packager ≥ 20.0.1,
delete this directory, the root `extract-zip` dep, and the matching override.
