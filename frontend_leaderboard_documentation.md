# 🏆 RewardVerse Leaderboard Module - Frontend & Mobile Documentation

Welcome to the comprehensive documentation for the **RewardVerse Leaderboard & Contest Module** (Frontend Web Admin + Android / Flutter Mobile App Integration).

---

## 📌 1. Module Overview

The Leaderboard Module provides real-time ranking, dynamic prize pools, configurable reward tiers, anti-cheat detection, automated coin distribution, and FCM push notifications.

### Key Capabilities:
- 💰 **Dual Leaderboard Engines**: Separate **Earnings Leaderboards** (Coins earned from tasks, offerwalls, videos, spin wheel) and **Referral Leaderboards** (Number of successful user referrals).
- 📅 **Flexible Periods**: Daily, Weekly, Monthly, All-Time, and Custom Date-Range Contests.
- ⚡ **Dynamic Growing Prize Pools**: Base prize pool scales automatically as user participation increases (+X coins per user, up to a configurable cap).
- 🏆 **Independent Tier Builders**: Each contest/leaderboard manages its own custom rank ranges and prize coin distribution (e.g., Rank 1: 5,000 Coins, Rank 2: 3,000 Coins, Rank 4–10: 750 Coins each).
- 🛡️ **Anti-Cheat System**: Real-time risk flagging for duplicate device IDs (`android_id`), emulators, rapid offer spam, and VPN/proxy connections.
- 🔔 **FCM Push Winner Notifications**: Instant push notifications sent to winner devices when rewards are approved.
- 📊 **100% Real-Time Data**: All UI widgets and KPI cards reflect live database records from MySQL without hardcoded mock data.

---

## 🖥️ 2. Web Admin Portal (`AdminLeaderboard.jsx`)

**File Path**: `Frontend/src/components/admin/AdminLeaderboard.jsx`

The Web Admin component contains 9 interactive subtab controls:

```
Leaderboard Master Control
├── 📊 Dashboard Overview
├── ⚙️ Leaderboard Settings
├── 🏆 Reward Tier Builder
├── 👥 Participants & Players
├── 🛡️ Anti-Cheat Panel
├── 💰 Coin Statistics
├── 🎁 Reward Distribution
├── 📢 Announcement & FCM Push
└── 📜 Audit Logs
```

---

### Subtab 1: 📊 Dashboard Overview
Displays platform-wide leaderboard statistics and active contest summaries:
- **Active Leaderboards**: Total active contests running in MySQL.
- **Participants**: Real-time count of registered users participating.
- **Live Dynamic Prize Pool**: Total aggregated coin prize pool across all active contests.
- **Rewards Pending**: Number of top qualified earners eligible for prize distribution.
- **Rewards Distributed**: Total number of winner payouts issued to date.
- **Total Reward Coins Given**: Sum of all coins distributed to winners.
- **Live Sync Button**: `[ 🔄 Live Realtime Sync ]` triggers instant database re-fetch (auto-polls every 15s).

---

### Subtab 2: ⚙️ Leaderboard Settings
Configure parameters for existing contests or click `[ + Create New Leaderboard ]`:
- **Select Leaderboard to Edit**: Dropdown selector to switch between active contests.
- **Leaderboard Name**: e.g., `Daily Earnings Leaderboard`.
- **Leaderboard Type**: `Earnings Leaderboard` vs `Referral Leaderboard`.
- **Period**: `Daily`, `Weekly`, `Monthly`, `All Time`.
- **Minimum Coins Required**: Minimum score needed to qualify for prize pool.
- **Minimum Referrals**: Required for referral leaderboards.
- **Base Reward Pool**: Starting coin pool (e.g., 5,000 Coins).
- **Maximum Winners**: Number of top ranks awarded (e.g., Top 20, Top 50, Top 100).
- **Contest Start & End Schedule**:
  - **Start Date & Time**: `datetime-local` picker (e.g., `2026-07-01 00:00:00`).
  - **End Date & Time**: `datetime-local` picker (e.g., `2026-07-31 23:59:59`).
- **Dynamic Prize Pool Scaling**: Toggle ON to grow pool (+10 coins per user up to 100,000 max cap).
- **Show Banner on Home Screen**: Toggle whether home screen displays contest banner.
- **Auto Reward Distribution**: Toggle ON for automatic payouts when `end_date` is reached.

---

### Subtab 3: 🏆 Reward Tier Builder
Define custom rank ranges and reward amounts for **each separate contest**:
- **Target Leaderboard Contest Bar**: Select which contest's reward tiers you are modifying.
- **Add Rank Tier**: Click `[ + Add Rank Tier ]` to append a rank row.
- **Fields**:
  - **Start Rank**: e.g., `1`, `2`, `4`, `11`.
  - **End Rank**: e.g., `1`, `2`, `10`, `25`.
  - **Reward (Coins)**: Amount credited to each rank in that range.
  - **Display Label**: Auto-formatted label (e.g., `Rank 1`, `Rank 4-10`).
  - **Remove Tier**: Delete tier row button.

---

### Subtab 4: 👥 Participants & Players
Live player management & moderation table:
- **Participant KPI Summary**: Qualified Users, Not-Qualified (Banned), Average Coins, Highest Score.
- **Live Search**: Search players by Name, Email, Public UID, or Phone Number.
- **Player Table Columns**: Rank, User Avatar & Name, Coins Earned, Offers Completed, Referrals Count, Anti-Cheat Flag Risk (High/Medium/Low), Status (Qualified / Disqualified).
- **Adjust Player Modal**:
  - **Increase Score / Balance**: Manual bonus addition.
  - **Decrease Score / Balance**: Deduct coins.
  - **Disqualify Player**: Mark player disqualified with audit reason.
  - **Restore Player**: Re-qualify disqualified player.

---

### Subtab 5: 🛡️ Anti-Cheat Panel
Automated risk analysis cards:
- **Duplicate Devices**: Flagged users sharing the same `android_id`.
- **Emulator Detections**: Android emulators detected via device fingerprinting.
- **Rapid Offer Spam**: Accounts completing abnormal number of offers in short timeframes.
- **VPN / Proxy Flags**: Suspicious IP address changes.

---

### Subtab 6: 💰 Coin Statistics
Real-time financial flow charts:
- **Coins Earned Today**: Total user credit transactions today.
- **Coins Distributed Lifetime**: Lifetime credit transaction sum.
- **Breakdown by Source**: Offerwalls, Referrals, Leaderboards, Spin & Streak.
- **Current Coin Supply**: Sum of all active user balances in MySQL.

---

### Subtab 7: 🎁 Reward Distribution Manager
Manual winner payout workflow:
- Click `[ Approve & Distribute Winner Rewards ]`.
- Backend actions performed:
  1. Updates winner wallet balances in MySQL (`balance = balance + reward_coins`).
  2. Inserts credit entries into `transactions` table.
  3. Records winners in `leaderboard_rewards` history.
  4. Dispatches FCM Push Notifications directly to each winner's Android/iOS device.

---

### Subtab 8: 📢 Announcement Panel & FCM Push Dispatcher
- **Home Screen Announcement Banner**: Update title & message shown on user app home screen.
- **Dispatch FCM Push Notifications**:
  - **Target Options**: `Global Broadcast` (All users) or `Specific Winner User ID`.
  - **Push Title**: e.g., `🎉 Leaderboard Winner Alert!`.
  - **Push Body**: e.g., `You placed in Top Ranks and won Coins!`.

---

### Subtab 9: 📜 Audit Logs
Timestamped table tracking all administrative actions (Score Adjustments, Leaderboard Config Changes, Reward Distributions, Disqualifications).

---

## 📱 3. Android / Flutter Mobile App Integration

### API Base URL
`https://rewardverse.satyainfotechnetworks.com/api`

---

### Endpoints Specification

#### 1. Home Leaderboard Banner
- **Endpoint**: `GET /api/leaderboards/home-banner`
- **Headers**: `Authorization: Bearer <user_token>`
- **Response**:
```json
{
  "success": true,
  "banner": {
    "title": "🏆 TOP LEADERBOARDS",
    "season": "July 2026",
    "user_rank": 18,
    "user_score": 1420.00,
    "next_rank_needed": 850.00,
    "prize_pool_coins": 25000,
    "time_remaining_seconds": 1555200,
    "earnings_leaderboard_id": "uuid-earnings",
    "referral_leaderboard_id": "uuid-referrals"
  }
}
```

#### 2. Earnings Leaderboard
- **Endpoint**: `GET /api/leaderboards/earnings?period=DAILY|WEEKLY|MONTHLY|ALL_TIME&limit=50`
- **Headers**: `Authorization: Bearer <user_token>`
- **Response**:
```json
{
  "success": true,
  "leaderboard": {
    "id": "uuid-1",
    "name": "Daily Earnings Leaderboard",
    "period": "DAILY",
    "prize_pool_coins": 5000,
    "max_winners": 20
  },
  "user_position": {
    "rank": 5,
    "score": 1250.00,
    "qualified": true
  },
  "top_players": [
    {
      "rank": 1,
      "user_id": "user-uuid-1",
      "name": "Satya Dev",
      "profile_pic": "https://ui-avatars.com/api/?name=Satya+Dev",
      "score": 4500.00,
      "qualified": true
    }
  ],
  "reward_tiers": [
    { "start_rank": 1, "end_rank": 1, "reward_coins": 1500 },
    { "start_rank": 2, "end_rank: 2, "reward_coins": 1000 },
    { "start_rank": 3, "end_rank": 3, "reward_coins": 500 },
    { "start_rank": 4, "end_rank": 10, "reward_coins": 200 }
  ]
}
```

#### 3. Referral Leaderboard
- **Endpoint**: `GET /api/leaderboards/referral?period=DAILY|WEEKLY|MONTHLY|ALL_TIME&limit=50`
- **Headers**: `Authorization: Bearer <user_token>`
- **Response**: Same format as Earnings Leaderboard, ranked by `referrals_count`.

#### 4. User Leaderboard Profile
- **Endpoint**: `GET /api/leaderboards/profile`
- **Headers**: `Authorization: Bearer <user_token>`
- **Response**:
```json
{
  "success": true,
  "profile": {
    "user_id": "user-uuid-1",
    "name": "Satya Dev",
    "monthly_rank": 18,
    "monthly_score": 1420.00,
    "all_time_rank": 42,
    "total_rewards_won_coins": 8500.00,
    "contests_won_count": 3,
    "stats": {
      "earnings": 4500.00,
      "referral_count": 12,
      "offers_completed": 28
    }
  }
}
```

#### 5. Past Winners History
- **Endpoint**: `GET /api/leaderboards/history`
- **Headers**: `Authorization: Bearer <user_token>`
- **Response**: Returns past winner payouts with rank, coins, winner name, and date.

---

## 🔔 4. FCM Push Notifications Setup in Android App

When a winner receives a leaderboard prize, Firebase Cloud Messaging (FCM) sends a payload to the device:

### FCM Payload Schema:
```json
{
  "notification": {
    "title": "🎉 Congratulations! You won 1,500 Coins!",
    "body": "You placed Rank #1 in the Daily Earnings Leaderboard Contest. 1,500 Coins have been credited to your wallet balance!"
  },
  "data": {
    "click_action": "FLUTTER_NOTIFICATION_CLICK",
    "type": "LEADERBOARD_REWARD",
    "leaderboard_id": "uuid-1",
    "coins": "1500",
    "rank": "1"
  },
  "android": {
    "priority": "high",
    "notification": {
      "channelId": "default_channel",
      "sound": "default"
    }
  }
}
```

### Kotlin / Flutter Receiver Code snippet:
```kotlin
override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val type = remoteMessage.data["type"]
    if (type == "LEADERBOARD_REWARD") {
        val coins = remoteMessage.data["coins"]
        val rank = remoteMessage.data["rank"]
        showWinnerDialog(coins, rank)
        // Refresh User Wallet Balance
        RewardViewModel.refreshUserData()
    }
}
```

---

## 🚀 5. Summary & Code Verification

All endpoints, database schemas, Web Admin components, and FCM push modules have been tested, built, and pushed to the GitHub repository:
- **Repository**: `SatyaInfoTechNetworks/RewardVerse`
- **Branch**: `main`
- **Status**: ✅ Production Ready
