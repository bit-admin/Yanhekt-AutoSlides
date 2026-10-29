# Bundled Media Tools

AutoSlides prepares pinned FFmpeg and FFprobe executables **at development/build time**, then ships them as application resources. They are separate command-line programs invoked by the Electron main process, not libraries linked into Electron. End users do not install FFmpeg, and the app does not download it at runtime.

## Supported targets and providers

Only these release targets are supported:

| Electron target | Provider | Selected build family |
| --- | --- | --- |
| `darwin-arm64` | [Martin Riedl](https://ffmpeg.martin-riedl.de/) | FFmpeg/FFprobe `9.0.2`, build `1789931890_9.0.2` |
| `win32-x64` | [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases) | `autobuild-2026-09-30-13-08`, `n9.0.2-17-g2a571b6068`, `win64-gpl-9.0` static variant |
| `linux-x64` | [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases) | Same retained monthly tag/version, `linux64-gpl-9.0` static variant |

The checked-in download manifest, `autoslides/scripts/media-tools/manifest.json`, is authoritative for exact release tags, asset URLs, archive members and SHA-256 digests. Do not substitute a floating `latest` URL, a master/nightly variant, a shared-library variant or a different architecture. The BtbN version `n9.0.2-17-g2a571b6068` is a **9.0 branch build 17 commits after the 9.0.2 tag**, not byte-identical to the upstream 9.0.2 release.

There is no implicit support for Intel macOS, Windows ARM64, Linux ARM64 or 32-bit systems. BtbN's Linux requirements still apply to its static FFmpeg variant; “static” does not promise a fully self-contained Linux executable without system requirements. Its provider README currently specifies glibc 2.28+ and Linux 4.18+.

## Preparation, packaging and runtime

Run from `autoslides/`:

```sh
npm run media:prepare
npm run media:verify -- --directory <path>
```

These commands wrap `autoslides/scripts/media-tools.mjs` (`prepare` and `verify`). `media:prepare` acquires the pinned archives for the selected target, validates their SHA-256 checksums, and stages the required executables and notices. It defaults to the host target; `--platform` and `--arch` select another supported target explicitly. For example, to prepare Windows x64 inputs:

```sh
npm run media:prepare -- --platform win32 --arch x64
```

Verification accepts the same target flags together with `--directory`. The default development layout is:

```text
vendor/media-tools/<platform>-<arch>/media-tools/
  ffmpeg           # ffmpeg.exe on Windows
  ffprobe          # ffprobe.exe on Windows
```

These prepared files are build inputs, not tracked replacement npm packages. Both executables must come from the selected provider build. Packaging copies the prepared `media-tools` directory outside `app.asar`, into the application's resources directory. Verify the final copied resources as well as the development input; archive integrity alone does not establish that the right files reached the installer.

`media:verify -- --directory <path>` checks an already-prepared directory containing the executables. Use the target's native OS/architecture runner to execute its tools; merely extracting a Windows or Linux archive on macOS does not verify that it runs. A packaged directory is typically `<app resources>/media-tools` (`AutoSlides.app/Contents/Resources/media-tools` on macOS).

Runtime resolves **only** these locations:

- Development: `<app>/vendor/media-tools/<platform>-<arch>/media-tools`.
- Packaged app: `<process.resourcesPath>/media-tools`.

There is no system `PATH` search, Homebrew fallback, npm installer fallback or runtime executable replacement. Missing or non-runnable bundled tools are an installation/preparation failure, not a reason to silently select another version. Executable permissions belong to preparation/packaging, not runtime repair.

### Verification boundaries

The verifier checks executable architecture headers and both tools' `9.0.2` version identity (allowing the provider's branch/build suffix), not merely that files with the correct names exist. It also checks the components AutoSlides needs:

- Encoders/codec support: `libsvtav1`, `libx265`, `libopus`, AAC, MJPEG and `pcm_s16le`.
- Filters: `crop`, `cropdetect`, `fps`, `scale`, `hqdn3d`, `unsharp`, `highpass`, `afftdn`, `speechnorm` and `loudnorm`.
- Required demuxers/muxers across HLS, concat, MP4, MPEG-TS and image piping (`image2pipe`), plus the `aac_adtstoasc` bitstream filter.
- Protocols: HTTP, HTTPS, `file` and `pipe`.

The verifier's capability assertions are the executable contract. When adding a feature that needs another FFmpeg component, update those assertions with the caller. Preserve useful `-version`, `-buildconf` and `-L` output with release provenance. A capability-list check is not an end-to-end encode test, a hardware-acceleration test, a security audit or a licensing audit. Do not assume every optional codec in a provider's “full” build is required by AutoSlides.

## Updating a pin

1. Select exact provider builds for **all three current targets**. Keep FFmpeg and FFprobe aligned. For BtbN, record the dated release tag, full asset names and the FFmpeg source revision embedded in the version; `release/9.0` alone moves over time.
2. Obtain provider checksums through a trusted channel and independently compute SHA-256 for every downloaded archive. Update the manifest's URLs, member names, version expectations and digests together. Do not disable verification to accept a changed asset. A checksum establishes byte identity, not provider authenticity or license compliance.
3. Preserve the archives and provenance needed for later releases. BtbN's README describes retention of the last 14 daily builds and monthly builds for two years; a dated URL is not a permanent availability guarantee. Plan durable retention rather than switching to `latest` when an old pin disappears.
4. Prepare fresh target directories and run the verifier on each native target, including the packaged resources. Run the relevant automated tests and normal desktop packaging checks. Changes to a capability requirement must be reviewed alongside its consuming feature.
5. Review the actual `-buildconf` and `-L` output and every included dependency's license. Refresh packaged notices/license texts, exact corresponding sources, dependency versions, patches and build instructions. Check these **before distributing** the new binaries; a successful technical build does not close the redistribution work below.

## Licensing and corresponding sources

**The source-distribution work is not established as complete by this migration.** Provider metadata and build scripts are useful provenance, but neither is automatically the complete corresponding source for the executable being redistributed. A license URL or a checksum file is not a source offer.

Both selected build families enable GPL components. Martin's pinned `versions.txt` reports `--enable-gpl --enable-version3`, with libraries including x264 and x265. BtbN's GPL defaults select `COPYING.GPLv3` and `--enable-gpl --enable-version3`; its packaging script copies that license to the binary archive's root `LICENSE.txt`. These are GPLv3-or-later FFmpeg builds, not LGPL-only builds. Confirm the executable's own `-L` output when preparing each pin. The providers' build-script repository licenses (Apache-2.0 for Martin's scripts, MIT for BtbN's scripts) do **not** relicense FFmpeg or its bundled dependencies.

### Provider evidence and limits

| Provider | Concrete evidence available | What remains to establish |
| --- | --- | --- |
| Martin Riedl | Exact binary ZIP URLs and `.sha256` sidecars; per-build `versions.txt`, `codecs.txt`, `formats.txt`, `protocols.txt`; public build scripts and dependency recipes | No complete corresponding-source archive for this exact build was identified on the examined download page. The dependency list includes imprecise versions such as `x264 0.165.x`. Recover the actual dependency revisions, patches and build-time script revision; do not treat today's script checkout as proof of how this older binary was built. |
| BtbN | Dated release assets and `checksums.sha256`; version string identifies an FFmpeg Git revision; tagged build scripts, dependency recipes and GPL license packaging | No complete corresponding-source bundle has been established for the selected pin. The sampled release listing exposed binary assets and checksums, not a dedicated full source bundle. GitHub's automatic “Source code (zip/tar.gz)” archives contain the **FFmpeg-Builds script repository**, not the FFmpeg and external-library source trees used to make its binaries. Dependency sources and their exact revisions/patches still need collecting and preserving. |

For Martin's FFmpeg component, its public recipe downloads `https://ffmpeg.org/releases/ffmpeg-$VERSION.tar.bz2`. The upstream [9.0.2 source tarball](https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.bz2) and [signature](https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.bz2.asc) are available. **That tarball alone does not cover the statically included external dependencies or establish a complete corresponding-source package for Martin's binary.**

For BtbN, the exact FFmpeg Git revision is important: downloading the upstream 9.0.2 tarball is not enough for a build identified as additional commits after that tag. Capture the matching FFmpeg tree, dependency sources, any patches and applicable build/control scripts. Do not assume a moving branch or a list of upstream project homepages will remain sufficient or available.

Before shipping, the distributor must choose and fulfill a source-conveyance method permitted by the applicable GPL version, with corresponding source for the shipped build and its covered dependencies. Providing durable matching source downloads alongside the binary release is preferable to an unsupported promise to provide sources later. Keep the notices and license texts required by the other included libraries as well. Provider availability does not transfer the distributor's obligations to that provider. If the necessary sources cannot be recovered, obtain them from the provider or choose a build with a verifiable source package; do not mark the gap resolved with an unrelated source archive.

### Notices and application terms

Ship accessible third-party notices and license texts with the app, identifying FFmpeg/FFprobe, the FFmpeg developers, the applicable GPLv3-or-later terms, the exact provider build and the **actual** matching-source location or fulfilled source-offer arrangement. Preserve the provider's packaged license rather than extracting only `bin/`. Maintain dependency notices too. An About/download-page link helps users find this information but is not a replacement for the required materials.

Recommended notice wording, once the source location has been populated and checked:

> AutoSlides bundles FFmpeg and FFprobe, Copyright © the FFmpeg developers, under GNU GPL version 3 or later. These are separately executed command-line tools. The included license texts, build identification and corresponding-source information are provided with the media-tools notices. Third-party components retain their respective copyrights and licenses.

Do not claim the corresponding sources are included or available until that statement is true. Review the final attribution against the actual executable's copyright and license output.

`autoslides/resources/license.rtf` currently restricts commercial use (§4(b)), prohibits reverse engineering (§4(c)) and describes an entire agreement (§8). The migration adds an explicit third-party open-source carve-out before §4, preserving license-granted rights over conflicting application terms. Review this carve-out and any future terms changes against the actual bundled components; an FFmpeg acknowledgment alone would not cure conflicting restrictions. Separate-process invocation also must not be used to claim that redistribution duties disappear. Whether an application/tool arrangement is mere aggregation or a combined work requires analysis of that arrangement; this document does not conclude that AutoSlides itself must or need not be GPL-licensed. Codec patent and other non-copyright licensing questions are separate from the copyright-license/source checks.

## Sources

Provider metadata and scripts examined on 2026-10-30; mutable pages are evidence to archive for a release, not additional download pins.

- [Martin's build download page](https://ffmpeg.martin-riedl.de/) and [pinned version/configuration/dependency report](https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/versions.txt).
- Martin's [pinned FFmpeg ZIP](https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffmpeg.zip), [checksum](https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffmpeg.zip.sha256), [FFprobe ZIP](https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffprobe.zip) and [checksum](https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffprobe.zip.sha256).
- Martin's [build-script repository](https://git.martin-riedl.de/ffmpeg/build-script), [FFmpeg source-fetch recipe](https://git.martin-riedl.de/ffmpeg/build-script/src/branch/main/script/build-ffmpeg.sh) and [script-repository license](https://git.martin-riedl.de/ffmpeg/build-script/src/branch/main/LICENSE).
- [BtbN README: variants, build prerequisites and retention](https://github.com/BtbN/FFmpeg-Builds#readme).
- [Selected BtbN monthly release](https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-09-30-13-08), its [checksums](https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-09-30-13-08/checksums.sha256) and [tagged build recipes](https://github.com/BtbN/FFmpeg-Builds/tree/autobuild-2026-09-30-13-08). The download manifest selects its exact static GPL assets.
- [BtbN release sampled during source/license research](https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-10-28-19-47), [tagged GPL defaults](https://github.com/BtbN/FFmpeg-Builds/blob/autobuild-2026-10-28-19-47/variants/defaults-gpl.sh), [9.0 branch selection](https://github.com/BtbN/FFmpeg-Builds/blob/autobuild-2026-10-28-19-47/addins/9.0.sh) and [license/archive packaging](https://github.com/BtbN/FFmpeg-Builds/blob/autobuild-2026-10-28-19-47/build.sh). This newer daily release was investigated for provider behavior, not selected for shipping; it does not prove that the monthly pin's source obligations have been fulfilled.
- [FFmpeg legal guidance](https://ffmpeg.org/legal.html), [upstream GPLv3 license text](https://github.com/FFmpeg/FFmpeg/blob/n9.0.2/COPYING.GPLv3) and [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.html).
