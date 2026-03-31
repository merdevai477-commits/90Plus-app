#!/bin/bash

# GDPR Endpoints Testing Script
# Tests all 7 GDPR endpoints locally

API_URL="http://localhost:3000/api"
TOKEN="YOUR_CLERK_TOKEN_HERE"

echo "🧪 Testing GDPR Endpoints..."
echo "================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Get Consent
echo -e "\n${YELLOW}1. GET /gdpr/consent${NC}"
curl -X GET "$API_URL/gdpr/consent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Test 2: Update Consent
echo -e "\n${YELLOW}2. POST /gdpr/consent${NC}"
curl -X POST "$API_URL/gdpr/consent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"consentType":"ANALYTICS","granted":false}' \
  -w "\nStatus: %{http_code}\n"

# Test 3: Request Data Export
echo -e "\n${YELLOW}3. POST /gdpr/export-data${NC}"
EXPORT_RESPONSE=$(curl -X POST "$API_URL/gdpr/export-data" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n")
echo "$EXPORT_RESPONSE"

# Extract requestId from response
REQUEST_ID=$(echo "$EXPORT_RESPONSE" | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)

# Test 4: Get Export Status
if [ ! -z "$REQUEST_ID" ]; then
  echo -e "\n${YELLOW}4. GET /gdpr/export-status/$REQUEST_ID${NC}"
  curl -X GET "$API_URL/gdpr/export-status/$REQUEST_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n"
fi

# Test 5: Get Deletion Status
echo -e "\n${YELLOW}5. GET /gdpr/deletion-status${NC}"
curl -X GET "$API_URL/gdpr/deletion-status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Test 6: Request Account Deletion
echo -e "\n${YELLOW}6. POST /gdpr/delete-account${NC}"
curl -X POST "$API_URL/gdpr/delete-account" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Testing GDPR compliance"}' \
  -w "\nStatus: %{http_code}\n"

# Test 7: Cancel Account Deletion
echo -e "\n${YELLOW}7. POST /gdpr/cancel-deletion${NC}"
curl -X POST "$API_URL/gdpr/cancel-deletion" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

echo -e "\n${GREEN}✅ All tests completed!${NC}"
echo "================================"
