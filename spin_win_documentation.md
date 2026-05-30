# 🎡 Rewardverse — Lucky Spin & Win Integration Documentation

> **Base URL:** `https://api-rewardverse.satyainfotechnetworks.com`
>
> All client endpoints described in this document require the user authentication header:  
> `Authorization: Bearer <JWT_TOKEN>`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Schema](#2-database-schema)
3. [Configuration Schema (Weighted Probabilities)](#3-configuration-schema-weighted-probabilities)
4. [REST API Reference](#4-rest-api-reference)
   - [4.1 Get Spin Status](#41-get-spin-status)
   - [4.2 Perform Spin](#42-perform-spin)
5. [Anti-Fraud & Server-Side Security](#5-anti-fraud--server-side-security)

---

## 1. Overview

**Lucky Spin & Win** is a gamified daily engagement feature in the Rewardverse Android application. Users can spin a wheel daily to win coin rewards. 

To prevent hacking and cheating, **all reward generation and limit validation are processed entirely server-side** using a weighted random probability algorithm. The client (Android app) simply triggers the spin and plays the animation matching the reward returned by the server.

---

## 2. Database Schema

### 2.1 The `lucky_spins` Table
Maintains daily limits and usage records per user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `INT AUTO_INCREMENT` | Primary index |
| `user_id` | `CHAR(36)` | Unique FK reference matching `users.id` |
| `spins_left` | `INT` | Remaining spins today (resets on daily calendar date change) |
| `last_spin_date` | `DATE` | Calendar date of the last spin (used for resetting the limit) |
| `total_spins` | `INT` | Lifetime total spins performed by this user |

> **Note:** The `users` table also stores `daily_spins_count` and `last_spin_date` for convenience and fast dashboard display syncing.

---

## 3. Configuration Schema (Weighted Probabilities)

Lucky Spin's daily limit and reward chances are completely configurable inside the database under the `app_configs` table.

### 3.1 `spin_daily_limit`
* **Config Key**: `spin_daily_limit`
* **Default Value**: `2`
* **Purpose**: Defines how many times a user can spin the wheel per day.

### 3.2 `spin_probabilities`
* **Config Key**: `spin_probabilities`
* **Default Value (JSON Array)**:
```json
[
  {
    "type": "NONE",
    "prob": 20,
    "range": [0, 0]
  },
  {
    "type": "SMALL",
    "prob": 40,
    "range": [1, 5]
  },
  {
    "type": "MEDIUM",
    "prob": 25,
    "range": [6, 15]
  },
  {
    "type": "HIGH",
    "prob": 12,
    "range": [16, 50]
  },
  {
    "type": "JACKPOT",
    "prob": 3,
    "range": [100, 250]
  }
]
```

#### Field Meanings:
* **`type`**: String label defining the category.
* **`prob`**: The percentage probability weight (must sum up to `100` total across all objects).
* **`range`**: `[min, max]` inclusive boundary of coins. Once a category is chosen, the server picks a random integer within this range to award the user.

---

## 4. REST API Reference

### 4.1 Get Spin Status

Fetches the user's remaining spins today, lifetime spin counts, and the current dynamic probability config.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/user/spin` (supports legacy `GET /api/user/spin.php`) |
| **Auth** | `Authorization: Bearer <JWT_TOKEN>` ✅ |

#### Example Request
```
GET /api/user/spin
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "spins_left": 2,
    "daily_limit": 2,
    "total_spins": 14,
    "probabilities_config": [
      {
        "type": "NONE",
        "prob": 20,
        "range": [0, 0]
      },
      {
        "type": "SMALL",
        "prob": 40,
        "range": [1, 5]
      },
      {
        "type": "MEDIUM",
        "prob": 25,
        "range": [6, 15]
      },
      {
        "type": "HIGH",
        "prob": 12,
        "range": [16, 50]
      },
      {
        "type": "JACKPOT",
        "prob": 3,
        "range": [100, 250]
      }
    ]
  }
}
```

* **Dynamic Daily Reset**: If the server detects `last_spin_date` is not `today`, it automatically resets `spins_left` to the default dynamic `daily_limit` inside the response and database.

---

### 4.2 Perform Spin

Performs a secure, server-side spin. Calculates the reward based on dynamic weights, updates the ledger, credits user balances, and returns the result.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/user/spin` (supports legacy `POST /api/user/spin.php`) |
| **Auth** | `Authorization: Bearer <JWT_TOKEN>` ✅ |
| **Content-Type** | `application/json` |

#### Request Body
None required.

#### Success Response (200 — Won Coins)
```json
{
  "success": true,
  "amount": 25,
  "type": "HIGH",
  "spins_left": 1,
  "message": "You won 25 coins!"
}
```

#### Success Response (200 — Won Nothing)
```json
{
  "success": true,
  "amount": 0,
  "type": "NONE",
  "spins_left": 0,
  "message": "Better luck next time!"
}
```

#### Error Response (200 — Limit Exceeded)
```json
{
  "success": false,
  "message": "No spins left for today! Try again tomorrow."
}
```

---

## 5. Anti-Fraud & Server-Side Security

To guarantee absolute integrity, the spin feature implements these key security controls:

1. 🔒 **Server-Side Generation**: The client **cannot** specify or pass the amount won in the request. The server generates a random number between `1` and `100` and maps it across cumulative category weights inside an isolated transaction.
2. 🔒 **Double-Spin Protection**: Wallet balance updates, streak claim updates, and spin reductions are wrapped inside an atomic **database transaction** (`connection.beginTransaction()`). This prevents concurrency hacks (such as sending multiple spin requests simultaneously to bypass daily limits).
3. 🔒 **Deterministic Logging**: Every coin win is immediately posted to the transaction ledger table with the source key `LUCKY_SPIN`. Any manual review or balance check can easily trace coin sources.
