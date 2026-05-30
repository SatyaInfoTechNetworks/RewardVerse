# 📅 Rewardverse — Visit & Earn & Daily Streak Integration Documentation

> **Base URL:** `https://api-rewardverse.satyainfotechnetworks.com`
>
> All client endpoints described in this document require the user authentication header:  
> `Authorization: Bearer <JWT_TOKEN>`

---

## Table of Contents

1. [Visit & Earn (Website Tasks)](#1-visit--earn-website-tasks)
   - [1.1 Database Schema](#11-database-schema)
   - [1.2 Client API: Get Active Tasks](#12-client-api-get-active-tasks)
   - [1.3 Client API: Claim Reward](#13-client-api-claim-reward)
   - [1.4 Admin APIs (CRUD)](#14-admin-apis-crud)
2. [Daily Streak (Check-In)](#2-daily-streak-check-in)
   - [2.1 Database Schema](#21-database-schema)
   - [2.2 Configuration Schema](#22-configuration-schema)
   - [2.3 Client API: Get Streak Status](#23-client-api-get-streak-status)
   - [2.4 Client API: Claim Daily Reward](#24-client-api-claim-daily-reward)
3. [Common Response Patterns](#3-common-response-patterns)

---

## 1. Visit & Earn (Website Tasks)

**Visit & Earn** allows users to visit promotional websites, wait for a specified timer (in seconds), and earn a coin reward.

### 1.1 Database Schema

#### A. `visit_earn_tasks` Table
Defines active website tasks set up by admins.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `VARCHAR(100)` | Unique task UUID |
| `title` | `VARCHAR(255)` | User-friendly task title (e.g. `Visit Google News`) |
| `coins` | `INT` | Coin reward amount upon completion |
| `visit_url` | `VARCHAR(512)` | The website URL the user must visit |
| `timer_seconds` | `INT` | Countdown time required on page (e.g. `30`) |
| `is_ad` | `TINYINT` | `1` if they must view an ad, `0` otherwise |
| `is_active` | `TINYINT` | `1` if task is live, `0` if paused |
| `created_at` | `DATETIME` | Time of creation |

#### B. `user_visit_progress` Table
Stores today's completed visits to prevent users from completing the same task twice on the same day.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `CHAR(36)` | Unique record ID |
| `user_id` | `CHAR(36)` | FK → `users.id` |
| `task_id` | `VARCHAR(100)` | FK → `visit_earn_tasks.id` |
| `completed_at` | `DATETIME` | Time of reward claiming |

---

### 1.2 Client API: Get Active Tasks

Retrieves tasks that are active and **have not** been completed by the current user today.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/visit-earn` |
| **Auth** | `Authorization: Bearer <JWT_TOKEN>` ✅ |

#### Success Response (200)

```json
{
  "success": true,
  "tasks": [
    {
      "id": "task-uuid-1",
      "title": "Visit Google News",
      "coins": 5,
      "visit_url": "https://news.google.com",
      "timer_seconds": 30,
      "is_ad": 0
    }
  ]
}
```

---

### 1.3 Client API: Claim Reward

Called by the app after the user visits the page and the countdown timer successfully reaches 0.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/visit-earn/claim` |
| **Auth** | `Authorization: Bearer <JWT_TOKEN>` ✅ |
| **Content-Type** | `application/json` |

#### Request Body

```json
{
  "task_id": "task-uuid-1"
}
```

#### Success Response (200)

```json
{
  "success": true,
  "message": "Reward claimed successfully! Added 5 coins to your wallet.",
  "reward": 5,
  "new_balance": 155.00
}
```

#### Error Responses

| HTTP | Message | Reason |
|------|---------|--------|
| `400` | `Task ID is required` | Body missing parameter |
| `404` | `Task not found or inactive.` | Invalid or paused task ID |
| `400` | `You have already completed this visit task today.` | Anti-fraud double claim check failed |

---

### 1.4 Admin APIs (CRUD)

Used by the Admin Dashboard to manage website campaigns. All routes require admin session tokens.

#### A. List All Tasks (Admin View)
* **Route**: `GET /api/admin/visit-earn`
* **Success Response**: `{"success": true, "tasks": [...]}`

#### B. Create New Task
* **Route**: `POST /api/admin/visit-earn`
* **Request Body**:
  ```json
  {
    "title": "Read Tech Blog",
    "coins": 10,
    "visit_url": "https://techcrunch.com",
    "timer_seconds": 45,
    "is_ad": false,
    "is_active": true
  }
  ```

#### C. Update Existing Task
* **Route**: `PUT /api/admin/visit-earn/:id`
* **Request Body**: Same structure as Create

#### D. Delete Task
* **Route**: `DELETE /api/admin/visit-earn/:id`

---

## 2. Daily Streak (Check-In)

The **Daily Streak** awards players increasing daily rewards for claiming their check-in bonus every consecutive day. If a user misses a calendar day, their streak resets back to day 1.

### 2.1 Database Schema

#### A. `streaks` Table
Keeps track of consecutive login sessions per user.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | `CHAR(36)` | Unique PK reference to `users.id` |
| `current_streak` | `INT` | Consecutive check-in count (resets to 1, maxes out at 7) |
| `last_claim_date` | `DATE` | Calendar date of the last claim (consecutive check is `today` vs `yesterday`) |
| `total_claims` | `INT` | Lifetime total streak claims count |

> **Note:** The `users` table also synchronizes `current_streak` and `last_streak_claim_date` directly on the profile row for fast dashboard rendering.

---

### 2.2 Configuration Schema

Streak reward amounts are fully dynamic and configurable in the database under the `app_configs` table (`config_key = 'streak_rewards'`).

#### Default JSON Configuration
```json
{
  "1": 30,
  "2": 40,
  "3": 50,
  "4": 60,
  "5": 70,
  "6": 80,
  "7": 200
}
```
* On Day 1, the user claims `30` coins.
* On Day 7 (Max Streak), they claim `200` coins.
* After Day 7, the streak cycles back around to Day 1.

---

### 2.3 Client API: Get Streak Status

Fetches the user's current consecutive streak, last claim date, whether they can claim today, and the full rewards matrix config.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/user/streak` |
| **Auth** | `Authorization: Bearer <JWT_TOKEN>` ✅ |

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "current_streak": 3,
    "last_claim_date": "2026-05-29",
    "can_claim": true,
    "next_reward": 60,
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

* **Streak Breaking Logic**: If `last_claim_date` is not `today` and is not `yesterday`, the server automatically considers the streak broken and returns `"current_streak": 0` and `"next_reward": 30` (Day 1 reward).

---

### 2.4 Client API: Claim Daily Reward

Claims the daily check-in reward, increments consecutive streak counters, updates wallets, and posts a credit ledger entry.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/user/daily-checkin` |
| **Auth** | `Authorization: Bearer <JWT_TOKEN>` ✅ |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Streak claimed!",
  "claimed_amount": 60.00,
  "new_streak": 4
}
```

#### Already Claimed Today Response (200)

```json
{
  "success": false,
  "message": "Already claimed today."
}
```

#### What Happens on Successful Daily Claim

1. ✅ **Consecutive validation**: Checks if the last claim was yesterday.
   - If yes: increment streak `(currentStreak % 7) + 1`.
   - If no (broken streak): resets streak to `1`.
2. ✅ **Balance update**: Adds `reward_amount` to user balance.
3. ✅ **Transaction Ledger**: Logs a transaction with `source = 'STREAK_REWARD'` (Day X Streak Reward).
4. ✅ **Streaks Table update**: Saves the current streak counter, increments `total_claims`, and updates `last_claim_date` to `today`'s calendar date.

---

## 3. Common Response Patterns

All APIs return consistent JSON envelopes. Standard error mappings:

| HTTP Code | Explanation |
|-----------|-------------|
| `400 Bad Request` | Missing required parameters, already claimed today, or bad schema |
| `401 Unauthorized` | Invalid, missing, or expired JWT bearer token |
| `404 Not Found` | The requested task ID does not exist |
| `500 Server Error` | Unexpected SQL database or server exception |
