# 🏆 RewardVerse Leaderboard & Contest Module - Full Documentation

> **Version**: 2.5.0  
> **Repository**: `SatyaInfoTechNetworks/RewardVerse`  
> **Target Platforms**: Web Admin Panel (React / AdminLTE) & Mobile Client (Android Kotlin / Flutter)

---

## 1. 🏗️ Module Architecture Overview

The **RewardVerse Leaderboard Module** is an enterprise-grade gamification engine that rewards top-performing users with bonus coins based on real activity.

```
+-----------------------------------------------------------------------------------+
|                                  WEB ADMIN PANEL                                  |
|                            (AdminLeaderboard.jsx)                                 |
|  - Contests Overview Grid      - Custom Contest Builder  - Anti-Cheat Monitoring  |
|  - Realtime KPI Ticker         - Reward Tier Configurator - FCM Push Dispatcher   |
+------------------------------------------+----------------------------------------+
                                           | REST APIs / JWT Auth
                                           v
+-----------------------------------------------------------------------------------+
|                                  EXPRESS BACKEND                                  |
|                           (leaderboardController.js)                              |
|  - Excludes Non-Offerwall Sources  - Calculates Dynamic Scaling Prize Pools     |
|  - Strict Period Date Queries      - Payout Execution & Ledger Recording          |
+------------------------------------------+----------------------------------------+
                                           | MySQL 8.0 Pool Query
                                           v
+-----------------------------------------------------------------------------------+
|                                 MYSQL 8.0 DATABASE                                |
|  - leaderboards                  - leaderboard_reward_tiers                       |
|  - leaderboard_entries           - leaderboard_rewards                            |
|  - leaderboard_logs              - leaderboard_announcements                      |
+-----------------------------------------------------------------------------------+
```

---

## 2. 🗄️ Database Schemas (MySQL 8.0)

### 2.1 `leaderboards` Table
Stores configured contests and dynamic scaling rules.
```sql
CREATE TABLE IF NOT EXISTS leaderboards (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('EARNINGS', 'REFERRAL') NOT NULL DEFAULT 'EARNINGS',
  period ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME') NOT NULL DEFAULT 'MONTHLY',
  minimum_score DECIMAL(15,2) DEFAULT 0.00,
  minimum_referrals INT DEFAULT 0,
  reward_pool DECIMAL(15,2) NOT NULL DEFAULT 5000.00,
  dynamic_pool_enabled BOOLEAN DEFAULT TRUE,
  pool_growth_per_user DECIMAL(15,2) DEFAULT 5.00,
  max_pool_cap DECIMAL(15,2) DEFAULT 50000.00,
  max_winners INT DEFAULT 20,
  start_date DATETIME NULL,
  end_date DATETIME NULL,
  auto_reward BOOLEAN DEFAULT FALSE,
  show_on_home BOOLEAN DEFAULT TRUE,
  status ENUM('ACTIVE', 'PAUSED', 'ENDED') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2.2 `leaderboard_reward_tiers` Table
Stores custom prize distribution ranges for each position/rank bracket.
```sql
CREATE TABLE IF NOT EXISTS leaderboard_reward_tiers (
  id CHAR(36) PRIMARY KEY,
  leaderboard_id CHAR(36) NOT NULL,
  start_rank INT NOT NULL,
  end_rank INT NOT NULL,
  reward_coins DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (leaderboard_id) REFERENCES leaderboards(id) ON DELETE CASCADE
);
```

### 2.3 `leaderboard_rewards` Table
Ledger recording all winner payouts, transaction IDs, and FCM push notification statuses.
```sql
CREATE TABLE IF NOT EXISTS leaderboard_rewards (
  id CHAR(36) PRIMARY KEY,
  leaderboard_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  `rank` INT NOT NULL,
  reward_coins DECIMAL(15,2) NOT NULL,
  status ENUM('PENDING', 'DISTRIBUTED', 'FAILED') DEFAULT 'DISTRIBUTED',
  rewarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 3. ⚖️ Core Business Logic & Qualification Rules

### 3.1 🚫 Strict Source Filtering Rules for Earnings Leaderboard
Earnings Leaderboards rank users strictly based on genuine task completion. All passive or free coin sources are **excluded**.

- **INCLUDED SOURCES (Counted towards Earnings Score)**:
  - `OFFER` / `OFFLINE_OFFER`
  - `PUBSCALE`
  - `OFFERMARU`
  - `OPINION_UNIVERSE`
  - `CPX_RESEARCH`
  - `GROWDECK`
  - `ADJUMP`
  - `REAL_OPINION`
  - `PLAYTIME`
  - `POCKETSFULL`
  - Any verified offerwall or survey SDK credit.

- **EXCLUDED SOURCES (Ignored from Earnings Score)**:
  - 📅 Daily Check-in / Daily Streak (`DAILY_CHECKIN`, `STREAK_REWARD`)
  - 🎡 Spin Wheel (`SPIN_WHEEL`, `LUCKY_SPIN`)
  - 🎟️ Lucky Draw & Giveaways (`LUCKY_DRAW`, `GIVEAWAY`, `CONTEST`)
  - 🧧 Lifafa Redemptions (`LIFAFA`, `LIFAFA_BONUS`)
  - 👥 Referral Commissions (`REFERRAL`, `REFERRAL_BONUS`, `COMMISSION`)
  - 📺 Watch Video Ads (`WATCH_VIDEO`, `VIDEO_ADS`)
  - 🎟️ Scratch Cards (`SCRATCH_CARD`)
  - 🎁 Welcome Bonus (`WELCOME_BONUS`)
  - 🔗 Visit & Earn (`VISIT_EARN`)
  - ⚙️ Manual Admin Credits (`ADMIN_CREDIT`, `MANUAL`)

### 3.2 ⏱️ Period Reset Logic
- **`DAILY`**: Sums transactions where `DATE(created_at) = CURRENT_DATE()`. Resets at 00:00:00 midnight every day.
- **`WEEKLY`**: Sums transactions where `YEARWEEK(created_at, 1) = YEARWEEK(CURRENT_DATE(), 1)`.
- **`MONTHLY`**: Sums transactions where `MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`.
- **`ALL_TIME`**: Sums all lifetime non-referral credits.

### 3.3 📈 Dynamic Prize Pool Growth Formula
If dynamic scaling is enabled, the total pool grows automatically with platform registrations:
$$\text{Calculated Pool} = \min\Big(\text{Base Pool} + (\text{Total Users} \times \text{Growth Per User}), \text{Max Pool Cap}\Big)$$

---

## 4. 🖥️ Admin Panel Overview (`AdminLeaderboard.jsx`)

The Admin Panel features an **Executive 5-Tab Dashboard**:

1. **📊 Contests Overview**: Realtime KPI cards + Contests table with `[ ⚙️ Settings ]`, `[ 🎁 Pay ]`, and `[ 🗑️ Delete ]` actions.
2. **🏆 Contest & Tier Builder**: Target contest picker + parameters form + interactive rank tier builder with live subtotal calculator.
3. **👥 Players & Moderation**: Live search, standings, risk level badges (`Low`, `Medium`, `High`), and score adjustment modal.
4. **🛡️ Anti-Cheat Panel**: Security summary for duplicate device IDs, emulators, rapid offer spam, and VPN detection.
5. **💰 Payouts, FCM & Audit**: Manual winner payout trigger, FCM winner push notification dispatcher, banner editor, and audit logs.

---

## 5. 📱 Mobile App (Android / Flutter) REST API Specs

### 5.1 Leaderboard Home Banner API
Returns header widget details for the app home screen.
- **Endpoint**: `GET /api/leaderboards/home-banner`
- **Auth**: Optional JWT Header (`Authorization: Bearer <token>`)

#### Response Payload
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

### 5.2 Earnings Leaderboard API
Returns ranked player standings, contest metadata, dynamic prize pool, and reward tiers.
- **Endpoint**: `GET /api/leaderboards/earnings?period=DAILY|WEEKLY|MONTHLY|ALL_TIME&limit=50`
- **Auth**: Optional JWT Header

#### Response Payload
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
    }
  ],
  "my_rank": {
    "rank": 5,
    "score": 1250.0
  }
}
```

---

### 5.3 Referral Leaderboard API
Returns top referrers for the selected period.
- **Endpoint**: `GET /api/leaderboards/referral?period=DAILY|WEEKLY|MONTHLY|ALL_TIME&limit=50`

#### Response Payload
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
    "max_winners": 25
  },
  "reward_tiers": [
    { "start_rank": 1, "end_rank": 1, "reward_coins": 7500.0, "display_label": "Rank 1" },
    { "start_rank": 2, "end_rank": 2, "reward_coins": 5000.0, "display_label": "Rank 2" },
    { "start_rank": 3, "end_rank": 3, "reward_coins": 2500.0, "display_label": "Rank 3" }
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

### 5.4 Authenticated User Profile API
- **Endpoint**: `GET /api/leaderboards/profile`
- **Auth**: Required JWT Header

#### Response Payload
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

## 6. 🔔 Firebase Winner FCM Push Notification Spec

```json
{
  "notification": {
    "title": "🏆 Leaderboard Reward Credited!",
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

## 7. 🤖 Kotlin / Android Code Snippet

```kotlin
// Data Models
data class LeaderboardResponse(
    val success: Boolean,
    val period: String,
    val leaderboard: ContestMetadata?,
    val reward_tiers: List<RewardTier>,
    val rankings: List<LeaderboardUser>,
    val my_rank: UserRankInfo?
)

data class ContestMetadata(
    val id: String,
    val name: String,
    val type: String,
    val period: String,
    val prize_pool_coins: Long,
    val max_winners: Int
)

data class RewardTier(
    val start_rank: Int,
    val end_rank: Int,
    val reward_coins: Double,
    val display_label: String
)

data class LeaderboardUser(
    val rank: Int,
    val user_id: String,
    val name: String,
    val profile_pic: String?,
    val score: Double,
    val offers_completed: Int
)

data class UserRankInfo(
    val rank: Any,
    val score: Double
)

// Retrofit API Interface
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
    ): Response<LeaderboardResponse>

    @GET("api/leaderboards/me")
    suspend fun getUserProfile(): Response<UserProfileResponse>
}
```
