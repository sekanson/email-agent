#!/bin/bash
# Test the latest pushed changes
# Shows what files changed and which features to test

cd ~/email-agent

echo "🔍 Latest Push Analysis"
echo "========================"

# Get latest commit info
COMMIT=$(git log -1 --pretty=format:"%h - %s")
echo "Commit: $COMMIT"
echo ""

# Get changed files
echo "📁 Changed Files:"
git diff --name-only HEAD~1 HEAD 2>/dev/null || git log -1 --name-only --pretty=format:""

echo ""
echo "🎯 Affected Features:"

# Map files to features
FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null)

if echo "$FILES" | grep -q "dashboard"; then
  echo "  → Dashboard"
fi
if echo "$FILES" | grep -q "categorize"; then
  echo "  → Categorize"
fi
if echo "$FILES" | grep -q "drafts"; then
  echo "  → Drafts"
fi
if echo "$FILES" | grep -q "declutter"; then
  echo "  → Declutter"
fi
if echo "$FILES" | grep -q "assistant"; then
  echo "  → Assistant"
fi
if echo "$FILES" | grep -q "account"; then
  echo "  → Account"
fi
if echo "$FILES" | grep -q "ConfirmModal\|Modal"; then
  echo "  → Modals (all pages with confirms)"
fi
if echo "$FILES" | grep -q "api/settings"; then
  echo "  → Settings API"
fi
if echo "$FILES" | grep -q "api/delete-labels\|api/sync-labels\|api/setup-labels"; then
  echo "  → Gmail Labels"
fi
if echo "$FILES" | grep -q "schema-versions\|upgrade"; then
  echo "  → Schema Versioning / Upgrade Flow"
fi

echo ""
echo "📋 Suggested Tests:"
echo "  1. Verify the commit's intended functionality"
echo "  2. Check for regressions in affected features"
echo "  3. Test on both desktop and mobile if UI changed"
