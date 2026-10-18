#!/usr/bin/env bash
selected_dir=$(zoxide query --list | fuzzel --dmenu -p "select dir: ")
echo $selected_dir
