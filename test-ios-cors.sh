#!/bin/bash

# 🍎 iOS CORS Testing Script
# Tests if the backend properly handles iOS/mobile origins

API_URL="https://90plus-app-production-c88c.up.railway.app/api"

echo "🧪 Testing iOS CORS Configuration..."
echo "=================================="
echo ""

# Test 1: Capacitor iOS Origin
echo "Test 1: Capacitor iOS Origin"
echo "----------------------------"
curl -v -X OPTIONS "${API_URL}/clerk/me" \
  -H "Origin: capacitor://localhost" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  2>&1 | grep -E "< HTTP|< Access-Control|< Allow"
echo ""
echo ""

# Test 2: Expo Go Origin
echo "Test 2: Expo Go Origin"
echo "----------------------"
curl -v -X OPTIONS "${API_URL}/clerk/me" \
  -H "Origin: exp://192.168.1.7:8081" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  2>&1 | grep -E "< HTTP|< Access-Control|< Allow"
echo ""
echo ""

# Test 3: File Protocol (iOS)
echo "Test 3: File Protocol (iOS)"
echo "---------------------------"
curl -v -X OPTIONS "${API_URL}/clerk/me" \
  -H "Origin: file://" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  2>&1 | grep -E "< HTTP|< Access-Control|< Allow"
echo ""
echo ""

# Test 4: iOS Bundle ID Origin
echo "Test 4: iOS Bundle ID Origin"
echo "----------------------------"
curl -v -X OPTIONS "${API_URL}/clerk/me" \
  -H "Origin: com.90plus.app://" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  2>&1 | grep -E "< HTTP|< Access-Control|< Allow"
echo ""
echo ""

# Test 5: Health Check (No CORS)
echo "Test 5: Health Check"
echo "--------------------"
curl -s "${API_URL}/health" | head -n 5
echo ""
echo ""

echo "=================================="
echo "✅ Testing Complete!"
echo ""
echo "Expected Results:"
echo "- HTTP/1.1 204 No Content (or 200 OK)"
echo "- Access-Control-Allow-Origin: <origin>"
echo "- Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS"
echo "- Access-Control-Allow-Headers: Content-Type, Authorization, ..."
echo ""
echo "If you see these headers, CORS is configured correctly! ✅"
echo "If not, the backend needs to be redeployed with the new CORS config."
