# 📱 RewardVerse Mobile App Leaderboard API & Integration Guide

This document specifies the exact REST API endpoints, request parameters, JSON response schemas, and FCM push notification specifications for the **RewardVerse Mobile Application (Android / Flutter / Kotlin)**.

---

## 1. 🏆 Leaderboard Home Banner API

Returns summary statistics for the home screen leaderboard widget card.

- **Endpoint**: `GET /api/leaderboards/home-banner`
- **Headers**: `Authorization: Bearer <user_jwt_token>` (Optional, but required to return authenticated user rank & coins needed)

### Response Payload (`200 OK`)
```json
{
  "success": true,
  "banner": {
    "title": "🏆 TOP LEADERBOARDS",
    "current_season": "July 2026",
    "time_remaining_formatted": "6 Days 14 Hours",
    "time_remaining_ms": 572400000,
    "user_rank": "#5",
    "user_score": 1250.0,
    "coins_needed_for_top_10": 750,
    "prize_pool_coins": 42500,
    "prize_pool_formatted": "42,500 Coins",
    "active_participants": 63,
    "announcement": {
      "title": "🏆 July 2026 Leaderboard is LIVE!",
      "message": "Top 50 users win FREE Coins. Keep earning daily!"
    }
  }
}
```

---

## 2. 💰 Earnings Leaderboard API

Returns the ranked player standings, contest metadata, dynamic prize pool, and reward tiers for the selected earnings period.
*Note: Strictly ranks earnings from **Offerwalls & Surveys**. All non-offerwall sources are **excluded** (Daily Check-in/Streak, Spin Wheel, Lucky Draw/Giveaways, Watch Video Ads, Scratch Cards, Lifafa Rewards, and Referral Commissions).*

- **Endpoint**: `GET /api/leaderboards/earnings`
- **Query Parameters**:
  - `period`: `DAILY` | `WEEKLY` | `MONTHLY` | `ALL_TIME` (Default: `MONTHLY`)
  - `limit`: `10` - `100` (Default: `50`)
- **Headers**: `Authorization: Bearer <user_jwt_token>`

### Response Payload (`200 OK`)
```json
{
  "success": true,
  "period": "DAILY",
  "leaderboard": {
    "id": "lb_daily_earnings_001",
    "name": "Daily Earnings Leaderboard",
    "type": "EARNINGS",
    "period": "DAILY",
    "base_reward_pool": 5000.0,
    "prize_pool_coins": 5000,
    "max_winners": 20,
    "minimum_score": 0.0,
    "start_date": null,
    "end_date": null
  },
  "reward_tiers": [
    { "start_rank": 1, "end_rank": 1, "reward_coins": 1500.0, "display_label": "Rank 1" },
    { "start_rank": 2, "end_rank": 2, "reward_coins": 1000.0, "display_label": "Rank 2" },
    { "start_rank": 3, "end_rank": 3, "reward_coins": 500.0, "display_label": "Rank 3" },
    { "start_rank": 4, "end_rank": 10, "reward_coins": 200.0, "display_label": "Rank 4-10" },
    { "start_rank": 11, "end_rank": 20, "reward_coins": 60.0, "display_label": "Rank 11-20" }
  ],
  "rankings": [
    {
      "rank": 1,
      "user_id": "usr_94a821",
      "name": "Satya Kumar",
      "profile_pic": "https://ui-avatars.com/api/?name=Satya+Kumar",
      "score": 4500.0,
      "offers_completed": 8
    },
    {
      "rank": 2,
      "user_id": "usr_882910",
      "name": "Vikram Singh",
      "profile_pic": "https://ui-avatars.com/api/?name=Vikram+Singh",
      "score": 3800.0,
      "offers_completed": 6
    }
  ],
  "my_rank": {
    "rank": 5,
    "score": 1250.0
  }
}
```

---

## 3. 👥 Referral Leaderboard API

Returns the ranked referral leaderboards showing total invite counts for the specified time period.

- **Endpoint**: `GET /api/leaderboards/referral`
- **Query Parameters**:
  - `period`: `DAILY` | `WEEKLY` | `MONTHLY` | `ALL_TIME` (Default: `MONTHLY`)
  - `limit`: `10` - `100` (Default: `50`)
- **Headers**: `Authorization: Bearer <user_jwt_token>`

### Response Payload (`200 OK`)
```json
{
  "success": true,
  "period": "MONTHLY",
  "leaderboard": {
    "id": "lb_monthly_ref_002",
    "name": "Monthly Referral Leaderboard",
    "type": "REFERRAL",
    "period": "MONTHLY",
    "base_reward_pool": 25000.0,
    "prize_pool_coins": 25000,
    "max_winners": 25,
    "minimum_referrals": 0,
    "start_date": null,
    "end_date": null
  },
  "reward_tiers": [
    { "start_rank": 1, "end_rank": 1, "reward_coins": 7500.0, "display_label": "Rank 1" },
    { "start_rank": 2, "end_rank": 2, "reward_coins": 5000.0, "display_label": "Rank 2" },
    { "start_rank": 3, "end_rank": 3, "reward_coins": 2500.0, "display_label": "Rank 3" },
    { "start_rank": 4, "end_rank": 10, "reward_coins": 1000.0, "display_label": "Rank 4-10" },
    { "start_rank": 11, "end_rank": 25, "reward_coins": 200.0, "display_label": "Rank 11-25" }
  ],
  "rankings": [
    {
      "rank": 1,
      "user_id": "usr_123456",
      "name": "Alex Dev",
      "profile_pic": "https://ui-avatars.com/api/?name=Alex+Dev",
      "referrals": 42,
      "referral_earnings": 8400.0
    }
  ]
}
```

---

## 4. 👤 Authenticated User Leaderboard Profile API

Returns individual user performance stats across daily, weekly, and monthly periods.

- **Endpoint**: `GET /api/leaderboards/profile`
- **Headers**: `Authorization: Bearer <user_jwt_token>`

### Response Payload (`200 OK`)
```json
{
  "success": true,
  "profile": {
    "uid": "usr_94a821",
    "name": "Satya Kumar",
    "email": "user@example.com",
    "profile_pic": "https://ui-avatars.com/api/?name=Satya+Kumar",
    "current_coins": 12500.0,
    "lifetime_coins": 85000.0,
    "earnings": {
      "daily": 450.0,
      "weekly": 2800.0,
      "monthly": 12500.0
    },
    "referral_count": 14,
    "offers_completed": 29
  }
}
```

---

## 5. 📜 Past Winner History API

Returns past leaderboard contest winners and prize distribution ledger.

- **Endpoint**: `GET /api/leaderboards/history`
- **Headers**: `Authorization: Bearer <user_jwt_token>`

### Response Payload (`200 OK`)
```json
{
  "success": true,
  "history": [
    {
      "id": "rew_102030",
      "rank": 1,
      "reward_coins": 12500.0,
      "status": "DISTRIBUTED",
      "rewarded_at": "2026-06-30T23:59:59.000Z",
      "winner_name": "Rohan Sharma",
      "profile_pic": "https://ui-avatars.com/api/?name=Rohan+Sharma",
      "leaderboard_name": "Monthly Earnings Leaderboard",
      "period": "MONTHLY",
      "type": "EARNINGS"
    }
  ]
}
```

---

## 6. 🔔 Firebase Push Notification (FCM) Payload Format

When the Admin approves leaderboard winners, the backend sends a high-priority FCM notification to the winner's device.

### FCM Data & Notification Payload
```json
{
  "notification": {
    "title": "🏆 Leaderboard Reward Winner!",
    "body": "Congratulations Satya! You secured Rank #1 in Daily Earnings Leaderboard and won 1,500 Coins!"
  },
  "data": {
    "type": "LEADERBOARD_REWARD",
    "rank": "1",
    "reward_coins": "1500",
    "leaderboard_id": "lb_daily_earnings_001",
    "click_action": "OPEN_LEADERBOARD_SCREEN"
  }
}
```

---

## 7. 🤖 Kotlin / Android Retrofit Service Interface Snippet

```kotlin
interface LeaderboardApiService {
    @GET("api/leaderboards/home-banner")
    suspend fun getHomeBanner(): Response<HomeBannerResponse>

    @GET("api/leaderboards/earnings")
    suspend fun getEarningsLeaderboard(
        @Query("period") period: String = "DAILY",
        @Query("limit") limit: Int = 50
    ): Response<LeaderboardResponse>

    @GET("api/leaderboards/referral")
    suspend fun getReferralLeaderboard(
        @Query("period") period: String = "MONTHLY",
        @Query("limit") limit: Int = 50
    ): Response<ReferralLeaderboardResponse>

    @GET("api/leaderboards/profile")
    suspend fun getUserProfile(): Response<UserProfileLeaderboardResponse>
}
```
