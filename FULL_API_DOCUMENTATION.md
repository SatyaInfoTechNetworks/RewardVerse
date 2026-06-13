# 📱 Rewardverse – Full API Documentation
> **Version**: 2.0 | **Base URL**: `https://rewardverse-api.satyainfotechnetworks.com`
> 
> This document is the single source of truth for every API endpoint sent from the backend to the Android frontend (and admin panel). Each section shows the exact JSON shape the server returns.

---

## 📋 Table of Contents

1. [Global Headers & Auth](#global-headers--auth)
2. [Authentication Endpoints](#1-authentication-endpoints)
3. [User Profile & Stats](#2-user-profile--stats)
4. [Spin & Scratch](#3-spin--scratch)
5. [Daily Streak / Check-in](#4-daily-streak--check-in)
6. [Wallet & Earnings](#5-wallet--earnings)
7. [Offers / Offerwall](#6-offers--offerwall)
8. [Visit & Earn](#7-visit--earn)
9. [Referral System](#8-referral-system)
10. [Lifafa (Surprise Envelopes)](#9-lifafa-surprise-envelopes)
11. [Contests & Giveaways](#10-contests--giveaways)
12. [Feed, Banners & Leaderboard](#11-feed-banners--leaderboard)
13. [Other Apps Section](#12-other-apps-section)
14. [Support Tickets](#13-support-tickets)
15. [App Configuration](#14-app-configuration)
16. [Telegram Verification](#15-telegram-verification)
17. [Ad Network Webhooks (Postbacks)](#16-ad-network-webhooks-postbacks)
18. [Admin Panel Endpoints](#17-admin-panel-endpoints)

---

## 🛡️ Global Headers & Auth

### Firebase App Check (Public auth routes only)
All `/api/auth/*` routes require Firebase App Check to verify requests come from the real APK.
```
Header: X-Firebase-AppCheck: <appcheck_token>
```

### JWT Bearer Token (All protected user routes)
After login/signup, store the JWT and send it on every authenticated call.
```
Header: Authorization: Bearer <jwt_token>
```

### Admin JWT (All `/api/admin/*` routes)
Admin routes use a separate admin JWT obtained via `POST /api/admin/login`.
```
Header: Authorization: Bearer <admin_jwt_token>
```

---

## 1. Authentication Endpoints

### 1.1 Check Firebase UID Registration
> Checks if a user is already registered before showing signup vs login screen.

- **Route**: `POST /api/auth/check_uid` *(alias: `/api/auth/check_uid.php`)*
- **Auth**: `X-Firebase-AppCheck`
- **Request**:
```json
{ "uid": "firebase_uid_string" }
```
- **Response**:
```json
{ "success": true, "registered": true }
```

---

### 1.2 Google Sign-In / Login
> Called after user successfully signs in with Google. Returns JWT + user object.

- **Route**: `POST /api/auth/google` *(alias: `/api/auth/google.php`)*
- **Auth**: `X-Firebase-AppCheck`
- **Request**:
```json
{
  "idToken": "google_id_token_string",
  "androidId": "device_android_id"
}
```
- **Response**:
```json
{
  "success": true,
  "token": "eyJhbGci...(JWT)...",
  "user": {
    "id": 19,
    "uid": "firebase_uid_here",
    "email": "user@gmail.com",
    "name": "User Name",
    "profile_pic": "https://lh3.googleusercontent.com/...",
    "balance": 150.00,
    "referral_code": "R12A34",
    "user_id": "ABCDEF1234",
    "is_banned": false
  }
}
```

---

### 1.3 User Sign-Up (New Registration)
> Register new user after Google Sign-In. Welcome bonus is credited here.

- **Route**: `POST /api/auth/signup` *(alias: `/api/auth/signup.php`)*
- **Auth**: `X-Firebase-AppCheck`
- **Request**:
```json
{
  "email": "user@gmail.com",
  "name": "User Name",
  "profilePic": "https://...",
  "uid": "firebase_uid_here",
  "androidId": "device_android_id",
  "referredByCode": "INVITE123"
}
```
> ⚠️ `referredByCode` is **optional**. If blank or invalid, welcome bonus still credits – the referral reward simply won't apply.

- **Response**:
```json
{
  "success": true,
  "token": "eyJhbGci...(JWT)...",
  "user": {
    "id": 20,
    "email": "user@gmail.com",
    "name": "User Name",
    "referral_code": "XYZABC"
  }
}
```

---

## 2. User Profile & Stats

### 2.1 Get Full User Profile
> Returns user data + computed lifetime stats. Used by ProfileScreen.

- **Route**: `GET /api/user/profile` *(alias: `/api/user/profile.php`)*
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "user": {
    "id": 19,
    "uid": "firebase_uid",
    "email": "user@gmail.com",
    "name": "User Name",
    "profile_pic": "https://...",
    "balance": 250.00,
    "referral_code": "R12A34",
    "user_id": "ABCDEF1234",
    "is_banned": false,
    "created_at": "2026-05-01T10:00:00.000Z",
    "stats": {
      "totalEarnings": 850.00,
      "totalWithdrawn": 500.00,
      "completedOffers": 12,
      "totalReferrals": 5
    }
  }
}
```
> 📌 `balance` = current wallet coins. `stats.totalEarnings` = all-time CREDIT sum from `transactions` table.

---

### 2.2 Get Dashboard Stats
> Lightweight stats for home screen. Returns total earned & withdrawn.

- **Route**: `GET /api/user/stats` *(alias: `/api/user/stats.php`)*
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "stats": {
    "total_earned": 850.00,
    "total_withdrawn": 500.00
  }
}
```

---

### 2.3 Update FCM Push Token
> Must be called after login and whenever the FCM token refreshes.

- **Route**: `POST /api/user/fcm-token` *(aliases: `/api/user/update_fcm.php`, `/api/user/update_fcm`)*
- **Auth**: `Bearer JWT`
- **Request**:
```json
{ "fcm_token": "fcm_device_push_token_here" }
```
- **Response**:
```json
{ "success": true, "message": "FCM token updated successfully" }
```

---

## 3. Spin & Scratch

### 3.1 Get Spin Status
> Check how many spins are remaining today and the reward probability config.

- **Route**: `GET /api/user/spin` *(alias: `/api/user/spin.php`)*
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "data": {
    "spins_left": 2,
    "daily_limit": 2,
    "total_spins": 10,
    "probabilities_config": [
      { "type": "COINS", "prob": 25, "range": [5, 10] },
      { "type": "COINS", "prob": 45, "range": [10, 20] },
      { "type": "NONE",  "prob": 30, "range": [0, 0] }
    ]
  }
}
```

---

### 3.2 Perform a Spin
> Server-side weighted random spin. Result is computed server-side (tamper-proof).

- **Route**: `POST /api/user/spin` *(alias: `/api/user/spin.php`)*
- **Auth**: `Bearer JWT`
- **Request**: No body required.
- **Win Response**:
```json
{
  "success": true,
  "amount": 15,
  "type": "COINS",
  "spins_left": 1,
  "message": "You won 15 coins!"
}
```
- **No Win Response**:
```json
{
  "success": true,
  "amount": 0,
  "type": "NONE",
  "spins_left": 1,
  "message": "Better luck next time!"
}
```
- **Limit Reached Response**:
```json
{
  "success": false,
  "message": "No spins left for today! Try again tomorrow."
}
```

---

## 4. Daily Streak / Check-in

### 4.1 Get Streak Status
> Returns current streak, whether user can claim today, and the rewards config table.

- **Route**: `GET /api/user/streak` *(alias: `/api/user/streak.php`)*
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "data": {
    "current_streak": 3,
    "last_claim_date": "2026-06-12",
    "can_claim": true,
    "next_reward": 50,
    "rewards_config": {
      "1": 30,
      "2": 40,
      "3": 50,
      "4": 60,
      "5": 70,
      "6": 80,
      "7": 200
    }
  }
}
```

---

### 4.2 Daily Check-in / Claim Streak
> Claims today's streak reward. Returns the amount awarded and new streak level.

- **Route**: `POST /api/user/daily-checkin` *(aliases: `/api/user/streak.php`, `/api/user/streak`)*
- **Auth**: `Bearer JWT`
- **Request**: No body required.
- **Success Response**:
```json
{
  "success": true,
  "message": "Streak claimed!",
  "claimed_amount": 50.00,
  "new_streak": 3
}
```
- **Already Claimed Response**:
```json
{
  "success": false,
  "message": "Already claimed today."
}
```

---

## 5. Wallet & Earnings

### 5.1 Get Wallet Balance (Full Summary)
> Used by WalletScreen to show balance, total earned, withdrawn, and pending amounts.

- **Route**: `GET /api/wallet/balance` *(alias: `/api/wallet/balance.php`)*
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "balance": 250.00,
  "totalEarnings": 850.00,
  "totalWithdrawn": 500.00,
  "pendingWithdrawals": 100.00
}
```

---

### 5.2 Get Earnings History (Credit Transactions)
> Paginated list of all earning events with icons per source type.

- **Route**: `GET /api/wallet/earnings?page=1&limit=20`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid-string",
      "amount": 50.00,
      "type": "CREDIT",
      "source": "LIFAFA_BONUS",
      "description": "Lifafa Bonus",
      "iconUrl": "https://i.ibb.co/vvHv7WTx/envelope.png",
      "date": "2026-06-13T10:00:00.000Z",
      "referenceId": "ref-uuid"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 98,
    "limit": 20
  }
}
```

**Transaction Source → Icon Mapping:**
| `source` value | Description | Icon |
|---|---|---|
| `STREAK_REWARD` / `DAILY_BONUS` | Daily check-in | calendar icon |
| `LUCKY_SPIN` | Spin wheel | spin wheel icon |
| `SCRATCH_CARD` | Scratch card | scratch card icon |
| `LIFAFA_BONUS` | Lifafa envelope | envelope icon |
| `WELCOME_BONUS` | Signup bonus | gift icon |
| `REFERRAL` / `REFERRAL_BONUS` | Referral reward | people icon |
| `COMMISSION` | Referral commission | people icon |
| `PUBSCALE` | PubScale offer | pubscale logo |
| `CPX_RESEARCH` | CPX survey | CPX logo |
| `OFFERMARU` | Offermaru offer | offermaru logo |
| `GROWDECK` | Growdeck offer | growdeck logo |
| `ADJUMP` | AdJump offer | adjump logo |
| `REAL_OPINION` | RealOpinion | realopinion logo |
| `PLAYTIME` | Playtime Ads | playtime logo |
| `POCKETSFULL` | Pocketsfull | pocketsfull logo |
| `OFFER` / `OFFLINE_OFFER` | Manual offer | gift icon |
| `MANUAL_ADJUSTMENT` | Admin credit | admin icon |
| `WITHDRAWAL` | Withdrawal debit | wallet icon |

---

### 5.3 Get Redemption History
> Paginated list of withdrawal requests.

- **Route**: `GET /api/wallet/redeems?page=1&limit=20`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "withdrawals": [
    {
      "id": "withdrawal-uuid",
      "amount": 500,
      "amountCoins": 500,
      "amountCurrency": 50.00,
      "method": "UPI Transfer",
      "methodId": "upi_id",
      "methodLogo": "https://...",
      "details": "user@upi",
      "status": "PENDING",
      "statusText": "Pending",
      "date": "2026-06-10T12:00:00.000Z",
      "redeemCode": null
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalCount": 25,
    "limit": 20
  }
}
```
> `status` values: `PENDING` | `APPROVED` | `REJECTED`  
> `redeemCode` is populated for Gift Card type redemptions when approved.

---

### 5.4 Get Payout Methods & Tiers
> Returns all active payout methods with their coin tiers.

- **Route**: `GET /api/wallet/payout-methods` *(alias: `/api/wallet/payout_methods.php`)*
- **Auth**: None required
- **Response**:
```json
{
  "success": true,
  "methods": [
    {
      "id": "upi_id",
      "name": "UPI Transfer",
      "description": "Direct UPI transfer to your account.",
      "iconUrl": "https://...",
      "minCoins": 100,
      "conversionRate": 0.10,
      "currencySymbol": "₹",
      "processingTime": "24 Hours",
      "fields": [
        { "label": "Enter UPI ID", "placeholder": "user@ybl", "type": "text" }
      ],
      "isActive": true,
      "tiers": [
        { "id": "1", "coinCost": 100, "monetaryValue": 10.00, "currencySymbol": "₹" },
        { "id": "2", "coinCost": 500, "monetaryValue": 55.00, "currencySymbol": "₹" }
      ]
    },
    {
      "id": "bank_transfer",
      "name": "Bank Transfer",
      "description": "Direct bank transfer to your account.",
      "iconUrl": "https://...",
      "minCoins": 5000,
      "conversionRate": 0.10,
      "currencySymbol": "₹",
      "processingTime": "48 Hours",
      "fields": [
        { "label": "Bank Name", "placeholder": "e.g. HDFC Bank", "type": "text" },
        { "label": "Account Number", "placeholder": "e.g. 123456789", "type": "number" },
        { "label": "IFSC Code", "placeholder": "e.g. HDFC0001234", "type": "text" }
      ],
      "isActive": true,
      "tiers": [
        { "id": "3", "coinCost": 5000, "monetaryValue": 500.00, "currencySymbol": "₹" }
      ]
    }
  ]
}
```

> [!NOTE]
> **Form Fields Structure:** The backend returns a structured `fields` array containing the `label`, `placeholder`, and `type` for each required user input. The client application iterates over this array to dynamically build the withdrawal form.

---

### 5.5 Request Withdrawal (Redeem Coins)
> Submit a redemption request. Coins are deducted immediately from user's balance.

- **Route**: `POST /api/wallet/withdraw` *(alias: `/api/wallet/withdraw.php`)*
- **Auth**: `Bearer JWT`
- **Request (Single Input Field)**:
```json
{
  "amount": 500,
  "method_id": "upi_id",
  "details": "user@ybl"
}
```

- **Request (Multiple Input Fields)**:
For payout methods with multiple comma-separated input fields (e.g. Bank Transfer), submit the `details` parameter as a key-value JSON object:
```json
{
  "amount": 5000,
  "method_id": "bank_transfer",
  "details": {
    "Bank Name": "HDFC Bank",
    "Account Number": "123456789",
    "IFSC Code": "HDFC0001234"
  }
}
```
- **Success Response**:
```json
{
  "success": true,
  "message": "Withdrawal submitted successfully!",
  "transactionId": "withdrawal-uuid"
}
```
- **Error Responses**:
```json
{ "success": false, "code": "INSUFFICIENT_BALANCE", "message": "Insufficient balance" }
{ "success": false, "message": "Daily withdrawal limit of 3 times reached. Please try again tomorrow." }
{ "success": false, "message": "Minimum withdrawal for UPI Transfer is 100 coins." }
```

---

### 5.6 Get All Transactions (Ledger)
> Combined credit & debit ledger.

- **Route**: `GET /api/wallet/transactions`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "transactions": [
    {
      "id": "trans-uuid",
      "amount": 50.00,
      "type": "CREDIT",
      "source": "STREAK_REWARD",
      "description": "Daily Streak Bonus",
      "iconUrl": "https://img.icons8.com/color/96/calendar.png",
      "created_at": "2026-06-13T10:00:00.000Z",
      "reference_id": ""
    }
  ]
}
```

---

## 6. Offers / Offerwall

### 6.1 List All Offers
- **Route**: `GET /api/offers` *(aliases: `/api/offers/list.php`, `/api/offers/list`)*
- **Auth**: None required
- **Response**:
```json
{
  "success": true,
  "offers": [
    {
      "id": "offer-uuid",
      "title": "Download & Play Game",
      "description": "Install the game and reach level 10.",
      "icon_url": "https://...",
      "coins": 500,
      "category": "GAMES",
      "is_active": true,
      "is_hot": false
    }
  ]
}
```

### 6.2 Get Offer Detail
- **Route**: `GET /api/offers/:id` *(aliases: `/api/offers/detail`, `/api/offers/detail.php`)*
- **Auth**: None required
- **Response**: Full offer object including tiers, instructions, etc.

### 6.3 Get Hot Offers
- **Route**: `GET /api/offers/hot` *(alias: `/api/offers/hot.php`)*
- **Auth**: None required

### 6.4 Start/Track Offer
- **Route**: `POST /api/offers/start`
- **Auth**: `Bearer JWT`
- **Request**: `{ "offerId": "offer-uuid" }`
- **Response**: `{ "success": true, "clickId": "click-tracking-uuid", "offerUrl": "https://..." }`

### 6.5 Submit Offer Proof
- **Route**: `POST /api/offers/submit-proof`
- **Auth**: `Bearer JWT`
- **Request**: `{ "clickId": "uuid", "proofImageUrl": "https://..." }`
- **Response**: `{ "success": true, "message": "Proof submitted for review." }`

---

## 7. Visit & Earn

### 7.1 List Visit & Earn Tasks
- **Route**: `GET /api/visit-earn`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Visit Google News",
      "coins": 5,
      "visit_url": "https://news.google.com",
      "timer_seconds": 30,
      "is_active": true
    }
  ]
}
```

### 7.2 Claim Visit Task Coins
- **Route**: `POST /api/visit-earn/claim`
- **Auth**: `Bearer JWT`
- **Request**: `{ "taskId": "task-uuid" }`
- **Response**:
```json
{
  "success": true,
  "message": "Claimed 5 coins successfully for task visit!"
}
```

---

## 8. Referral System

### 8.1 Get Referral Info (Full List of Referred Users)
> Used on ReferralScreen to show all people you referred.

- **Route**: `GET /api/referral/info`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "referral_code": "R12A34",
  "settings": {
    "bonus_coins": 1000,
    "commission_percent": 10,
    "offers_required": 2,
    "description_text": "Refer friends to earn more!"
  },
  "referrals": [
    {
      "id": "ref-uuid",
      "status": "PENDING",
      "offers_completed_count": 1,
      "created_at": "2026-06-01T10:00:00.000Z",
      "referred_user_name": "John Doe",
      "referred_user_pic": "https://..."
    }
  ]
}
```
> `status` values: `PENDING` | `REWARDED`

---

### 8.2 Get Referral Summary (Counts)
> Quick summary for dashboard widgets.

- **Route**: `GET /api/referral/summary`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "data": {
    "total_referrals": 10,
    "pending_referrals": 4,
    "earned_referrals": 6
  }
}
```

---

### 8.3 Get Referral History (With User Details)
> Detailed history of each referred person and their progress.

- **Route**: `GET /api/referral/history`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 12345678,
      "referred_user_id": 87654321,
      "referred_user_name": "Priya Sharma",
      "referred_user_pic": "https://...",
      "status": "REWARDED",
      "offers_completed_count": 3,
      "created_at": "2026-05-20T08:00:00.000Z"
    }
  ],
  "message": "Success"
}
```
> IDs are deterministically hashed to integers (to avoid Kotlin UUID parsing crash).

---

### 8.4 Get Referral Config
> Public endpoint. Returns reward rules to show on referral info screen.

- **Route**: `GET /api/referral/config`
- **Auth**: None required
- **Response**:
```json
{
  "success": true,
  "data": {
    "bonus_coins": 1000,
    "commission_percent": 10,
    "offers_required": 2,
    "description_text": "Refer friends to earn more!",
    "reward_trigger": "offers_completed",
    "coin_threshold": 500,
    "referrer_coins": 100
  }
}
```
> `reward_trigger` can be `"offers_completed"` or `"first_withdrawal"` — controls when referrer gets rewarded.

---

### 8.5 Get Referral Status (For Current User as Referred Person)
> Shows the current user's progress as the referred person.

- **Route**: `GET /api/referral/status`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "status": "PENDING",
  "offers_completed_count": 1,
  "offers_needed": 2,
  "message": "1 more offer needed"
}
```

---

## 9. Lifafa (Surprise Envelopes)

### 9.1 Get Lifafa Details (Before Claiming)
> Validate and show the Lifafa preview screen with amount & limit info.

- **Route**: `GET /api/lifafa/detail/:id` *(aliases: `/api/lifafa/detail`, `/api/lifafa/detail.php`)*
- **Auth**: None required (but claim requires JWT)
- **Example**: `GET /api/lifafa/detail/HAPPYNEWYEAR`
- **Success Response**:
```json
{
  "success": true,
  "lifafa": {
    "lifafa_id": "HAPPYNEWYEAR",
    "bonus_amount": 50.00,
    "total_limit": 100,
    "claimed_count": 42,
    "is_active": true
  }
}
```
- **Error Responses**:
```json
{ "success": false, "message": "Lifafa not found" }
{ "success": false, "message": "This Lifafa is inactive" }
{ "success": false, "message": "This Lifafa has expired" }
{ "success": false, "message": "This Lifafa has been fully claimed" }
```

---

### 9.2 Claim Lifafa Reward
> Claim coins from a Lifafa envelope. Atomic DB transaction.

- **Route**: `POST /api/lifafa/claim` *(alias: `/api/lifafa/claim.php`)*
- **Auth**: `Bearer JWT`
- **Request**:
```json
{ "lifafaId": "HAPPYNEWYEAR" }
```
- **Success Response**:
```json
{
  "success": true,
  "message": "Congratulations! You claimed 50.00 coins successfully.",
  "amount": 50.00
}
```
- **Error Responses**:
```json
{ "success": false, "message": "You have already claimed this Lifafa." }
{ "success": false, "message": "This Lifafa has been fully claimed" }
```

---

## 10. Contests & Giveaways

### 10.1 Get Active Contests
> List of all ongoing contests visible to the user.

- **Route**: `GET /api/contests/active`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "contests": [
    {
      "id": "contest-uuid",
      "title": "Mega Lucky Draw",
      "description": "Win ₹500 Amazon gift card!",
      "type": "LUCKY_DRAW",
      "prize_description": "₹500 Amazon Gift Card",
      "prize_type": "GIFT_CARD",
      "prize_value": 500,
      "ends_at": "2026-06-30T23:59:59.000Z",
      "entry_count": 150,
      "max_entries_per_user": 5,
      "entry_fee_coins": 0,
      "is_free_entry": true
    }
  ]
}
```
> `type` values: `LUCKY_DRAW` | `LEAGUE`

---

### 10.2 Get Contest Detail
> Full details for a specific contest including user's current entry count.

- **Route**: `GET /api/contests/:id`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "contest": {
    "id": "contest-uuid",
    "title": "Mega Lucky Draw",
    "type": "LUCKY_DRAW",
    "prize_description": "₹500 Amazon Gift Card",
    "prize_type": "GIFT_CARD",
    "prize_value": 500,
    "ends_at": "2026-06-30T23:59:59.000Z",
    "entry_fee_coins": 10,
    "is_free_entry": false,
    "is_ad_entry": true,
    "daily_entry_limit": 3,
    "user_entries_today": 1,
    "user_total_entries": 3,
    "total_entries": 250
  }
}
```

---

### 10.3 Enter Contest
> Submit an entry to a contest. Handles free, ad-watch, or coin-purchase entries.

- **Route**: `POST /api/contests/:id/enter`
- **Auth**: `Bearer JWT`
- **Request**:
```json
{ "entryType": "FREE" }
```
> `entryType` values: `FREE` | `AD` | `COINS`

- **Success Response**:
```json
{
  "success": true,
  "message": "Entry submitted successfully!",
  "entries_added": 1,
  "user_total_entries": 4
}
```
- **Error Responses**:
```json
{ "success": false, "message": "Daily entry limit reached for this contest." }
{ "success": false, "code": "INSUFFICIENT_BALANCE", "message": "Not enough coins." }
```

---

### 10.4 Get Contest Leaderboard
> For LEAGUE type contests — shows ranked list of top participants.

- **Route**: `GET /api/contests/:id/leaderboard`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "user_name": "Top User",
      "profile_pic": "https://...",
      "score": 15000,
      "prize": "₹500 Cash"
    }
  ],
  "user_rank": {
    "rank": 12,
    "score": 3200
  }
}
```

---

### 10.5 Get Contest Winners
> Public endpoint showing past contest results.

- **Route**: `GET /api/contests/winners`
- **Auth**: None required
- **Response**:
```json
{
  "success": true,
  "winners": [
    {
      "contest_title": "Mega Lucky Draw",
      "winner_name": "Priya S.",
      "prize_description": "₹500 Gift Card",
      "won_at": "2026-06-01T15:00:00.000Z"
    }
  ]
}
```

---

## 11. Feed, Banners & Leaderboard

### 11.1 Get Promotion Banners
- **Route**: `GET /api/banners` *(aliases: `/api/banners/list`, `/api/banners/list.php`)*
- **Auth**: None required
- **Response**:
```json
{
  "success": true,
  "banners": [
    {
      "id": "banner-uuid",
      "title": "Special Offer",
      "image_url": "https://...",
      "action_url": "https://...",
      "display_order": 1
    }
  ]
}
```

### 11.2 Get Global Leaderboard
- **Route**: `GET /api/leaderboard/list` *(alias: `/api/leaderboard/list.php`)*
- **Auth**: None required
- **Response**:
```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "name": "Alex",
      "profile_pic": "https://...",
      "total_earned": 5000.00
    }
  ]
}
```

### 11.3 Get Top Earners
- **Route**: `GET /api/leaderboard/top` *(alias: `/api/leaderboard/top_earners.php`)*
- **Auth**: None required

### 11.4 Get Recent Earnings Ticker
> Used for the scrolling feed showing "User X just earned Y coins".

- **Route**: `GET /api/ticker/earnings` *(alias: `/api/ticker/recent_earnings.php`)*
- **Auth**: None required
- **Response**:
```json
{
  "success": true,
  "earnings": [
    {
      "user_name": "Rahul",
      "amount": 500,
      "source": "PUBSCALE",
      "earned_at": "2026-06-13T09:30:00.000Z"
    }
  ]
}
```

---

## 12. Other Apps Section

> Admin-managed section to promote other apps. Displayed in the "Discover" or "More Apps" tab of the Android app.

### 12.1 List Other Apps (User / Frontend)
- **Route**: `GET /api/other-apps` *(aliases: `/api/other-apps/list`, `/api/other-apps/list.php`)*
- **Auth**: None required
- **Response**:
```json
{
  "success": true,
  "apps": [
    {
      "id": "app-uuid",
      "name": "EarnZone",
      "iconUrl": "https://play-lh.googleusercontent.com/...",
      "description": "Earn coins by watching videos and completing tasks.",
      "appUrl": "https://play.google.com/store/apps/details?id=com.earnzone",
      "displayOrder": 1,
      "isActive": true
    }
  ]
}
```
> Only apps with `isActive = true` are returned. Sorted by `displayOrder` ascending.

---

## 13. Support Tickets

### 13.1 Create Support Ticket
- **Route**: `POST /api/tickets`
- **Auth**: `Bearer JWT`
- **Request**:
```json
{
  "subject": "Missing coins for completed offer",
  "message": "I completed the survey but didn't get coins."
}
```
- **Response**:
```json
{ "success": true, "message": "Ticket created successfully.", "ticketId": "ticket-uuid" }
```

### 13.2 List My Tickets
- **Route**: `GET /api/tickets`
- **Auth**: `Bearer JWT`
- **Response**:
```json
{
  "success": true,
  "tickets": [
    {
      "id": "ticket-uuid",
      "subject": "Missing coins",
      "status": "OPEN",
      "created_at": "2026-06-10T10:00:00.000Z"
    }
  ]
}
```

### 13.3 Get Ticket Detail (with replies)
- **Route**: `GET /api/tickets/:id`
- **Auth**: `Bearer JWT`

### 13.4 Reply to Ticket
- **Route**: `POST /api/tickets/:id/reply`
- **Auth**: `Bearer JWT`
- **Request**: `{ "message": "Reply message here" }`

### 13.5 Close Ticket
- **Route**: `POST /api/tickets/:id/close`
- **Auth**: `Bearer JWT`

---

## 14. App Configuration

### 14.1 Get App Config
> Fetched on app startup to check for force updates, links, etc.

- **Route**: `GET /api/config/app-config` *(aliases: `/api/config/app_config`, `/api/config/app_config.php`)*
- **Auth**: None required
- **Response**:
```json
{
  "success": true,
  "config": {
    "app_version": "1.2.0",
    "force_update": false,
    "update_url": "https://play.google.com/store/...",
    "telegram_channel": "@rewardverse",
    "telegram_bot": "rewardverse_bot",
    "support_email": "support@rewardverse.com",
    "maintenance_mode": false
  }
}
```

---

## 15. Telegram Verification

### 15.1 Generate Telegram OTP
> Generates a one-time token for Telegram channel join verification.

- **Route**: `GET /api/telegram/generate` or `POST /api/telegram/generate`
- **Auth**: `Bearer JWT` (via query param or header)
- **Response**:
```json
{
  "success": true,
  "token": "TG-ABCD1234",
  "expires_in": 300
}
```

---

## 16. Ad Network Webhooks (Postbacks)

> These are **server-to-server** endpoints called by ad networks when a user completes an offer. They are NOT called by the Android app.

| Ad Network | Route | Method |
|---|---|---|
| Generic | `/api/webhook/postback` | GET / POST |
| PubScale | `/api/webhook/pubscale` | GET |
| PubScale Chargeback | `/api/webhook/pubscale-chargeback` | GET |
| CPX Research | `/api/webhook/cpx-research` | GET |
| AdJump | `/api/webhook/adjump` | GET |
| Offermaru | `/api/webhook/offermaru` | GET |
| GrowDeck | `/api/webhook/growdeck` | GET |
| OpinionUniverse | `/api/webhook/opinionuniverse` | GET |
| PlaytimeAds | `/api/webhook/playtimeads` | GET / POST |
| Pocketsfull | `/api/webhook/pocketsfull` | GET / POST |
| RealOpinion | `/api/webhook/realopinion` | POST |
| Offer Completed | `/api/webhook/offer-completed` | POST |
| Timewall | `/api/webhook/timewall` | GET / POST |

---

## 17. Admin Panel Endpoints

> All routes require `Authorization: Bearer <admin_jwt>`. Admin login first:
> `POST /api/admin/login` → `{ "username": "admin", "password": "pass" }` → returns `{ "token": "..." }`

### Dashboard
| Route | Method | Description |
|---|---|---|
| `/api/admin/stats` | GET | Overview: users, transactions, revenue |
| `/api/admin/reports` | GET | Detailed financial reports |

### User Management
| Route | Method | Description |
|---|---|---|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/:id` | PUT | Update user details |
| `/api/admin/users/:id/balance` | POST | Add/deduct coins manually |
| `/api/admin/users/:id/ban` | POST | Ban a user |
| `/api/admin/users/:id/unban` | POST | Unban a user |
| `/api/admin/users/:id/fingerprints` | DELETE | Clear device fingerprints |
| `/api/admin/users/:id` | DELETE | Permanently delete user |
| `/api/admin/users/:id/transactions` | GET | User's full transaction ledger |
| `/api/admin/transactions` | GET | All transactions (all users) |
| `/api/admin/transactions/:id` | DELETE | Delete a transaction |
| `/api/admin/users/reset-spins` | POST | Reset daily spins for all users |

### Withdrawal Management
| Route | Method | Description |
|---|---|---|
| `/api/admin/withdrawals` | GET | List all withdrawal requests |
| `/api/admin/withdrawals/:id/approve` | POST | Approve & pay out |
| `/api/admin/withdrawals/:id/reject` | POST | Reject withdrawal |

### Offer Management
| Route | Method | Description |
|---|---|---|
| `/api/admin/offers` | GET | List all offers |
| `/api/admin/offers` | POST | Create new offer |
| `/api/admin/offers/:id` | PUT | Update offer |
| `/api/admin/offers/:id` | DELETE | Delete offer |
| `/api/admin/proofs` | GET | Pending proof submissions |
| `/api/admin/proofs/:clickId/approve` | POST | Approve proof + credit coins |
| `/api/admin/proofs/:clickId/reject` | POST | Reject proof |

### Banners
| Route | Method | Description |
|---|---|---|
| `/api/admin/banners` | GET | List all banners |
| `/api/admin/banners` | POST | Create banner (title, image_url, action_url) |
| `/api/admin/banners/:id` | PUT | Update banner |
| `/api/admin/banners/:id` | DELETE | Delete banner |

### Other Apps Management
| Route | Method | Description |
|---|---|---|
| `/api/admin/other-apps` | GET | List all app promotions |
| `/api/admin/other-apps` | POST | **Create app promotion** |
| `/api/admin/other-apps/:id` | PUT | **Update app promotion** |
| `/api/admin/other-apps/:id` | DELETE | **Delete app promotion** |

**Create/Update Other App – Request Body:**
```json
{
  "name": "EarnZone",
  "icon_url": "https://play-lh.googleusercontent.com/...",
  "description": "Earn coins by watching videos.",
  "app_url": "https://play.google.com/store/apps/details?id=com.earnzone",
  "display_order": 1,
  "is_active": true
}
```

### Lifafa (Surprise Envelopes) Management
| Route | Method | Description |
|---|---|---|
| `/api/admin/lifafas` | GET | List all Lifafas |
| `/api/admin/lifafas` | POST | Create new Lifafa |
| `/api/admin/lifafas/:id` | PUT | Update Lifafa |
| `/api/admin/lifafas/:id` | DELETE | Delete Lifafa |

**Create Lifafa – Request Body:**
```json
{
  "lifafa_id": "HAPPYNEWYEAR",
  "bonus_amount": 50,
  "total_limit": 1000,
  "expires_at": "2026-12-31T23:59:59",
  "is_active": true
}
```

### Contests Management
| Route | Method | Description |
|---|---|---|
| `/api/admin/contests` | GET | List all contests |
| `/api/admin/contests` | POST | Create contest |
| `/api/admin/contests/:id` | PUT | Update contest |
| `/api/admin/contests/:id` | DELETE | Delete contest |
| `/api/admin/contests/:id/entries` | GET | View all entries |
| `/api/admin/contests/:id/draw` | POST | Draw winners (Lucky Draw) |
| `/api/admin/contests/:id/winners` | GET | View drawn winners |
| `/api/admin/contests/winners/:winnerId/give-reward` | POST | Manually give gift card code |

### App Config Management
| Route | Method | Description |
|---|---|---|
| `/api/admin/configs` | GET | List all config keys |
| `/api/admin/configs` | POST | Update a config key |

### Payout Methods Management
| Route | Method | Description |
|---|---|---|
| `/api/admin/payout-methods` | GET | List all payout methods |
| `/api/admin/payout-methods` | POST | Create payout method |
| `/api/admin/payout-methods/:id` | POST | Update payout method |

### Referral Settings
| Route | Method | Description |
|---|---|---|
| `/api/admin/referral-settings` | GET | Get referral config |
| `/api/admin/referral-settings` | POST | Update referral config |

### Notifications
| Route | Method | Description |
|---|---|---|
| `/api/admin/push` | POST | Send push notification to all users |
| `/api/admin/notifications` | GET | Notification history |

### Support Tickets
| Route | Method | Description |
|---|---|---|
| `/api/admin/tickets` | GET | List all tickets |
| `/api/admin/tickets/:id` | GET | Get ticket detail with replies |
| `/api/admin/tickets/:id/reply` | POST | Reply to ticket |
| `/api/admin/tickets/:id/close` | POST | Close ticket |

### Visit & Earn Management
| Route | Method | Description |
|---|---|---|
| `/api/admin/visit-earn` | GET | List all visit tasks |
| `/api/admin/visit-earn` | POST | Create visit task |
| `/api/admin/visit-earn/:id` | PUT | Update visit task |
| `/api/admin/visit-earn/:id` | DELETE | Delete visit task |

### Account Erasure (GDPR)
| Route | Method | Description |
|---|---|---|
| `/api/admin/erasures` | GET | List erasure requests |
| `/api/admin/erasures/:id/approve` | POST | Approve & wipe user data |
| `/api/admin/erasures/:id/reject` | POST | Reject erasure request |

---

## 📝 Error Response Format

All endpoints return errors in this standard format:

```json
{
  "success": false,
  "message": "Human readable error message here"
}
```

For specific cases a `code` field is also included:
```json
{
  "success": false,
  "code": "INSUFFICIENT_BALANCE",
  "message": "Insufficient balance"
}
```

**HTTP Status Codes Used:**
| Code | Meaning |
|---|---|
| `200` | Success (also used for logical errors with `success: false`) |
| `400` | Bad request / validation error |
| `401` | Unauthorized (invalid/missing JWT) |
| `403` | Forbidden (banned user or wrong role) |
| `404` | Resource not found |
| `500` | Internal server error |

---

*Generated from live backend code — [server.js](./Backend/server.js) | Rewardverse v2.0*
