#!/bin/bash
# Claude Code statusline: model, directory, git branch.
#
# Trimmed from a 176-line claude-flow original. Everything past the branch line
# read $CWD/.claude-flow (swarm topology, agent counts, task files, hook state)
# and went dead when that tooling was removed. That code also carried three
# `printf "…%\033[0m"` calls where the bare % parses as an invalid conversion
# specifier, so the colour reset never emitted; the shebang was on line 2
# behind a blank line, so it was never honoured either.

INPUT=$(cat)
MODEL=$(echo "$INPUT" | jq -r '.model.display_name // "Claude"')
CWD=$(echo "$INPUT" | jq -r '.workspace.current_dir // .cwd')
DIR=$(basename "$CWD")
BRANCH=$(cd "$CWD" 2>/dev/null && git branch --show-current 2>/dev/null)

printf '\033[1m%s\033[0m in \033[36m%s\033[0m' "$MODEL" "$DIR"
[ -n "$BRANCH" ] && printf ' on \033[33m⎇ %s\033[0m' "$BRANCH"

echo
