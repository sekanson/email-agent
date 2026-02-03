#!/bin/bash
# Zeno Email Agent - App Test Runner
# Usage: ./app-test.sh [full|feature-name]

BASE_URL="https://zenoemail.xix3d.com"
TEST_EMAIL="mirmi@xix3d.com"

echo "🧪 Zeno App Test Runner"
echo "========================"
echo "Target: $BASE_URL"
echo "Test Account: $TEST_EMAIL"
echo ""

# Health check
echo "📡 Testing API health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$HEALTH" == "200" ]; then
  echo "✅ API health: OK"
else
  echo "❌ API health: FAILED ($HEALTH)"
fi

# Settings endpoint
echo "📡 Testing settings API..."
SETTINGS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/settings?userEmail=$TEST_EMAIL")
if [ "$SETTINGS" == "200" ]; then
  echo "✅ Settings API: OK"
else
  echo "❌ Settings API: FAILED ($SETTINGS)"
fi

# Debug settings
echo "📡 Testing debug settings..."
DEBUG=$(curl -s "$BASE_URL/api/debug/settings?userEmail=$TEST_EMAIL" 2>/dev/null | head -c 100)
if [[ "$DEBUG" == *"userEmail"* ]]; then
  echo "✅ Debug API: OK"
else
  echo "⚠️ Debug API: Unexpected response"
fi

# Page load tests
echo ""
echo "📄 Testing page loads..."
for page in "" "dashboard" "categorize" "drafts" "declutter" "assistant" "account" "analytics"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/$page")
  if [ "$CODE" == "200" ]; then
    echo "✅ /$page: OK"
  else
    echo "❌ /$page: $CODE"
  fi
done

echo ""
echo "🏁 Basic tests complete!"
