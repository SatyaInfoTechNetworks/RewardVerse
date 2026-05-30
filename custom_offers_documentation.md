# 📑 Rewardverse — Custom Offers Integration Documentation

> **Base URL:** `https://api-rewardverse.satyainfotechnetworks.com`
>
> All authenticated offer endpoints require the `Authorization: Bearer <JWT_TOKEN>` header.
> Public listing endpoints do **not** require authentication.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Schema](#2-database-schema)
3. [Offer Types & Flows](#3-offer-types--flows)
4. [REST API Reference](#4-rest-api-reference)
   - [4.1 Get All Active Offers](#41-get-all-active-offers)
   - [4.2 Get Specific Offer Details](#42-get-specific-offer-details-with-user-progress)
   - [4.3 Start Offer](#43-start-offer-initialize-progress)
   - [4.4 Submit Proof (Offline Tasks)](#44-submit-campaign-proof-offline-tasks-only)
   - [4.5 S2S Postback Webhook (Online Tasks)](#45-automated-s2s-completion-webhook-online-tasks-only)
5. [Common Error Responses](#5-common-error-responses)

---

## 1. Overview

**Custom Offers** are Rewardverse's own in-house campaign system (separate from third-party offerwalls like PubScale or CPX Research). They support two distinct completion flows:

| Type | How it Works | Reward Timing |
|------|-------------|---------------|
| `online` | User clicks a tracking URL; ad network fires a postback webhook automatically | Instant (auto-credited on postback) |
| `offline` | User submits screenshots or text proof; admin manually reviews and approves | After admin approval |

Both types share the same campaign management tables and offer listing APIs.

---

## 2. Database Schema

Custom offers use **three core tables** in MySQL.

### 2.1 `offers` Table

Defines the campaign settings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `VARCHAR(100)` | Unique offer UUID |
| `external_id` | `VARCHAR(100)` | Optional third-party partner code (e.g. `c101`) |
| `title` | `VARCHAR(255)` | Offer name shown in the app list |
| `description` | `TEXT` | Full copy explaining steps and goal |
| `category` | `VARCHAR(100)` | Category label — e.g. `Hot Offers`, `Top Offers` |
| `type` | `VARCHAR(50)` | `online` (S2S tracking) or `offline` (manual proof) |
| `input_type` | `VARCHAR(50)` | For offline tasks: `file`, `text`, or `null` |
| `input_instruction` | `TEXT` | JSON array of input field definitions for offline tasks |
| `reward_type` | `VARCHAR(100)` | `Single Reward` or `Multi Reward` (tiered campaigns) |
| `daily_completion_cap` | `INT` | Max completions per day across all users |
| `country_targeting` | `VARCHAR(255)` | Comma-separated country whitelist — e.g. `IN,US` or `*` for all |

### 2.2 `offer_tiers` Table

For multi-tiered campaigns, maps reward payouts to milestone steps.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `INT AUTO_INCREMENT` | Primary index |
| `offer_id` | `CHAR(36)` | FK → `offers.id` |
| `tier_title` | `VARCHAR(255)` | Backend identifier string (e.g. `register`) — used in postback callbacks |
| `app_tier_title` | `VARCHAR(255)` | User-facing display title (e.g. `Download & Register`) |
| `reward` | `DECIMAL(10,2)` | Coins credited when this tier is completed |
| `steps` | `JSON` | Array of step-by-step instructions displayed to the user |

### 2.3 `user_offer_progress` Table

Stores per-user real-time progress, proofs, and audit results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `CHAR(36)` | Primary progress log entry ID |
| `click_id` | `CHAR(36)` | Unique tracking UUID generated when user clicks **Start Offer** |
| `user_id` | `CHAR(36)` | FK → `users.id` |
| `offer_id` | `CHAR(36)` | FK → `offers.id` |
| `status` | `VARCHAR(50)` | `STARTED` or `COMPLETED` |
| `completed_tiers` | `JSON` | List of tier titles the user has completed |
| `user_input` | `JSON` | For offline tasks — submitted file paths or text values |
| `admin_status` | `VARCHAR(50)` | `PENDING`, `APPROVED`, or `REJECTED` |
| `rejection_reason` | `TEXT` | Reason text shown to user when admin rejects their proof |

---

## 3. Offer Types & Flows

### 3.1 Flow A — Online Tasks (Automatic S2S Postback)

Online tasks redirect users to an ad network and receive automatic webhook callbacks when the user completes the offer goal.

```
┌──────────────────┐   POST /api/offers/start   ┌──────────────────────┐
│   Android App    │ ─────────────────────────► │   Express Backend    │
│                  │ ◄───────── { click_id } ─── │  Generates click_id  │
└──────────────────┘                             └──────────────────────┘
         │
         │  Opens tracking URL in browser
         │  (includes click_id in query params)
         ▼
┌──────────────────┐
│   Ad Network     │
│  (User completes │
│   offer goal)    │
└──────────────────┘
         │
         │  Fires S2S callback webhook
         ▼
┌─────────────────────────────────────────────────────────┐
│  GET /api/webhook/postback?click_id=…&tier_title=…      │
│                                                         │
│  Backend validates click_id → credits user balance      │
│  → writes CREDIT transaction → sends FCM push           │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Flow B — Offline Tasks (Manual Proof & Admin Verification)

Offline tasks collect screenshots or text inputs from the user and require an admin to approve them before coins are credited.

```
┌──────────────────┐   POST /api/offers/start   ┌──────────────────────┐
│   Android App    │ ─────────────────────────► │   Express Backend    │
│                  │ ◄───────── { click_id } ─── │  Generates click_id  │
└──────────────────┘                             └──────────────────────┘
         │
         │  User fills in proof fields
         │  (screenshots / text inputs)
         ▼
┌──────────────────────────────────────────────────────────┐
│  POST /api/offers/submit-proof                           │
│  { click_id, input_data: [...] }                         │
│                                                          │
│  Backend saves user_input in DB                          │
│  Sets admin_status = 'PENDING'                           │
│  Sends admin Telegram alert ⏳                           │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│  Admin Dashboard — Reviews submitted evidence            │
│                                                          │
│  ✅ APPROVED → backend credits user balance              │
│  ❌ REJECTED → backend stores rejection_reason           │
│                user sees reason in app                   │
└──────────────────────────────────────────────────────────┘
```

---

## 4. REST API Reference

### 4.1 Get All Active Offers

Retrieves all available custom offers, optionally filtered by category, country, or user (to exclude completed offers).

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/offers` |
| **Auth** | None (public) |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ❌ | If provided, excludes offers already completed by this user |
| `category` | string | ❌ | Filter by category name (e.g. `Hot Offers`) |
| `country` | string | ❌ | Filter by two-letter country code (e.g. `IN`, `US`) |

#### Example Request

```
GET /api/offers?country=IN&category=Hot+Offers&user_id=abc123
```

#### Success Response (200)

```json
{
  "success": true,
  "offers": [
    {
      "id": "offer-uuid-1",
      "external_id": "tg_join",
      "title": "Join Telegram Channel",
      "description": "Join our official Telegram news feed to receive premium bonus codes.",
      "category": "Hot Offers",
      "iconUrl": "https://img.icons8.com/color/96/telegram-app.png",
      "trackingUrl": "https://t.me/rewardverse",
      "totalReward": 10.00,
      "type": "offline",
      "inputType": "file",
      "inputInstruction": "[{\"label\":\"Telegram Username\",\"type\":\"text\",\"required\":true},{\"label\":\"Upload Screenshot\",\"type\":\"file\",\"required\":true}]",
      "rewardType": "Single Reward",
      "isCompleted": false,
      "extraLabel": "Instant Audit",
      "estimatedTime": "1 Min",
      "difficulty": "Easy",
      "likesCount": 420,
      "isHot": true,
      "dailyCompletionCap": 100,
      "completionsToday": 15,
      "isCapped": false,
      "tiers": [
        {
          "id": 1,
          "title": "Join Telegram",
          "backend_title": "join_tg",
          "reward": "10.00",
          "status": "active",
          "steps": [
            "Click the redirect button to open the Telegram channel.",
            "Join the channel and take a screenshot showing your active membership.",
            "Submit your Telegram handle along with the screenshot."
          ]
        }
      ]
    }
  ]
}
```

---

### 4.2 Get Specific Offer Details (With User Progress)

Fetches full offer details including the user's current progress, submitted proof inputs, and admin review status.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/offers/:id` |
| **Auth** | None (public) |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | User's ID to fetch their progress for this offer |

#### Example Request

```
GET /api/offers/offer-uuid-1?user_id=abc123
```

#### Success Response (200)

```json
{
  "success": true,
  "offer": {
    "id": "offer-uuid-1",
    "external_id": "tg_join",
    "title": "Join Telegram Channel",
    "description": "Join our official Telegram news feed to receive premium bonus codes.",
    "category": "Hot Offers",
    "iconUrl": "https://img.icons8.com/color/96/telegram-app.png",
    "trackingUrl": "https://t.me/rewardverse",
    "totalReward": 10.00,
    "type": "offline",
    "inputType": "file",
    "inputInstruction": "[{\"label\":\"Telegram Username\",\"type\":\"text\",\"required\":true},{\"label\":\"Upload Screenshot\",\"type\":\"file\",\"required\":true}]",
    "rewardType": "Single Reward",
    "isCompleted": false,
    "click_id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
    "userInput": [
      {
        "label": "Telegram Username",
        "value": "@user_handle"
      },
      {
        "label": "Upload Screenshot",
        "value": "/uploads/proofs/123_tg.jpg",
        "type": "file"
      }
    ],
    "adminStatus": "PENDING",
    "rejectionReason": null,
    "dailyCompletionCap": 100,
    "completionsToday": 15,
    "isCapped": false,
    "tiers": [
      {
        "id": 1,
        "title": "Join Telegram",
        "backend_title": "join_tg",
        "reward": "10.00",
        "steps": [
          "Click the redirect button to open the Telegram channel.",
          "Join the channel and take a screenshot showing your active membership.",
          "Submit your Telegram handle along with the screenshot."
        ],
        "is_completed": false
      }
    ]
  }
}
```

#### `adminStatus` Values

| Value | Meaning |
|-------|---------|
| `null` | User has not submitted proof yet |
| `PENDING` | Proof submitted — awaiting admin review |
| `APPROVED` | Admin approved — coins have been credited |
| `REJECTED` | Admin rejected — `rejectionReason` field contains the reason |

---

### 4.3 Start Offer (Initialize Progress)

Called when the user taps **Start** or **Redeem** on an offer card. The backend generates a unique `click_id` used to track completion.

- For **online** tasks: the app opens the `trackingUrl` in a browser with the `click_id` appended as a query parameter.
- For **offline** tasks: the `click_id` is stored and sent later with the proof submission.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/offers/start` |
| **Auth** | `Authorization: Bearer <JWT_TOKEN>` ✅ |
| **Content-Type** | `application/json` |

#### Request Body

```json
{
  "offer_id": "offer-uuid-1"
}
```

#### Success Response (200)

```json
{
  "success": true,
  "click_id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6"
}
```

#### Error Responses

| HTTP | Message | Reason |
|------|---------|--------|
| `400` | `Offer not found or inactive` | Invalid offer ID |
| `400` | `Daily completion cap reached` | Offer has hit its daily limit for all users |
| `400` | `Offer not available in your country` | User's country is not in `country_targeting` |
| `400` | `You have already completed this offer` | User has already completed this offer |

---

### 4.4 Submit Campaign Proof (Offline Tasks Only)

Submits evidence (text values or uploaded screenshot paths) for an offline task. After submission, the proof enters the admin review queue.

> **Note:** File uploads should be sent to a separate `/api/upload` endpoint first. The returned file URL/path is then included in `input_data` here.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/offers/submit-proof` |
| **Auth** | `Authorization: Bearer <JWT_TOKEN>` ✅ |
| **Content-Type** | `application/json` |

#### Request Body

```json
{
  "click_id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
  "input_data": [
    {
      "label": "Telegram Username",
      "value": "@user_handle"
    },
    {
      "label": "Upload Screenshot",
      "value": "/uploads/proofs/123_tg.jpg",
      "type": "file"
    }
  ]
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `click_id` | string | ✅ | The click ID returned from `POST /api/offers/start` |
| `input_data` | array | ✅ | Array of proof input objects |
| `input_data[].label` | string | ✅ | Must match the label defined in `offers.input_instruction` |
| `input_data[].value` | string | ✅ | Text value or file path for the uploaded proof |
| `input_data[].type` | string | ❌ | Pass `"file"` if the value is a file/image path |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Proof submitted successfully"
}
```

#### Error Responses

| HTTP | Message | Reason |
|------|---------|--------|
| `400` | `Missing click_id or input_data` | Required fields not provided |
| `404` | `Progress record not found` | Invalid or expired `click_id` |
| `400` | `Proof already submitted for this offer` | Duplicate submission attempt |

---

### 4.5 Automated S2S Completion Webhook (Online Tasks Only)

Called **directly by the ad network** (not the Android app) when a user completes an online offer goal. This endpoint is public — no authorization header required.

> **Idempotent:** Calling this endpoint multiple times for the same `click_id` + `tier_title` pair is safe and returns a `200` response without double-crediting.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/webhook/postback` |
| **Method** | `GET` or `POST` |
| **Auth** | None (public webhook) |

#### Query Parameters (GET) / Request Body (POST)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `click_id` | string | ✅ | UUID generated when user started the offer (`user_offer_progress.click_id`) |
| `tier_title` | string | ✅ | Exact `offer_tiers.tier_title` string to mark as completed |

#### Example Requests

```
GET /api/webhook/postback?click_id=a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6&tier_title=Level+1+Complete
```

```json
POST /api/webhook/postback
Content-Type: application/json

{
  "click_id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
  "tier_title": "Level 1 Complete"
}
```

#### Success Response (200)

```json
{
  "success": true,
  "message": "Tier completed and user credited successfully",
  "reward": 50.0
}
```

#### Idempotent Response (200 — already processed)

```json
{
  "success": true,
  "message": "Tier already completed (idempotent)"
}
```

#### Error Responses

| HTTP | Message | Reason |
|------|---------|--------|
| `400` | `Missing click_id or tier_title` | Required parameters not sent |
| `404` | `Invalid Click ID` | No matching progress record found |
| `404` | `Tier not found for this offer` | `tier_title` doesn't match any tier in the offer |

#### What Happens After Successful Postback

1. ✅ `user_offer_progress.completed_tiers` updated with the completed tier
2. ✅ User `balance` incremented by the tier's `reward` value
3. ✅ A `CREDIT` transaction is written to the `transactions` ledger (source: `OFFER`)
4. ✅ FCM push notification sent to user's device
5. ✅ Referral commission processing triggered (if applicable)
6. ✅ Admin Telegram alert sent to admin channel

---

## 5. Common Error Responses

All endpoints return consistent JSON error objects on failure:

| HTTP Code | `success` | Example Message | When |
|-----------|-----------|-----------------|------|
| `400` | `false` | `Missing required fields` | Required body/query params absent |
| `401` | `false` | `Unauthorized` | Missing or invalid JWT token |
| `403` | `false` | `Access forbidden` | User banned or region blocked |
| `404` | `false` | `Offer not found` | Invalid offer/click ID |
| `409` | `false` | `Already completed` | Duplicate submission |
| `500` | `false` | `Server error` | Unexpected backend exception |

### Error Response Shape

```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

---

## Appendix — `input_instruction` JSON Schema

The `offers.input_instruction` column stores a JSON array defining which input fields the user must fill in for offline offers.

### Field Definition Object

| Key | Type | Values | Description |
|-----|------|--------|-------------|
| `label` | string | any | Display label shown to the user |
| `type` | string | `text`, `file` | Input type — text box or file/image picker |
| `required` | boolean | `true`, `false` | Whether the field must be filled before submitting |

### Example

```json
[
  {
    "label": "Your Telegram Username",
    "type": "text",
    "required": true
  },
  {
    "label": "Upload Membership Screenshot",
    "type": "file",
    "required": true
  }
]
```

This array is rendered dynamically in the Android app's proof submission screen.
