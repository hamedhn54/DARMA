#!/usr/bin/env bash
set -euo pipefail

# Run from the DARMA project root. Only removes confirmed duplicate,
# historical-package, and unused Vite starter files. Does not touch src code,
# database files, package files, or user data.
ROOT="$(pwd)"
if [[ ! -f "$ROOT/package.json" || ! -d "$ROOT/src" ]]; then
  echo "ERROR: Run this script from the DARMA project root (/workspaces/DARMA)."
  exit 1
fi

echo "Cleaning obsolete DARMA project files..."

# Historical README notes; the current README.md is retained.
rm -f README_DARMA_*.txt

# Old package archives copied into the project root; keep downloadable backups
# outside the project folder if you still need them.
rm -f DARMA-full.zip \
  DARMA_shared_ledger_v3.zip \
  DARMA_people_finance_v2.zip \
  DARMA_people_ledger_v1.zip \
  DARMA_definitions_v1.zip \
  DARMA_dashboard_v1.zip \
  DARMA_integrated_definitions_v1.zip \
  DARMA_loans_credit_v1.zip \
  DARMA_loans_credit_v2.zip \
  DARMA_loans_credit_v2_fix.zip

# Temporary extraction folder from the earlier ZIP workflow.
rm -rf .unzip

# Confirmed duplicate: identical to src/pages/DefinitionsPeople.css and not
# imported from the project root.
rm -f DefinitionsPeople.css

# Unreferenced Vite starter images. Keep src/assets directory if other assets
# are added later.
rm -f src/assets/react.svg src/assets/vite.svg src/assets/hero.png
rmdir src/assets 2>/dev/null || true

echo "Cleanup complete. Source code, package files, and IndexedDB data were not modified."
echo "Next: run 'npm run build' to verify the project."
