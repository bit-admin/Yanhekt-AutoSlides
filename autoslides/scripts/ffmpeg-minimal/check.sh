#!/usr/bin/env bash
# Runs every FFmpeg command shape the app uses against a build, on the clips
# from make-inputs.sh. Keep it in step with the callers in src/main/video/.
#   check.sh <ffmpeg> <inputs-dir>
# Needs bash, python3 (or $PYTHON) for a local HTTP server, od.
set -uo pipefail
MIN="$1"; DIR="$2"; PYTHON="${PYTHON:-python3}"
cd "$DIR"
pass=0; fail=0
check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>err.txt; then echo "PASS $name"; pass=$((pass + 1)); else echo "FAIL $name: $(tail -3 err.txt)"; fail=$((fail + 1)); fi
}
q() { "$MIN" -hide_banner -loglevel error "$@"; }
is_jpeg() { [[ "$(od -An -tx1 -N2 "$1" | tr -d ' \n')" == "ffd8" ]]; }
poster() { q -ss 2 -i "$1" -frames:v 1 -f image2pipe -vcodec mjpeg pipe:1 > poster.jpg && is_jpeg poster.jpg; }

# m3u8DownloadService: concat of local TS, and the local-playlist fallback (AES-128).
check "download: concat copy + aac_adtstoasc" q -y -f concat -safe 0 -i list.concat -c copy -bsf:a aac_adtstoasc -metadata copyright=x -movflags +faststart dl.mp4
check "download: fallback from encrypted local m3u8" bash -c "cd hls && \"$MIN\" -hide_banner -loglevel error -y -allowed_extensions ALL -i index.m3u8 -c copy -movflags +faststart ../dl2.mp4"
check "download: output is 8 s" bash -c "\"$MIN\" -hide_banner -i dl2.mp4 2>&1 | grep -q 'Duration: 00:00:0[78]'"

# localLecturePosterService: one JPEG frame from local files.
check "poster: mp4" poster src.mp4
check "poster: mkv" poster src.mkv
check "poster: hevc" poster src_hevc.mp4

# thumbnailService: HLS through the local proxy (plain http + access header).
"$PYTHON" -m http.server 18765 --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do
  "$MIN" -hide_banner -loglevel quiet -i http://127.0.0.1:18765/plain.m3u8 -t 0.1 -f null - 2>/dev/null && break
  sleep 1
done
thumb() {
  "$MIN" -headers $'X-AutoSlides-Local: test\r\n' -nostdin -loglevel error -ss 3 -i http://localhost:18765/hls/index.m3u8 \
    -frames:v 1 -an -vf scale=640:-2 -f image2pipe -vcodec mjpeg -q:v 4 pipe:1 > thumb.jpg && is_jpeg thumb.jpg
}
check "thumbnail: HLS over http with -headers" thumb
kill "$SERVER" 2>/dev/null; wait "$SERVER" 2>/dev/null

# yanhe2CaptionSyncService: MPEG-TS on stdin to 16-bit mono PCM.
pcm() { "$MIN" -loglevel error -i pipe:0 -vn -ac 1 -ar 8000 -f s16le pipe:1 < plain_1.ts > pcm.raw && [[ $(wc -c < pcm.raw) -gt 10000 ]]; }
check "caption sync: TS pipe to s16le" pcm

# slideVideoService: probes, then the encode from slideVideoFfmpegArgs.
check "probe: Duration from -i" bash -c "\"$MIN\" -hide_banner -nostdin -i src.mp4 2>&1 | grep -q 'Duration: 00:00:08'"
check "probe: ADTS read-through" bash -c "\"$MIN\" -hide_banner -nostdin -i mic.aac -map 0:a:0 -c copy -f null - 2>&1 | grep -q 'time=00:00:0'"
cat > s.ffconcat <<'EOF'
ffconcat version 1.0
file 'black.png'
duration 1.000
file 'slides/Slide_1.png'
duration 2.000
file 'slides/Slide_4.png'
duration 2.000
file 'slides/Slide_2.png'
duration 3.000
file 'slides/Slide_2.png'
EOF
printf ';FFMETADATA1\ntitle=t\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=1000\nEND=8000\ntitle=Slide 1\n' > m.txt
make_video() { # audio, filter
  q -nostdin -y -stats_period 1 -f concat -safe 0 -i s.ffconcat -i "$1" -f ffmetadata -i m.txt \
    -map 0:v:0 -map 1:a:0 -map_metadata 2 -map_chapters 2 \
    -vf "scale=1440:1080:force_original_aspect_ratio=decrease:flags=lanczos:out_color_matrix=bt709:out_range=tv,pad=1440:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p" \
    -fps_mode vfr -c:v libx264 -preset slow -tune stillimage -crf 23 -bf 0 -x264-params keyint=600:min-keyint=1:scenecut=40 \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
    -af "$2,aresample=async=1:min_hard_comp=0.01:first_pts=0" \
    -c:a libopus -b:a 16k -ac 1 -vbr constrained -compression_level 10 -application voip -frame_duration 60 \
    -t 8.000 -movflags +faststart slide-video.mp4
}
for audio in mic.aac src.mp4; do
  check "make video: $audio, speech" make_video "$audio" "highpass=f=80,afftdn=nr=8:nf=-35:tn=1,speechnorm=e=6.25:r=0.00001:l=1"
  check "make video: $audio, loudnorm" make_video "$audio" "highpass=f=80,afftdn=nr=8:nf=-35:tn=1,loudnorm=I=-16:LRA=11:TP=-1.5"
done
probe_video() {
  "$MIN" -hide_banner -nostdin -i slide-video.mp4 2> probe.txt
  grep -q 'Video: h264' probe.txt && grep -q 'Audio: opus' probe.txt && grep -q 'Chapter #0' probe.txt && grep -q 'Duration: 00:00:0[78]' probe.txt
}
check "make video: h264 + opus + chapter, 8 s" probe_video
check "poster: slide video" poster slide-video.mp4
check "make video: decodes to the end" q -i slide-video.mp4 -an -c:v mjpeg -q:v 31 -f null -

echo "passed $pass, failed $fail"
[[ $fail -eq 0 ]]
