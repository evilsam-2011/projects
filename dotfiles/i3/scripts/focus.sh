#!/usr/bin/env bash

if pgrep -x polybar > /dev/null; then
    polybar-msg cmd quit
    i3-msg "gaps inner all set 0"
    i3-msg "gaps outer all set 0"
else
    i3-msg "gaps inner all set 4"
    i3-msg "gaps outer all set 2"
    ~/.config/polybar/launch.sh
fi
