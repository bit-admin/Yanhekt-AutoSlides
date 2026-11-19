# Bundled Media Tools

AutoSlides prepares a pinned FFmpeg executable **at development/build time**, then ships it as an application resource. It is a separate command-line program invoked by the Electron main process, not a library linked into Electron. FFprobe is not shipped (dropped 2026-11-19, about 66 MB per install): where the app needs a file's length or streams it reads the header that `ffmpeg -i` prints. End users do not install FFmpeg, and the app does not download it at runtime.

## Supported targets and build

Only these release targets are supported, all from AutoSlides' own minimal build (FFmpeg `9.0.2`, release `ffmpeg-9.0.2-r1`):

| Electron target | Built on | Size | Runs on |
| --- | --- | --- | --- |
| `darwin-arm64` | `macos-15` runner, clang | 7.5 MB | macOS 12+ (system libz only) |
| `linux-x64` | AlmaLinux 8 container, GCC | 8.0 MB | glibc 2.28+ |
| `win32-x64` | mingw-w64 cross-compile on `ubuntu-24.04` | 10.5 MB | static `.exe`, no DLLs |

The checked-in download manifest, `autoslides/scripts/media-tools/manifest.json`, is authoritative for the release asset URLs, archive members and SHA-256 digests. There is no implicit support for Intel macOS, Windows ARM64, Linux ARM64 or 32-bit systems. Until 2026-11-19 the pins were third-party full builds (Martin Riedl on macOS, BtbN on Windows/Linux, 66–165 MB each); git history has them.

## Preparation, packaging and runtime

Run from `autoslides/`:

```sh
npm run media:prepare
npm run media:verify -- --directory <path>
```

These commands wrap `autoslides/scripts/media-tools.mjs` (`prepare` and `verify`). `media:prepare` acquires the pinned archives for the selected target, validates their SHA-256 checksums, and stages the executable and notices. It defaults to the host target; `--platform` and `--arch` select another supported target explicitly. For example, to prepare Windows x64 inputs:

```sh
npm run media:prepare -- --platform win32 --arch x64
```

Verification accepts the same target flags together with `--directory`. The default development layout is:

```text
vendor/media-tools/<platform>-<arch>/media-tools/
  ffmpeg           # ffmpeg.exe on Windows
```

These prepared files are build inputs, not tracked replacement npm packages. The executable must come from the pinned release build. Packaging copies the prepared `media-tools` directory outside `app.asar`, into the application's resources directory. Verify the final copied resources as well as the development input; archive integrity alone does not establish that the right files reached the installer.

`media:verify -- --directory <path>` checks an already-prepared directory containing the executable. Use the target's native OS/architecture runner to execute its tools; merely extracting a Windows or Linux archive on macOS does not verify that it runs. A packaged directory is typically `<app resources>/media-tools` (`AutoSlides.app/Contents/Resources/media-tools` on macOS).

Runtime resolves **only** these locations:

- Development: `<app>/vendor/media-tools/<platform>-<arch>/media-tools`.
- Packaged app: `<process.resourcesPath>/media-tools`.

There is no system `PATH` search, Homebrew fallback, npm installer fallback or runtime executable replacement. Missing or non-runnable bundled tools are an installation/preparation failure, not a reason to silently select another version. Executable permissions belong to preparation/packaging, not runtime repair.

### Verification boundaries

The verifier checks executable architecture headers and the `9.0.2` version identity (allowing a build suffix such as `-autoslides-minimal`), not merely that files with the correct names exist. It also checks the components AutoSlides needs:

- Encoders: `libx264`, `libopus`, MJPEG and `pcm_s16le`; decoders: H.264, HEVC, AAC and PNG.
- Filters: `scale`, `pad`, `setsar`, `format`, `aresample`, `highpass`, `afftdn`, `speechnorm` and `loudnorm`.
- Demuxers: HLS, concat, MPEG-TS, MP4, Matroska, ADTS AAC, `ffmetadata`, `image2` and `png_pipe`; muxers: MP4, `image2pipe`, `null` and `s16le`; the `aac_adtstoasc` bitstream filter.
- Protocols: HTTP (the local player proxy only), `file`, `pipe` and `crypto` (AES-128 HLS). Remote streams always go through the proxy, so the build needs no TLS.

The verifier's capability assertions are the executable contract. When adding a feature that needs another FFmpeg component, update those assertions with the caller. Preserve useful `-version`, `-buildconf` and `-L` output with release provenance. A capability-list check is not an end-to-end encode test, a hardware-acceleration test, a security audit or a licensing audit.

## The minimal build

`autoslides/scripts/ffmpeg-minimal/build.sh <target>` builds FFmpeg from pinned source archives (FFmpeg, x264, Opus; zlib on Linux and Windows) with only the components in `requirements`: no TLS, no devices, no hardware codecs, no ffprobe. It works in the gitignored `autoslides/vendor/ffmpeg-build/`. macOS arm64 builds on a Mac; Linux x64 in AlmaLinux 8 (glibc 2.28); Windows x64 is cross-compiled with mingw-w64. 
- `verify.mjs <ffmpeg>` checks the version, GPL/no-nonfree, the `requirements` and (macOS) system-only dylibs. It runs without `node_modules`.
- `make-inputs.sh <full-ffmpeg> <dir>` makes short test clips; `check.sh <ffmpeg> <dir>` runs every command shape the app uses (downloads, posters, thumbnails, caption sync, Make Video) against them. A new FFmpeg call in `src/main/video/` belongs in `check.sh`, its components in `requirements` and in `build.sh`. Configure names can differ from runtime names (`image_png_pipe`, the `pcm_s16le` muxer for `-f s16le`).
- `.github/workflows/ffmpeg-minimal.yml` (manual) builds all three targets, checks each on its own OS, and with a `release_tag` publishes a prerelease holding the three zips, every source archive, `build.sh` and `SHA256SUMS`, the Corresponding Source for that build.

Remote streams reach FFmpeg only through the local player proxy (plain HTTP), so the build needs no TLS. 
## Updating a pin

1. Change the pins or the configure line in `build.sh` (and `requirements` / `check.sh` with any new FFmpeg call).
2. Run the **Minimal FFmpeg** workflow without a tag; it builds all three targets and checks each on its own OS. Built binaries are cached on `build.sh`'s hash.
3. Run it again with a new `release_tag` (`ffmpeg-<version>-r<n>`). It reuses the checked binaries and publishes a prerelease that is never marked latest (the app's updaters read `v<version>` tags only; `release.yml` skips prereleases).
4. Point each manifest target at the new zip and its SHA-256 from the release's `SHA256SUMS`, update the NOTICE's release link, then `npm run media:prepare` on a Mac.

## Licensing and corresponding sources

The build is GPL-3.0-or-later (`--enable-gpl --enable-version3`, no `--enable-nonfree`). It statically includes x264 (GPL-2.0-or-later), Opus (BSD-3-Clause) and, on Windows and Linux, zlib; macOS links the system zlib. FFmpeg runs as a separate process.

Corresponding Source is published with each binary release: the FFmpeg, x264, Opus and zlib source archives exactly as built (checksums in `build.sh` and `SHA256SUMS`), plus `build.sh`. The app ships `media-tools/licenses/`: `GPL-3.0.txt`, `NOTICE.txt` (components, licences and the release link), each library's licence file from the build, and `SOURCES.txt`. Keep the release in place for as long as a shipped app version uses it; a new pin needs its own release.

### Notices and application terms

`autoslides/resources/license.rtf` restricts commercial use (§4(b)), prohibits reverse engineering (§4(c)) and describes an entire agreement (§8). It has an explicit third-party open-source carve-out before §4, preserving licence-granted rights over conflicting application terms. Review it against the actual bundled components when they change. Codec patent and other non-copyright licensing questions are separate from the copyright-licence/source checks.

## Sources

- [FFmpeg legal guidance](https://ffmpeg.org/legal.html) and [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.html).
- [FFmpeg releases](https://ffmpeg.org/releases/), [x264](https://code.videolan.org/videolan/x264), [Opus releases](https://downloads.xiph.org/releases/opus/) (with `SHA256SUMS.txt`), [zlib](https://github.com/madler/zlib/releases).
