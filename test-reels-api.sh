#!/bin/bash

# 90Plus Reels — Full API Test Suite
# Run this against your production/Railway URL

BASE_URL="${API_URL:-https://90plus-app-production-c88c.up.railway.app}"
TOKEN="${TEST_TOKEN:-}"

PASS=0
FAIL=0

check() {
    local description=$1
    local expected=$2
    local actual=$3
    
    if [ "$actual" = "$expected" ]; then
        echo "✅ $description → $actual"
        PASS=$((PASS + 1))
    else
        echo "❌ $description → got $actual, expected $expected"
        FAIL=$((FAIL + 1))
    fi
}

echo "======================================="
echo "90Plus Reels — Full API Test Suite"
echo "======================================="
echo "Testing: $BASE_URL"
echo ""

# 1. Feed (no auth)
echo "Test 1: GET /api/reels/feed (no auth)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/reels/feed")
check "GET /feed (no auth)" "401" "$STATUS"

# 2. Feed (with auth)
if [ -z "$TOKEN" ]; then
    echo "⚠️  No TOKEN provided - skipping authenticated tests"
    echo "Set TOKEN environment variable to run full test suite"
    exit 0
fi

echo ""
echo "Test 2: GET /api/reels/feed (with auth)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/reels/feed")
check "GET /feed (with auth)" "200" "$STATUS"

# 3. Feed pagination
echo ""
echo "Test 3: GET /api/reels/feed?limit=5"
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/reels/feed?limit=5")
COUNT=$(echo $RESPONSE | jq '.data | length' 2>/dev/null || echo "0")
echo "📊 Feed returned $COUNT items (expected ≤ 5)"

# Get first reel ID for remaining tests
REEL_ID=$(echo $RESPONSE | jq -r '.data[0].id' 2>/dev/null || echo "")
echo "📝 Using reel ID: $REEL_ID"

if [ -z "$REEL_ID" ] || [ "$REEL_ID" = "null" ]; then
    echo "⚠️  No reels found — skipping reel-specific tests"
else
    # 4. Like
    echo ""
    echo "Test 4: POST /api/reels/:id/like"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/reels/$REEL_ID/like")
    check "POST /reels/:id/like" "200" "$STATUS"
    
    # 5. Unlike
    echo ""
    echo "Test 5: DELETE /api/reels/:id/like"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/reels/$REEL_ID/like")
    check "DELETE /reels/:id/like" "200" "$STATUS"
    
    # 6. Add comment
    echo ""
    echo "Test 6: POST /api/reels/:id/comments"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"content":"Great reel! ⚽"}' \
        "$BASE_URL/api/reels/$REEL_ID/comments")
    check "POST /reels/:id/comments" "201" "$STATUS"
    
    # 7. Get comments
    echo ""
    echo "Test 7: GET /api/reels/:id/comments"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/reels/$REEL_ID/comments")
    check "GET /reels/:id/comments" "200" "$STATUS"
    
    # 8. View
    echo ""
    echo "Test 8: POST /api/reels/:id/view"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/reels/$REEL_ID/view")
    check "POST /reels/:id/view" "200" "$STATUS"
    
    # 9. Report valid
    echo ""
    echo "Test 9: POST /api/reels/:id/report (valid)"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"reason":"spam"}' \
        "$BASE_URL/api/reels/$REEL_ID/report")
    check "POST /reels/:id/report (valid)" "200" "$STATUS"
    
    # 10. Report invalid reason
    echo ""
    echo "Test 10: POST /api/reels/:id/report (invalid reason)"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"reason":"bad_reason"}' \
        "$BASE_URL/api/reels/$REEL_ID/report")
    check "POST /reels/:id/report (invalid reason)" "400" "$STATUS"
fi

# 11. Webhook without signature
echo ""
echo "Test 11: POST /api/webhooks/mux (no signature)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"type":"video.asset.ready"}' \
    "$BASE_URL/api/webhooks/mux")
check "POST /webhooks/mux (no signature)" "401" "$STATUS"

# 12. Health check
echo ""
echo "Test 12: GET /health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
check "GET /health" "200" "$STATUS"

echo ""
echo "======================================="
echo "Results: $PASS passed, $FAIL failed"
echo "======================================="

if [ $FAIL -gt 0 ]; then
    echo "❌ Fix the $FAIL failing tests before pushing to Git"
    exit 1
else
    echo "✅ All tests passed — ready for Git push"
    exit 0
fi
