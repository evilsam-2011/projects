#!/usr/bin/env bash

ffmpeg -f x11grab -framerate 30 -video_size 1366x768 -i :0.0 -f pulse -i alsa_output.pci-0000_00_1b.0.analog-stereo.monitor -c:v libx264 -c:a aac output.mp4
