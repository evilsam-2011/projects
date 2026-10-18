#!/usr/bin/env bash

# Automatically generate a unique filename with a timestamp
OUTPUT="recording_$(date +%Y%m%d_%H%M%S).mp4"

ffmpeg \
  -f x11grab -framerate 30 -video_size 1366x768 -i :0.0 \
  -f pulse -i alsa_output.pci-0000_00_1b.0.analog-stereo.monitor \
  -c:v libx264 -preset ultrafast -crf 10 -pix_fmt yuv444p \
  -c:a aac -b:a 192k \
  "$OUTPUT"
