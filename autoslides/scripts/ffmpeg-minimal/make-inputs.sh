#!/usr/bin/env bash
# Short synthetic clips for check.sh, made with a full FFmpeg (lavfi, libx264,
# libx265, AAC, HLS muxer).  make-inputs.sh <full-ffmpeg> <dir>
set -euo pipefail
FULL="$1"; DIR="$2"
rm -rf "$DIR"; mkdir -p "$DIR/hls" "$DIR/slides"; cd "$DIR"
f() { "$FULL" -hide_banner -loglevel error -y "$@"; }

f -f lavfi -i testsrc2=s=1280x720:r=25:d=8 -f lavfi -i sine=f=440:d=8 \
  -c:v libx264 -g 50 -pix_fmt yuv420p -c:a aac -shortest src.mp4
f -i src.mp4 -c copy src.mkv
f -i src.mp4 -c:v libx265 -tag:v hvc1 -c:a copy src_hevc.mp4
f -i src.mp4 -vn -c:a copy -f adts mic.aac
# AES-128 HLS, as a recording download leaves it (local key, numbered segments).
head -c 16 /dev/urandom > hls/key
printf 'key\nhls/key\n' > keyinfo
f -i src.mp4 -c copy -f hls -hls_time 2 -hls_key_info_file keyinfo -hls_segment_filename 'hls/%d.ts' hls/index.m3u8
f -i src.mp4 -c copy -f hls -hls_time 2 -hls_segment_filename 'plain_%d.ts' plain.m3u8
for i in 1 2 3; do f -f lavfi -i "testsrc=s=1440x1080:d=1" -frames:v 1 "slides/Slide_$i.png"; done
f -f lavfi -i "color=c=white:s=1440x1080" -frames:v 1 -pix_fmt pal8 slides/Slide_4.png
f -f lavfi -i "color=c=black:s=1440x1080" -frames:v 1 -pix_fmt rgb24 black.png
ls plain_*.ts | sed "s/.*/file '&'/" > list.concat
[[ $(wc -l < list.concat) -ge 3 ]] || { echo "expected several HLS segments" >&2; exit 1; }
