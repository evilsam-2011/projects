#!/usr/bin/env bash
VOL=$(pactl get-sink-volume @DEFAULT_SINK@ | grep -oP '\d+%' | head -1 | tr -d '%')
MUTE=$(pactl get-sink-mute @DEFAULT_SINK@ | grep -oP 'yes|no')

if [ "$MUTE" = "yes" ]; then
    ICON="󰝟"
    VOL=0
else
    if [ "$VOL" -lt 33 ]; then
        ICON="󰕿"
    elif [ "$VOL" -lt 66 ]; then
        ICON="󰖀"
    else
        ICON="󰕾"
    fi
fi

dunstify -h "string:x-dunst-stack-tag:osd" -h "int:value:${VOL}" -u low "$ICON  Volume" "${VOL}%"
