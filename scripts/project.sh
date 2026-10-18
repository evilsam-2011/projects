SELECTED_DIR=$(zoxide query --list | rofi -dmenu "Select option")
SESSION_NAME=$(basename "$SELECTED_DIR")
if [ -n "$SELECTED_DIR" ]; then
    nvim "$SELECTED_DIR" &
    foot -e tmux new-session -A -s "$SESSION_NAME" -c "$SELECTED_DIR" &
fi
