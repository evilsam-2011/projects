#!/usr/bin/env bash

# Efficiently get root directories from zoxide
get_dirs() {
    python3 - << 'PYEOF'
import subprocess, os

try:
    raw = subprocess.check_output(["zoxide", "query", "-l"], text=True, stderr=subprocess.DEVNULL)
    dirs = [d.strip() for d in raw.splitlines() if d.strip()]
except Exception:
    dirs = []

home = os.path.expanduser("~")
excluded_prefixes = (
    "/usr", "/var", "/bin", "/mnt", "/proc", "/sys", "/dev", "/etc",
    os.path.join(home, "Videos"),
    os.path.join(home, "Music"),
    os.path.join(home, ".local"),
    os.path.join(home, ".cache"),
    os.path.join(home, ".mozilla"),
    os.path.join(home, ".npm"),
    os.path.join(home, ".cargo"),
)
exact_exclude = {"/", "/home", home}

clean_dirs = []
for d in dirs:
    if not os.path.isdir(d):
        continue
    if d in exact_exclude:
        continue
    if any(d == p or d.startswith(p + "/") for p in excluded_prefixes):
        continue
    try:
        clean_dirs.append(os.path.realpath(d))
    except Exception:
        continue

# Remove redundant child directories (keep top-level roots only)
unique_dirs = sorted(set(clean_dirs), key=len)
minimal_dirs = []
for d in unique_dirs:
    if not any(d == parent or d.startswith(parent + "/") for parent in minimal_dirs):
        minimal_dirs.append(d)

for d in minimal_dirs:
    print(d)
PYEOF
}

mapfile -t search_dirs < <(get_dirs)

if [ ${#search_dirs[@]} -eq 0 ]; then
    search_dirs=(".")
fi

# Stream files directly into fzf for instant UI startup
selected=$(rg --files --hidden \
    -g '!.git' \
    -g '!node_modules' \
    -g '!.cache' \
    -g '!target' \
    -g '!dist' \
    -g '!build' \
    -g '!.venv' \
    -g '!venv' \
    -g '!.next' \
    -g '!*.png' -g '!*.jpg' -g '!*.jpeg' -g '!*.webp' -g '!*.gif' \
    -g '!*.mp4' -g '!*.mkv' -g '!*.mp3' -g '!*.wav' -g '!*.flac' \
    -g '!*.zip' -g '!*.tar*' -g '!*.iso' -g '!*.7z' \
    "${search_dirs[@]}" 2>/dev/null | fzf -m \
    --prompt="  Find File > " \
    --header="[TAB] Multi-select | [ENTER] Open in Neovim | [CTRL-/] Toggle Preview" \
    --preview='bat --style=numbers --color=always --line-range :500 {} 2>/dev/null || cat {}' \
    --preview-window='right:60%:border-left:wrap' \
    --bind='ctrl-/:toggle-preview')

if [ -n "$selected" ]; then
    mapfile -t files <<< "$selected"
    if [ ${#files[@]} -gt 0 ] && [ -n "${files[0]}" ]; then
        nvim "${files[@]}"
    fi
fi
