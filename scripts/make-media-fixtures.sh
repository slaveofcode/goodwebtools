#!/usr/bin/env bash
# Regenerates the synthetic media fixtures used by the media tool E2E tests.
# Content is a generated test pattern + a 440 Hz tone — no real footage.
set -euo pipefail
OUT="$(dirname "$0")/../e2e/fixtures/media"
mkdir -p "$OUT"
SRC=(-f lavfi -i "testsrc2=size=640x360:rate=30:duration=3" -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=3")
ffmpeg -y -loglevel error "${SRC[@]}" -c:v libx264 -pix_fmt yuv420p -preset veryfast -b:v 400k -c:a aac -b:a 96k -shortest -movflags +faststart "$OUT/clip-h264-aac.mp4"
ffmpeg -y -loglevel error "${SRC[@]}" -c:v libvpx-vp9 -b:v 300k -deadline realtime -cpu-used 8 -c:a libopus -b:a 64k -shortest "$OUT/clip-vp9-opus.webm"
ffmpeg -y -loglevel error -i "$OUT/clip-vp9-opus.webm" -t 2 -c copy -f webm -live 1 -cluster_time_limit 500 "$OUT/clip-live.webm" # like MediaRecorder: no Duration, no Cues
ffmpeg -y -loglevel error -i "$OUT/clip-vp9-opus.webm" -vn -t 2 -c copy -f webm -live 1 "$OUT/voice-live.webm" # audio-only, like a voice recording
ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=640x360:rate=30:duration=3" -c:v libx264 -pix_fmt yuv420p -preset veryfast -b:v 400k -an -movflags +faststart "$OUT/clip-noaudio.mp4"
# Portrait phone clip: landscape pixels + 90° rotation metadata (displays 360x640).
ffmpeg -y -loglevel error -display_rotation 90 -i "$OUT/clip-h264-aac.mp4" -c copy "$OUT/clip-portrait.mp4"
ffmpeg -y -loglevel error "${SRC[@]}" -c:v mpeg4 -q:v 24 -c:a libmp3lame -b:a 96k -shortest "$OUT/clip.avi"
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=3" -c:a pcm_s16le "$OUT/tone.wav"
# MP4 whose video the browser can't decode (MPEG-4 Part 2) — stands in for HEVC on a phone.
ffmpeg -y -loglevel error "${SRC[@]}" -c:v mpeg4 -q:v 24 -c:a aac -b:a 64k -shortest -movflags +faststart "$OUT/clip-undecodable.mp4"
