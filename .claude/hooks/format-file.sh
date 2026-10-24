#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): formats the edited file with the repo's Prettier.
# Reads the tool payload from stdin; exits 0 in every case so formatting never blocks Claude.
set -u
payload=$(cat)
# Node is managed by nvm and is not on the PATH of non-interactive shells.
if ! command -v node >/dev/null 2>&1; then
  [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi
command -v node >/dev/null 2>&1 || exit 0
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
file=$(printf '%s' "$payload" | node -e '
  let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => {
    try { process.stdout.write(JSON.parse(s).tool_input?.file_path ?? ""); } catch {}
  });' 2>/dev/null)
[ -n "$file" ] || exit 0
case "$file" in
  "$root"/*) ;;                                  # only files inside the project
  *) exit 0 ;;
esac
case "$file" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.md|*.yml|*.yaml|*.css) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
"$root/node_modules/.bin/prettier" --log-level warn --write "$file" >/dev/null 2>&1 || true
exit 0
