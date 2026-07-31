# Note-export / editor fonts

This directory is **gitignored** for binary faces (`web/.gitignore`); only this
README is tracked. Faces load same-origin (no CDN), **lazily** on first use.

## Pairing (Latin ↔ CJK)

| Set | Latin (editor + PDF) | CJK (PDF) | Editor CJK (system) |
|-----|----------------------|-----------|---------------------|
| **Default** | Arial | `SimHei.ttf` (黑体) | PingFang SC / YaHei |
| **Serif** | Georgia | `SimSun.ttf` (宋体) | Songti SC / SimSun |
| **Mono** | Courier New | `SimHei.ttf` | PingFang SC / YaHei |

## Why `SimSun.ttf` is extracted (not `simsunb.ttf`)

- **`simsunb.ttf` is SimSun-ExtB** — Extension B only. It does **not** cover
  everyday SC (这/是/旅… render as empty boxes). Do **not** use it.
- Regular **SimSun** ships as `Simsun.ttc` (collection). pdf-lib/fontkit cannot
  subset a `.ttc`, so we extract face 0 (`SimSun`) to a standalone `.ttf` with
  fontTools once, then ship that file here.

```bash
# one-time extract (needs fonttools: python -m venv /tmp/ftenv && pip install fonttools)
python3 - <<'PY'
from fontTools.ttLib import TTCollection
from pathlib import Path
col = TTCollection(str(Path.home() / "Library/Fonts/Simsun.ttc"))
# face 0 = SimSun, face 1 = NSimSun
out = Path("web/frontend/public/fonts/SimSun.ttf")
out.parent.mkdir(parents=True, exist_ok=True)
col.fonts[0].save(str(out))
print("wrote", out, out.stat().st_size)
PY
```

Apple **Songti SC** (`/System/Library/Fonts/Supplemental/Songti.ttc`, face
`STSongti-SC-Regular`) is a nicer modern 宋体 alternative; extract the same way
if you prefer it over classic SimSun.

## Other files

```bash
SUPP=/System/Library/Fonts/Supplemental
cp "$SUPP/Arial.ttf" "$SUPP/Arial Italic.ttf" \
   "$SUPP/Georgia.ttf" "$SUPP/Georgia Italic.ttf" \
   "$SUPP/Courier New.ttf" "$SUPP/Courier New Italic.ttf" \
   web/frontend/public/fonts/
cp ~/Library/Fonts/SimHei.ttf web/frontend/public/fonts/SimHei.ttf
# SimSun.ttf — extract as above (not simsunb!)
```

| File | Role |
|------|------|
| `Arial.ttf` / `Arial Italic.ttf` | Default — Latin |
| `Georgia.ttf` / `Georgia Italic.ttf` | Serif — Latin |
| `Courier New.ttf` / `Courier New Italic.ttf` | Mono — Latin |
| `SimHei.ttf` | Default + Mono — CJK PDF |
| `SimSun.ttf` | Serif — CJK PDF (**classic SimSun**, extracted from `Simsun.ttc`) |

**Why TrueType only:** `@pdf-lib/fontkit` subsetting of CFF/OTF maps glyphs
wrong; `.ttc` collections must be extracted first.

Preference key: `configStore.notesFontSet` (`default` | `serif` | `mono`).
