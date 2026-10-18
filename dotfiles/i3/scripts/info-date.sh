#!/usr/bin/env bash
TIME=$(date +"%A, %d %B %Y | %I:%M %p")
dunstify -h "string:x-dunst-stack-tag:time" -u low "Time" "$TIME"
