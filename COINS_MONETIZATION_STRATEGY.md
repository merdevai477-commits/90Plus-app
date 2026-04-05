# Coins Monetization Strategy

## 🪙 CURRENT COIN SYSTEM

### How Users Earn Coins (FREE)
1. **Daily Login**: 10 coins per day
2. **Quiz Completion**: 10-30 coins per quiz (based on difficulty)
3. **Daily Spin Wheel**: Random coins (5-100)
4. **Achievements**: Various coin rewards
5. **Reel Rewards**: Coins for popular content
6. **Predictions**: Win coins for correct match predictions

### How Users Spend Coins
1. **Match Predictions**: 5 coins per prediction
2. **Profile Customization**: Coins for special items (if implemented)
3. **Boosts/Power-ups**: (if implemented)

## 🍎 APPLE IAP COMPLIANCE

### ⚠️ CRITICAL DECISION NEEDED

**Question**: Will users be able to PURCHASE coins with real money?

### Option 1: FREE ONLY (RECOMMENDED for Quick Approval)
**Status**: ✅ NO IAP NEEDED
**Implementation**: 
- Coins are earned ONLY through gameplay
- NO option to buy coins with real money
- Add clear disclaimer in app

**Disclaimer to Add**:
```
"Coins are a free in-game currency that can only be earned through gameplay. 
Coins cannot be purchased with real money."
```

**Pros**:
- ✅ No IAP implementation needed
- ✅ Faster Apple approval
- ✅ No revenue sharing with Apple (30%)
- ✅ Simpler app architecture

**Cons**:
- ❌ No direct monetization from coins
- ❌ Limited revenue potential

---

### Option 2: PURCHASABLE COINS (Requires Apple IAP)
**Status**: ⚠️ REQUIRES IMPLEMENTATION
**Apple Requirement**: MUST use Apple In-App Purchases (IAP)

**Implementation Required**:
1. Install `expo-in-app-purchases`
2. Configure IAP products in App Store Connect
3. Implement purchase flow
4. Handle receipt validation
5. Sync purchases with backend
6. Handle refunds and disputes

**IAP Products Example**:
- 100 coins: $0.99
- 500 coins: $4.99
- 1,000 coins: $8.99
- 2,500 coins: $19.99

**Pros**:
- ✅ Direct monetization
- ✅ Revenue from engaged users

**Cons**:
- ❌ 30% revenue share to Apple
- ❌ Complex implementation
- ❌ Longer approval process
- ❌ Requires financial setup in App Store Connect

---

## 📊 RECOMMENDATION

### For Initial Launch: Option 1 (FREE ONLY)

**Reasons**:
1. **Faster to Market**: No IAP implementation delays
2. **Simpler Approval**: Less scrutiny from Apple
3. **User Growth**: Free coins encourage engagement
4. **Monetization Later**: Can add IAP in future updates

### Future Monetization Options:
1. **Ads**: Display ads for bonus coins
2. **Premium Subscription**: Ad-free + bonus coins
3. **Sponsored Content**: Partner with brands
4. **IAP**: Add purchasable coins later

---

## 🔧 IMPLEMENTATION STEPS

### If Choosing Option 1 (FREE ONLY):

1. **Add Disclaimer to App**:
   - Settings page
   - Coins page
   - Terms of Service

2. **Update App Store Description**:
   ```
   "Earn coins through gameplay - no purchases required!"
   ```

3. **No Code Changes Needed**: Current system already supports free-only

---

### If Choosing Option 2 (PURCHASABLE):

1. **Install Dependencies**:
   ```bash
   cd front
   npx expo install expo-in-app-purchases
   ```

2. **Configure App Store Connect**:
   - Create IAP products
   - Set pricing tiers
   - Add product descriptions

3. **Implement Purchase Flow**:
   - Create `CoinPurchaseScreen.tsx`
   - Add purchase buttons
   - Handle purchase validation
   - Sync with backend

4. **Backend Changes**:
   - Add IAP receipt validation endpoint
   - Store purchase records
   - Handle refunds

5. **Testing**:
   - Test with sandbox accounts
   - Verify receipt validation
   - Test refund scenarios

---

## 🚨 APPLE REVIEW GUIDELINES

### What Apple REQUIRES:
1. If coins are purchasable → MUST use Apple IAP
2. Cannot use external payment systems (Stripe, PayPal, etc.)
3. Cannot link to external purchase pages
4. Must clearly show what users get for their money

### What Apple REJECTS:
- ❌ Coins purchasable outside the app
- ❌ Using third-party payment processors
- ❌ Misleading users about purchases
- ❌ Unclear pricing or value

---

## 💡 DECISION MATRIX

| Factor | Free Only | Purchasable |
|--------|-----------|-------------|
| Time to Launch | ✅ Fast | ❌ Slow |
| Apple Approval | ✅ Easy | ⚠️ Moderate |
| Revenue Potential | ❌ Low | ✅ High |
| Implementation Cost | ✅ None | ❌ High |
| User Experience | ✅ Simple | ⚠️ Complex |
| Maintenance | ✅ Low | ❌ High |

---

## 📝 FINAL RECOMMENDATION

**For 90Plus v1.0**: Choose **Option 1 (FREE ONLY)**

**Rationale**:
1. Get to market faster
2. Build user base first
3. Validate engagement metrics
4. Add monetization in v1.1 based on data

**Next Steps**:
1. Add "Free Coins Only" disclaimer to app
2. Update App Store description
3. Focus on user growth
4. Plan IAP for v1.1 if metrics support it

---

## 🔄 MIGRATION PATH (Free → Purchasable)

If you decide to add IAP later:

1. **v1.0**: Free coins only
2. **v1.1**: Add IAP option
3. **Communication**: "New feature: Buy coins to support the app!"
4. **Grandfathering**: Existing users keep free earning methods

This approach:
- ✅ Doesn't alienate early users
- ✅ Provides monetization option
- ✅ Maintains free-to-play core
