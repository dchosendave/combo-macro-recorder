#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <new-version>"
  echo "  e.g. $0 1.1.0"
  exit 1
fi

VERSION="$1"
node scripts/version.mjs "$VERSION"

echo ""
echo "  Version and lockfiles bumped to $VERSION"
echo ""
echo "  Next steps:"
echo "    git add -A"
echo "    git commit -m \"chore: release $VERSION\""
echo "    Follow docs/development-workflow.md to review and merge the version change."
echo "    A tag push alone does not build installers; use Release Please or the Release workflow's tag input."
echo ""
