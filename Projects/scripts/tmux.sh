#!/bin/bash

# tmux-sessionizer: fzf + zoxide powered tmux session manager

EDITOR_FLAG=""
KILL_MODE=false

for arg in "$@"; do
    case "$arg" in
        -nvim) EDITOR_FLAG="nvim" ;;
        -k)    KILL_MODE=true ;;
    esac
done

# Kill mode: pick from existing sessions
if [ "$KILL_MODE" = true ]; then
    SESSION=$(tmux list-sessions -F "#{session_name}" | fzf --height=40% --reverse --prompt="Kill session > ")
    if [ -n "$SESSION" ]; then
        tmux kill-session -t "$SESSION"
        echo "Killed session: $SESSION"
    fi
    exit 0
fi

# Current dir mode: tx .
if [ "$1" = "." ]; then
    SESSION_NAME=$(basename "$(pwd)")
    if [ -n "$TMUX" ]; then
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            tmux switch-client -t "$SESSION_NAME"
        else
            tmux new-session -d -s "$SESSION_NAME" -c "$(pwd)"
            tmux switch-client -t "$SESSION_NAME"
        fi
    else
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            tmux attach -t "$SESSION_NAME"
        else
            tmux new-session -d -s "$SESSION_NAME" -c "$(pwd)"
            tmux attach -t "$SESSION_NAME"
        fi
    fi
    [ -n "$EDITOR_FLAG" ] && sleep 0.2 && tmux send-keys -t "$SESSION_NAME" "$EDITOR_FLAG ." Enter
    exit 0
fi

# Default: fzf picker
SELECTED=$(zoxide query -l | fzf --height=40% --reverse --prompt="Session > " --preview="tree -C -L 2 {}")

if [ -z "$SELECTED" ]; then
    exit 0
fi

SESSION_NAME=$(basename "$SELECTED")
EXISTS=true

if [ -n "$TMUX" ]; then
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        tmux switch-client -t "$SESSION_NAME"
    else
        EXISTS=false
        tmux new-session -d -s "$SESSION_NAME" -c "$SELECTED"
        tmux switch-client -t "$SESSION_NAME"
    fi
else
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        tmux attach -t "$SESSION_NAME"
    else
        EXISTS=false
        tmux new-session -d -s "$SESSION_NAME" -c "$SELECTED"
        tmux attach -t "$SESSION_NAME"
    fi
fi

if [ -n "$EDITOR_FLAG" ]; then
    [ "$EXISTS" = false ] && sleep 0.2
    tmux send-keys -t "$SESSION_NAME" "$EDITOR_FLAG ." Enter
fi
