#!/bin/bash
# Script to reset daily quiz
# Usage: 
#   ./reset-daily-quiz.sh -k YOUR_SECRET_KEY  (Recommended - no auth needed)
#   ./reset-daily-quiz.sh -t YOUR_CLERK_TOKEN (Alternative - requires auth)

API_KEY=""
TOKEN=""
API_URL="${API_URL:-https://90plus-app-production.up.railway.app/api}"

while [[ $# -gt 0 ]]; do
    case $1 in
        -k|--key)
            API_KEY="$2"
            shift 2
            ;;
        -t|--token)
            TOKEN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$API_KEY" ] && [ -z "$TOKEN" ]; then
    echo "❌ Error: Either API key or Token is required"
    echo "Usage: ./reset-daily-quiz.sh -k YOUR_SECRET_KEY"
    echo "   OR: ./reset-daily-quiz.sh -t YOUR_CLERK_TOKEN"
    exit 1
fi

ENDPOINT="$API_URL/quiz/reset-daily"

echo "🔄 Resetting daily quiz..."
echo "Endpoint: $ENDPOINT"
echo ""

# بناء Headers
HEADERS=(-H "Content-Type: application/json")
if [ -n "$API_KEY" ]; then
    HEADERS+=(-H "X-API-Key: $API_KEY")
    echo "Using API Key authentication"
elif [ -n "$TOKEN" ]; then
    HEADERS+=(-H "Authorization: Bearer $TOKEN")
    echo "Using Bearer token authentication"
fi
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" "${HEADERS[@]}")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo "✅ Daily quiz reset successfully!"
    echo ""
    echo "Quiz Details:"
    echo "$body" | jq -r '.data | "  - Quiz ID: \(.quizId)\n  - Category: \(.categoryName) (\(.categoryId))\n  - Questions: \(.questionCount)\n  - Expires At: \(.expiresAt)\n  - Users Reset: \(.usersReset)"'
else
    echo "❌ Error resetting daily quiz (HTTP $http_code)"
    echo "$body" | jq -r '.message // .'
    exit 1
fi

