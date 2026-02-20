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
BRANCH_NAME="${BRANCH_NAME:-chore/add-hostinger-deploy-button}"
HOSTINGER_URL="https://www.hostinger.com/web-apps-hosting"
BADGE='[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/web-apps-hosting)'
REPORT_FILE="${REPORT_FILE:-$WORKDIR/report.tsv}"
COMPETITOR_PATTERN='(^|[^a-z])(vercel|netlify)([^a-z]|$)'
APP_HINT_PATTERN='(app|saas|starter|boilerplate|dashboard|template|admin|ecommerce|fullstack|monorepo|crm|store|blog|portfolio)'
LIB_HINT_PATTERN='(library|component|components|chart|charts|sdk|plugin|plugins|hooks|hook|ui[[:space:]]*library|visualization|timeseries)'

mkdir -p "$WORKDIR"
cd "$WORKDIR"
printf "repo\tresult\tdetails\n" > "$REPORT_FILE"

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

is_competitor_repo() {
  local owner_lc="$1"
  local repo_lc="$2"
  if [[ "$owner_lc" =~ $COMPETITOR_PATTERN || "$repo_lc" =~ $COMPETITOR_PATTERN ]]; then
    return 0
  fi
  return 1
}

fetch_repo_description() {
  local repo="$1"
  gh repo view "$repo" --json description -q '.description // ""' 2>/dev/null || true
}

is_likely_end_to_end_app() {
  local repo_lc="$1"
  local description_lc="$2"
  local combined="${repo_lc} ${description_lc}"

  if [[ "$combined" =~ $LIB_HINT_PATTERN && ! "$combined" =~ $APP_HINT_PATTERN ]]; then
    return 1
  fi

  if [[ "$combined" =~ $APP_HINT_PATTERN ]]; then
    return 0
  fi

  # Conservative by default: if we cannot classify as app/template/starter, skip.
  return 1
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

  awk -v badge="$BADGE" '
    BEGIN { inserted=0 }
    {
      print
      if (!inserted && tolower($0) ~ /^##[[:space:]]+deployment([[:space:]]|$)/) {
        print ""
        print badge
        print ""
        inserted=1
      }
    }
    END {
      if (!inserted) {
        print ""
        print "## Deployment"
        print ""
        print badge
      }
    }
  ' "$readme" > "$readme.tmp"

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
  if [[ -z "$owner" || -z "$name" || "$owner" != "${repo%%/*}" || "$name" != "${repo##*/}" || "$repo" != */* ]]; then
    echo "Skip: invalid repo slug: $repo"
    printf "%s\tskipped\tinvalid-repo-slug\n" "$repo" >> "$REPORT_FILE"
    continue
  fi

  owner_lc="$(printf "%s" "$owner" | tr '[:upper:]' '[:lower:]')"
  repo_lc="$(printf "%s" "$repo" | tr '[:upper:]' '[:lower:]')"
  if is_competitor_repo "$owner_lc" "$repo_lc"; then
    echo "Skip: competitor-maintained repo ($repo)"
    printf "%s\tskipped\tcompetitor-repo\n" "$repo" >> "$REPORT_FILE"
    continue
  fi

  description="$(fetch_repo_description "$repo")"
  description_lc="$(printf "%s" "$description" | tr '[:upper:]' '[:lower:]')"
  if ! is_likely_end_to_end_app "$repo_lc" "$description_lc"; then
    echo "Skip: likely library/non-app repo ($repo)"
    printf "%s\tskipped\tnon-app-repo\n" "$repo" >> "$REPORT_FILE"
    continue
  fi

  local_dir="${owner}__${name}"
  if [[ -d "$local_dir" ]]; then
    rm -rf "$local_dir"
  fi

  # Ensure fork exists
  if ! gh repo view "$GH_USER/$name" >/dev/null 2>&1; then
    echo "Forking $repo -> $GH_USER/$name"
    if ! gh repo fork "$repo" --clone=false --remote=false >/dev/null 2>&1; then
      echo "Skip/Fail: unable to fork $repo"
      printf "%s\tfailed\tfork-failed\n" "$repo" >> "$REPORT_FILE"
      continue
    fi
  else
    parent="$(gh repo view "$GH_USER/$name" --json parent -q '.parent.nameWithOwner' 2>/dev/null || true)"
    if [[ -n "$parent" && "$parent" != "$repo" ]]; then
      echo "Skip: fork name collision for $GH_USER/$name (already forked from $parent)"
      printf "%s\tskipped\tfork-name-collision-with-%s\n" "$repo" "$parent" >> "$REPORT_FILE"
      continue
    fi
  fi

  echo "Cloning fork $GH_USER/$name"
  if ! git clone "https://github.com/$GH_USER/$name.git" "$local_dir" >/dev/null 2>&1; then
    echo "Skip/Fail: unable to clone fork $GH_USER/$name"
    printf "%s\tfailed\tclone-failed\n" "$repo" >> "$REPORT_FILE"
    continue
  fi
  cd "$local_dir"

  git remote add upstream "https://github.com/$repo.git" >/dev/null 2>&1 || true
  set +e
  default_branch="$(gh repo view "$repo" --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)"
  set -e
  if [[ -z "${default_branch:-}" ]]; then
    echo "Skip/Fail: could not resolve default branch for $repo"
    printf "%s\tfailed\tdefault-branch-unresolved\n" "$repo" >> "$REPORT_FILE"
    cd ..
    rm -rf "$local_dir"
    continue
  fi

  if ! git fetch upstream "$default_branch" >/dev/null 2>&1; then
    echo "Skip/Fail: could not fetch upstream $default_branch"
    printf "%s\tfailed\tupstream-fetch-failed\n" "$repo" >> "$REPORT_FILE"
    cd ..
    rm -rf "$local_dir"
    continue
  fi

  if ! git checkout -B "$BRANCH_NAME" "upstream/$default_branch" >/dev/null 2>&1; then
    echo "Skip/Fail: could not checkout working branch"
    printf "%s\tfailed\tbranch-checkout-failed\n" "$repo" >> "$REPORT_FILE"
    cd ..
    rm -rf "$local_dir"
    continue
  fi

  readme="$(find_readme || true)"
  if [[ -z "${readme:-}" ]]; then
    echo "Skip: no README found"
    cd ..
    rm -rf "$local_dir"
    printf "%s\tskipped\tno-readme\n" "$repo" >> "$REPORT_FILE"
    continue
  fi

  set +e
  insert_badge "$readme"
  rc=$?
  set -e

  if [[ "$rc" -eq 2 ]]; then
    echo "Skip: badge already present"
    cd ..
    rm -rf "$local_dir"
    printf "%s\tskipped\tbadge-already-present\n" "$repo" >> "$REPORT_FILE"
    continue
  fi

  git add "$readme"
  if git diff --cached --quiet; then
    echo "Skip: no changes"
    cd ..
    rm -rf "$local_dir"
    printf "%s\tskipped\tno-changes\n" "$repo" >> "$REPORT_FILE"
    continue
  fi

  git commit -m "docs: add Deploy on Hostinger button" >/dev/null 2>&1

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "DRY RUN: would push branch and open PR for $repo"
    cd ..
    rm -rf "$local_dir"
    printf "%s\tdry-run\twould-create-pr\n" "$repo" >> "$REPORT_FILE"
    continue
  fi

  if ! git push -u origin "$BRANCH_NAME" >/dev/null 2>&1; then
    echo "Skip/Fail: could not push branch for $repo"
    printf "%s\tfailed\tpush-failed\n" "$repo" >> "$REPORT_FILE"
    cd ..
    rm -rf "$local_dir"
    continue
  fi

  pr_body=$'This PR adds a "Deploy on Hostinger" button to the README for one-click hosting discovery.\n\n- Button points to: '"$HOSTINGER_URL"$'\n- Only README was changed.'
  set +e
  gh pr create \
    --repo "$repo" \
    --base "$default_branch" \
    --head "$GH_USER:$BRANCH_NAME" \
    --title "docs: add Deploy on Hostinger button" \
    --body "$pr_body" >/dev/null 2>&1
  pr_rc=$?
  set -e

  if [[ "$pr_rc" -eq 0 ]]; then
    echo "PR created for $repo"
    printf "%s\tcreated\tok\n" "$repo" >> "$REPORT_FILE"
  else
    echo "Skip/Fail: could not create PR for $repo (likely already exists or blocked)"
    printf "%s\tfailed\tpr-create-failed\n" "$repo" >> "$REPORT_FILE"
  fi
  cd ..
  rm -rf "$local_dir"
done < "$REPOS_FILE"

echo
echo "Done."
echo "Report: $REPORT_FILE"
