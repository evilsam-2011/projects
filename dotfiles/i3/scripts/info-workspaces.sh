#!/usr/bin/env bash
WORKSPACES=$(i3-msg -t get_workspaces | jq -r '.[].name' | tr '\n' ' ')
dunstify -h "string:x-dunst-stack-tag:workspaces" -u low "Workspaces" "$WORKSPACES"
