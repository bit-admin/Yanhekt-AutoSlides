# image-size (subset 2.0.3)

Local override replacing [`image-size@<=2.0.2`](https://www.npmjs.com/package/image-size)
([GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr),
[GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)).

## Why this exists

The ICNS / JXL / HEIF parsers in every published `image-size` release can
infinite-loop on crafted input. **No patched npm version exists** (latest is
2.0.2; a rumored 2.0.3 was never published). `npm audit fix --force` would
downgrade `pptxgenjs` to 1.1.5 — a breaking change, not a fix.

`pptxgenjs@4.0.1` *declares* `image-size` but the published CJS build does not
call it (`getSizeFromImage` is commented out). AutoSlides PPTX export only
feeds PNG (and occasionally JPEG) slides.

This package is a small 1.x-compatible `require('image-size')` that:

- Parses PNG / JPEG / GIF / WebP / BMP only (no ICNS / JXL / HEIF).
- Caps JPEG marker walks so a malformed file cannot hang.
- Reports version **2.0.3** so `npm audit` (advisory range `<=2.0.2`) is clean.

Root install is `image-size: file:vendor/image-size` plus
`"overrides": { "image-size": "$image-size" }`.

When upstream publishes a real `>2.0.2`, delete this directory, the root
`image-size` dep, and the matching override.
