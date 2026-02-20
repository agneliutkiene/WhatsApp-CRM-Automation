#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/propose-hostinger-button-prs.sh repos.txt
#
# Notes:
# - Requires: gh, git
# - Opens PRs from your fork to upstream repos.
# - Default mode is DRY_RUN=1 (no git push / no PR create).
# - To execute: DRY_RUN=0 ./scripts/propose-hostinger-button-prs.sh repos.txt

if [[ "${1:-}" == "" ]]; then
  echo "Usage: $0 <repos-file>"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is required."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required."
  exit 1
fi

REPOS_FILE="$1"
if [[ ! -f "$REPOS_FILE" ]]; then
  echo "Error: file not found: $REPOS_FILE"
  exit 1
fi

DRY_RUN="${DRY_RUN:-1}"
WORKDIR="${WORKDIR:-/tmp/hostinger-badge-prs}"
BRANCH_NAME="chore/add-hostinger-deploy-button"
HOSTINGER_URL="https://www.hostinger.com/web-apps-hosting"
BADGE='[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/web-apps-hosting)'

mkdir -p "$WORKDIR"
cd "$WORKDIR"

GH_USER="$(gh api user -q .login)"
echo "Authenticated as: $GH_USER"
echo "DRY_RUN=$DRY_RUN"

normalize_repo() {
  local raw="$1"
  local trimmed="${raw%%\)*}"
  trimmed="${trimmed%/}"
  trimmed="${trimmed#https://github.com/}"
  trimmed="${trimmed#http://github.com/}"
  echo "$trimmed"
}

find_readme() {
  if [[ -f README.md ]]; then echo "README.md"; return 0; fi
  if [[ -f README.MD ]]; then echo "README.MD"; return 0; fi
  if [[ -f readme.md ]]; then echo "readme.md"; return 0; fi
  return 1
}

insert_badge() {
  local readme="$1"
  if rg -q "assets\.hostinger\.com/vps/deploy\.svg" "$readme"; then
    return 2
  fi

  if head -n1 "$readme" | rg -q '^# '; then
    awk -v badge="$BADGE" '
      NR==1 { print; print ""; print badge; next }
      { print }
    ' "$readme" > "$readme.tmp"
  else
    {
      printf "%s\n\n" "$BADGE"
      cat "$readme"
    } > "$readme.tmp"
  fi

  mv "$readme.tmp" "$readme"
  return 0
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" ]] && continue
  repo="$(normalize_repo "$line")"
  [[ -z "$repo" ]] && continue
  echo
  echo "=== Processing $repo ==="

  owner="${repo%%/*}"
  name="${repo##*/}"
  if [[ -z "$owner" || -z "$name" || "$owner" == "$name" ]]; then
    echo "Skip: invalid repo slug: $repo"
    continue
  fi

  if [[ -d "$name" ]]; then
    rm -rf "$name"
  fi

  # Ensure fork exists
  if ! gh repo view "$GH_USER/$name" >/dev/null 2>&1; then
    echo "Forking $repo -> $GH_USER/$name"
    gh repo fork "$repo" --clone=false --remote=false
  fi

  echo "Cloning fork $GH_USER/$name"
  git clone "https://github.com/$GH_USER/$name.git" "$name" >/dev/null 2>&1
  cd "$name"

  git remote add upstream "https://github.com/$repo.git" >/dev/null 2>&1 || true
  default_branch="$(gh repo view "$repo" --json defaultBranchRef -q .defaultBranchRef.name)"
  git fetch upstream "$default_branch" >/dev/null 2>&1
  git checkout -B "$BRANCH_NAME" "upstream/$default_branch" >/dev/null 2>&1

  readme="$(find_readme || true)"
  if [[ -z "${readme:-}" ]]; then
    echo "Skip: no README found"
    cd ..
    rm -rf "$name"
    continue
  fi

  set +e
  insert_badge "$readme"
  rc=$?
  set -e

  if [[ "$rc" -eq 2 ]]; then
    echo "Skip: badge already present"
    cd ..
    rm -rf "$name"
    continue
  fi

  git add "$readme"
  if git diff --cached --quiet; then
    echo "Skip: no changes"
    cd ..
    rm -rf "$name"
    continue
  fi

  git commit -m "docs: add Deploy on Hostinger button" >/dev/null 2>&1

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "DRY RUN: would push branch and open PR for $repo"
    cd ..
    rm -rf "$name"
    continue
  fi

  git push -u origin "$BRANCH_NAME" >/dev/null 2>&1

  pr_body=$'This PR adds a "Deploy on Hostinger" button to the README for one-click hosting discovery.\n\n- Button points to: '"$HOSTINGER_URL"$'\n- Only README was changed.'
  gh pr create \
    --repo "$repo" \
    --base "$default_branch" \
    --head "$GH_USER:$BRANCH_NAME" \
    --title "docs: add Deploy on Hostinger button" \
    --body "$pr_body" >/dev/null 2>&1

  echo "PR created for $repo"
  cd ..
  rm -rf "$name"
done < "$REPOS_FILE"

echo
echo "Done."
