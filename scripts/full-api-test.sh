#!/bin/bash
# Zeno Email Agent - Full API Test Suite
# Tests all API endpoints and core functionality

BASE_URL="https://zenoemail.xix3d.com"
TEST_EMAIL="mirmi@xix3d.com"
PASS=0
FAIL=0
WARN=0

echo "🧪 ZENO EMAIL AGENT - FULL API TEST"
echo "===================================="
echo "URL: $BASE_URL"
echo "Account: $TEST_EMAIL"
echo "Time: $(date -u '+%Y-%m-%d %H:%M UTC')"
echo ""

# Helper function for tests
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local expected="$4"
  local data="$5"
  
  if [ "$method" == "GET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
  else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint" 2>/dev/null)
  fi
  
  CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$CODE" == "$expected" ]; then
    echo "✅ $name"
    ((PASS++))
    return 0
  else
    echo "❌ $name (expected $expected, got $CODE)"
    ((FAIL++))
    return 1
  fi
}

test_contains() {
  local name="$1"
  local endpoint="$2"
  local expected_text="$3"
  
  RESPONSE=$(curl -s "$BASE_URL$endpoint" 2>/dev/null)
  
  if echo "$RESPONSE" | grep -q "$expected_text"; then
    echo "✅ $name"
    ((PASS++))
  else
    echo "❌ $name (missing: $expected_text)"
    ((FAIL++))
  fi
}

echo "═══════════════════════════════════"
echo "1️⃣  HEALTH & CORE ENDPOINTS"
echo "═══════════════════════════════════"
test_endpoint "Health check" "GET" "/api/health" "200"
test_endpoint "Settings GET" "GET" "/api/settings?userEmail=$TEST_EMAIL" "200"
test_endpoint "Debug settings" "GET" "/api/debug/settings?userEmail=$TEST_EMAIL" "200"
test_endpoint "Debug labels" "GET" "/api/debug/labels?userEmail=$TEST_EMAIL" "200"

echo ""
echo "═══════════════════════════════════"
echo "2️⃣  PAGE LOADS (200 OK)"
echo "═══════════════════════════════════"
test_endpoint "Landing page" "GET" "/" "200"
test_endpoint "Dashboard" "GET" "/dashboard" "200"
test_endpoint "Categorize" "GET" "/categorize" "200"
test_endpoint "Drafts" "GET" "/drafts" "200"
test_endpoint "Declutter" "GET" "/declutter" "200"
test_endpoint "Assistant" "GET" "/assistant" "200"
test_endpoint "Account" "GET" "/account" "200"
test_endpoint "Analytics" "GET" "/analytics" "200"
test_endpoint "Privacy" "GET" "/privacy" "200"
test_endpoint "Terms" "GET" "/terms" "200"

echo ""
echo "═══════════════════════════════════"
echo "3️⃣  AUTH ENDPOINTS"
echo "═══════════════════════════════════"
test_endpoint "Auth login redirect" "GET" "/api/auth/login" "307"

echo ""
echo "═══════════════════════════════════"
echo "4️⃣  SETTINGS API"
echo "═══════════════════════════════════"
test_contains "Settings has categories" "/api/settings?userEmail=$TEST_EMAIL" "categories"
test_contains "Settings has temperature" "/api/settings?userEmail=$TEST_EMAIL" "temperature"
test_contains "Settings has signature" "/api/settings?userEmail=$TEST_EMAIL" "signature"

echo ""
echo "═══════════════════════════════════"
echo "5️⃣  DEBUG ENDPOINTS"
echo "═══════════════════════════════════"
test_contains "Debug has schemaVersions" "/api/debug/settings?userEmail=$TEST_EMAIL" "schemaVersions"
test_contains "Debug has categoryNames" "/api/debug/settings?userEmail=$TEST_EMAIL" "categoryNames"

echo ""
echo "═══════════════════════════════════"
echo "6️⃣  FOCUS MODE API"
echo "═══════════════════════════════════"
test_endpoint "Focus status" "GET" "/api/focus-mode/status?userEmail=$TEST_EMAIL" "200"

echo ""
echo "═══════════════════════════════════"
echo "7️⃣  DECLUTTER API"
echo "═══════════════════════════════════"
# These need auth so we just check they don't 500
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/declutter/session?userEmail=$TEST_EMAIL")
if [ "$RESP" != "500" ]; then
  echo "✅ Declutter session endpoint responds"
  ((PASS++))
else
  echo "❌ Declutter session endpoint error"
  ((FAIL++))
fi

echo ""
echo "═══════════════════════════════════"
echo "8️⃣  ZENO/ASSISTANT API"
echo "═══════════════════════════════════"
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/zeno/actions?userEmail=$TEST_EMAIL")
if [ "$RESP" != "500" ]; then
  echo "✅ Zeno actions endpoint responds"
  ((PASS++))
else
  echo "❌ Zeno actions endpoint error"
  ((FAIL++))
fi

echo ""
echo "═══════════════════════════════════"
echo "9️⃣  INTEGRATION ENDPOINTS"
echo "═══════════════════════════════════"
test_endpoint "Gmail integration" "GET" "/api/integrations/gmail" "307"
test_endpoint "Calendar integration" "GET" "/api/integrations/calendar" "307"

echo ""
echo "═══════════════════════════════════"
echo "🔟  STRIPE ENDPOINTS"
echo "═══════════════════════════════════"
# Just verify they exist and don't 500
RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/stripe/create-checkout")
if [ "$RESP" == "400" ] || [ "$RESP" == "401" ]; then
  echo "✅ Stripe checkout endpoint exists (auth required)"
  ((PASS++))
else
  echo "⚠️  Stripe checkout: $RESP"
  ((WARN++))
fi

echo ""
echo "═══════════════════════════════════"
echo "📊 TEST SUMMARY"
echo "═══════════════════════════════════"
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
echo "⚠️  Warnings: $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED!"
  exit 0
else
  echo "⚠️  SOME TESTS FAILED - Review above"
  exit 1
fi
