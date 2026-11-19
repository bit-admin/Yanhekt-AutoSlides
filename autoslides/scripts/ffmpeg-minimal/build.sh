#!/usr/bin/env bash
# Minimal FFmpeg for AutoSlides: only what the app runs (the `requirements` in
# scripts/media-tools.mjs), plus x264 and Opus. No TLS, no devices, no
# hardware codecs. The pinned source archives below, with this script, are the
# complete Corresponding Source for the GPL binary.
#
#   scripts/ffmpeg-minimal/build.sh darwin-arm64   # on an Apple silicon Mac
#   scripts/ffmpeg-minimal/build.sh linux-x64      # on x86-64 Linux; CI uses AlmaLinux 8 (glibc 2.28)
#   scripts/ffmpeg-minimal/build.sh win32-x64      # cross-compiled on Linux with mingw-w64
#
# Works in vendor/ffmpeg-build/ (gitignored); the result is
# vendor/ffmpeg-build/out/<target>/ffmpeg[.exe] plus its licences, SOURCES.txt
# and FFmpeg's config.log. CI: .github/workflows/ffmpeg-minimal.yml (manual).
set -euo pipefail

TARGET="${1:-darwin-arm64}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="$ROOT/vendor/ffmpeg-build"
SRC="$WORK/src"
BUILD="$WORK/build/$TARGET"
PREFIX="$BUILD/prefix"
OUT="$WORK/out/$TARGET"

FFMPEG_VERSION=9.0.2
FFMPEG_URL="https://ffmpeg.org/releases/ffmpeg-$FFMPEG_VERSION.tar.xz"
FFMPEG_SHA256=8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e
X264_COMMIT=b35605ace3ddf7c1a5d67a2eb553f034aef41d55 # stable branch
X264_URL="https://code.videolan.org/videolan/x264/-/archive/$X264_COMMIT/x264-$X264_COMMIT.tar.bz2"
X264_SHA256=6eeb82934e69fd51e043bd8c5b0d152839638d1ce7aa4eea65a3fedcf83ff224
OPUS_VERSION=1.6.1
OPUS_URL="https://downloads.xiph.org/releases/opus/opus-$OPUS_VERSION.tar.gz"
OPUS_SHA256=6ffcb593207be92584df15b32466ed64bbec99109f007c82205f0194572411a1
ZLIB_VERSION=1.4 # Linux and Windows; macOS links the system libz
ZLIB_URL="https://github.com/madler/zlib/releases/download/v$ZLIB_VERSION/zlib-$ZLIB_VERSION.tar.gz"
ZLIB_SHA256=02dd159783677a749c04adbdd02b55b8a2bcc7e054f51b76b549199a916ad584

EXE=""
CROSS=""   # toolchain prefix for a cross build
HOST=""    # autotools --host
FFMPEG_TARGET=()

case "$TARGET" in
  darwin-arm64)
    [[ "$(uname -s)-$(uname -m)" == "Darwin-arm64" ]] || { echo "darwin-arm64 builds on an Apple silicon Mac" >&2; exit 1; }
    export MACOSX_DEPLOYMENT_TARGET=12.0
    export CC=clang
    export CFLAGS="-O2 -mmacosx-version-min=$MACOSX_DEPLOYMENT_TARGET"
    export LDFLAGS="-mmacosx-version-min=$MACOSX_DEPLOYMENT_TARGET"
    JOBS="$(sysctl -n hw.ncpu)"
    ;;
  linux-x64)
    [[ "$(uname -s)-$(uname -m)" == "Linux-x86_64" ]] || { echo "linux-x64 builds on x86-64 Linux" >&2; exit 1; }
    export CC=gcc
    export CFLAGS="-O2"
    export LDFLAGS=""
    JOBS="$(nproc)"
    ;;
  win32-x64)
    [[ "$(uname -s)" == "Linux" ]] || { echo "win32-x64 cross-compiles on Linux (mingw-w64)" >&2; exit 1; }
    CROSS=x86_64-w64-mingw32-
    HOST=x86_64-w64-mingw32
    EXE=.exe
    export CC="${CROSS}gcc"
    export CFLAGS="-O2"
    export LDFLAGS="-static" # no libwinpthread / libgcc DLLs next to ffmpeg.exe
    FFMPEG_TARGET=(--target-os=mingw32 --arch=x86_64 --cross-prefix="$CROSS")
    JOBS="$(nproc)"
    ;;
  *)
    echo "Unsupported target: $TARGET (darwin-arm64, linux-x64, win32-x64)" >&2
    exit 1
    ;;
esac

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

fetch() { # url sha256
  local file="$SRC/$(basename "$1")"
  mkdir -p "$SRC"
  if [[ ! -f "$file" ]]; then
    curl -fsSL --retry 3 -o "$file.part" "$1"
    mv "$file.part" "$file"
  fi
  local got
  got="$(sha256 "$file")"
  [[ "$got" == "$2" ]] || { echo "Checksum mismatch for $file: $got" >&2; rm -f "$file"; exit 1; }
  echo "$file"
}

unpack() { # archive dir
  rm -rf "$2"
  mkdir -p "$2"
  tar -xf "$1" -C "$2" --strip-components=1
}

rm -rf "$BUILD" "$OUT"
mkdir -p "$BUILD" "$PREFIX" "$OUT/licenses"
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig"
export PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" # no system/Homebrew packages leak in
HOST_ARGS=()
[[ -n "$HOST" ]] && HOST_ARGS=(--host="$HOST")

# --- zlib (Zlib licence; PNG) ---------------------------------------------------------
# A handful of C files: compiled directly, the same way for every cross target.
if [[ "$TARGET" != darwin-* ]]; then
  unpack "$(fetch "$ZLIB_URL" "$ZLIB_SHA256")" "$BUILD/zlib"
  (
    cd "$BUILD/zlib"
    for c in adler32 compress crc32 deflate gzclose gzlib gzread gzwrite infback inffast inflate inftrees trees uncompr zutil; do
      $CC $CFLAGS -fPIC -DHAVE_UNISTD_H -c "$c.c" -o "$c.o"
    done
    "${CROSS}ar" rcs libz.a ./*.o
    mkdir -p "$PREFIX/lib" "$PREFIX/include"
    cp libz.a "$PREFIX/lib/"
    cp zlib.h zconf.h "$PREFIX/include/"
  )
  cp "$BUILD/zlib/LICENSE" "$OUT/licenses/zlib-LICENSE"
fi

# --- x264 (GPL-2.0-or-later) -----------------------------------------------------
unpack "$(fetch "$X264_URL" "$X264_SHA256")" "$BUILD/x264"
(
  cd "$BUILD/x264"
  ./configure --prefix="$PREFIX" ${HOST:+--host="$HOST" --cross-prefix="$CROSS"} --enable-static --enable-pic --disable-cli \
    --disable-opencl --disable-avs --disable-swscale --disable-lavf --disable-ffms \
    --disable-gpac --disable-lsmash --bit-depth=8 --chroma-format=420
  make -j"$JOBS"
  make install-lib-static
)

# --- Opus (BSD-3-Clause) -----------------------------------------------------------
unpack "$(fetch "$OPUS_URL" "$OPUS_SHA256")" "$BUILD/opus"
(
  cd "$BUILD/opus"
  ./configure --prefix="$PREFIX" "${HOST_ARGS[@]+"${HOST_ARGS[@]}"}" --enable-static --disable-shared --disable-doc \
    --disable-extra-programs --with-pic
  make -j"$JOBS"
  make install
)

# --- FFmpeg (GPL-3.0-or-later as configured) -------------------------------------
unpack "$(fetch "$FFMPEG_URL" "$FFMPEG_SHA256")" "$BUILD/ffmpeg"
(
  cd "$BUILD/ffmpeg"
  ./configure \
    --prefix="$PREFIX" \
    "${FFMPEG_TARGET[@]+"${FFMPEG_TARGET[@]}"}" \
    --cc="$CC" --extra-cflags="$CFLAGS -I$PREFIX/include" --extra-ldflags="$LDFLAGS -L$PREFIX/lib" \
    --pkg-config=pkg-config --pkg-config-flags=--static \
    --extra-version=autoslides-minimal \
    --enable-gpl --enable-version3 \
    --disable-everything --disable-autodetect \
    --disable-doc --disable-ffplay --disable-ffprobe --disable-avdevice \
    --disable-debug --enable-stripping \
    --enable-zlib --enable-libx264 --enable-libopus \
    --enable-encoder=libx264,libopus,mjpeg,pcm_s16le \
    --enable-decoder=h264,hevc,aac,aac_latm,png,mjpeg \
    --enable-parser=h264,hevc,aac,aac_latm,png,mjpeg \
    --enable-demuxer=hls,concat,mpegts,mov,matroska,aac,ffmetadata,image2,image_png_pipe \
    --enable-muxer=mp4,image2pipe,null,pcm_s16le \
    --enable-filter=scale,pad,setsar,format,aformat,aresample,highpass,afftdn,speechnorm,loudnorm,null,anull,trim,atrim \
    --enable-bsf=aac_adtstoasc,h264_mp4toannexb,hevc_mp4toannexb \
    --enable-protocol=file,pipe,http,tcp,crypto \
    --enable-swscale --enable-swresample
  make -j"$JOBS"
  cp "ffmpeg$EXE" "$OUT/ffmpeg$EXE"
  cp COPYING.GPLv3 "$OUT/licenses/FFmpeg-COPYING.GPLv3"
  cp ffbuild/config.log "$OUT/config.log" 2>/dev/null || true
)
cp "$BUILD/x264/COPYING" "$OUT/licenses/x264-COPYING"
cp "$BUILD/opus/COPYING" "$OUT/licenses/opus-COPYING"

cat > "$OUT/SOURCES.txt" <<EOF
FFmpeg $FFMPEG_VERSION  $FFMPEG_URL  sha256 $FFMPEG_SHA256
x264 $X264_COMMIT  $X264_URL  sha256 $X264_SHA256
Opus $OPUS_VERSION  $OPUS_URL  sha256 $OPUS_SHA256
$([[ "$TARGET" != darwin-* ]] && echo "zlib $ZLIB_VERSION  $ZLIB_URL  sha256 $ZLIB_SHA256")
Build script: autoslides/scripts/ffmpeg-minimal/build.sh
EOF

if [[ -z "$CROSS" ]]; then "$OUT/ffmpeg" -hide_banner -version | head -1; fi
ls -l "$OUT/ffmpeg$EXE"
