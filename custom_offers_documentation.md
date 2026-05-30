# 📑 Rewardverse Custom Offers Integration Documentation

This document describes how **Custom Offers** are stored, tracked, and verified inside the **Rewardverse Android Application** and **Express Backend** infrastructure.

---

## 🗄️ 1. Database Schema Reference

Custom offers rely on three main database tables. Here is their design:

### 1.1 The `offers` Table
Defines the main campaign settings.
* `id` (`VARCHAR(100)`): Unique offer UUID.
* `external_id` (`VARCHAR(100)`): Optional third-party partner code (e.g., `'c101'`).
* `title` (`VARCHAR(255)`): Core offer name shown in lists.
* `description` (`TEXT`): Detailed copy explaining steps and goals.
* `category` (`VARCHAR(100)`): Categorization (e.g., `'Hot Offers'`, `'Top Offers'`).
* `type` (`VARCHAR(50)`): 
  * `'online'`: Auto S2S tracking URLs (e.g., affiliate/redirect networks).
  * `'offline'`: Manual evidence uploading (e.g., join channels, upload proofs).
* `input_type` (`VARCHAR(50)`): Specifies input formatting for `'offline'` tasks:
  * `'file'`: Requires a screenshot upload.
  * `'text'`: Requires a text-input box (e.g., username, code).
  * `null`: No proof inputs required (online tracking).
* `input_instruction` (`TEXT`): Human-readable guidance instructing users what proof inputs they must submit.
* `reward_type` (`VARCHAR(100)`): `'Single Reward'` or `'Multi Reward'` (multi-tiered campaigns).
* `daily_completion_cap` (`INT`): Limits maximum completions per day (e.g., `50` times) to prevent click spam.
* `country_targeting` (`VARCHAR(255)`): A comma-separated country whitelist (e.g., `'IN,US'` or `'*'`).

### 1.2 The `offer_tiers` Table
For multi-tiered campaigns, maps reward payouts to steps.
* `id` (`INT AUTO_INCREMENT`): Primary index.
* `offer_id` (`CHAR(36)`): Foreign Key reference linking back to `offers.id`.
* `tier_title` (`VARCHAR(255)`): Backend identifying string (e.g., `'register'`).
* `app_tier_title` (`VARCHAR(255)`): User-friendly display title (e.g., `'Download & Register'`).
* `reward` (`DECIMAL(10,2)`): Coins added to balance upon completing this tier.
* `steps` (`JSON`): List of text instructions describing this step.

### 1.3 The `user_offer_progress` Table
Stores users' real-time performance, proofs, and approvals.
* `id` (`CHAR(36)`): Primary progress log entry ID.
* `click_id` (`CHAR(36)`): Unique tracking UUID generated dynamically when the user clicks **Start Offer**.
* `user_id` (`CHAR(36)`): Links to the primary `users.id` UUID.
* `offer_id` (`CHAR(36)`): Links to `offers.id`.
* `status` (`VARCHAR(50)`): `'STARTED'` or `'COMPLETED'`.
* `completed_tiers` (`JSON`): List of specific tier steps the user completed.
* `user_input` (`JSON`): For offline tasks, records submitted file paths or text values.
* `admin_status` (`VARCHAR(50)`): `'PENDING'`, `'APPROVED'`, or `'REJECTED'`.
* `rejection_reason` (`TEXT`): Explains failed audits to the user.

---

## 🔄 2. Complete Integration Lifecycles

### 🌐 Flow A: Online Tasks (S2S Postback Handlers)

Online tasks use redirect links and postbacks to reward users automatically.

```
[ Kotlin Client ] ══ (Start Offer) ══> [ Express Server ] ══ (Generates Click ID) 
       ║                                                                   ║
       ╠════ (Opens tracking URL + click_id in browser) ◄══════════════════╝
       ▼
 [ Ad Network ] ══════════════════════ (User completes offer goal...)
       ║
       ▼
(Triggers Postback Callback webhook with click_id & tier_title)
       ║
       ▼
 [ Express Server ] ══ (Validates callback, records CREDIT transaction, adds balance)
```

---

### 📷 Flow B: Offline Tasks (Manual Proof & Verification)

Offline tasks require manual verification by administrators before coins are credited.

```
[ Kotlin Client ] ══ (Start Offer) ══> [ Express Server ] ══ (Generates Click ID) 
       ║                                                                   
       ╠════ (Collects screenshots / inputs from user in App)
       ║
       ▼
[ POST /api/offers/submit-proof ] ══> [ Express Server ] 
                                             ║
                                  (Saves user_input in DB)
                                  (Sets admin_status = 'PENDING')
                                             ║
                                             ▼
                                    [ Admin Dashboard ] ══ (Reviews Evidence)
                                             ║
                                 (Approve / Reject Action)
                                             ║
                                             ▼
                                    [ Express Server ] ══ (Applies Credit if APPROVED)
```

---

## 🔌 3. Complete REST API Specifications

### 3.1 Get All Active Offers
Retrieves available custom offers tailored to search queries, categories, or country whitelists.

* **Route**: `GET /api/offers`
* **Query Parameters**:
  * `user_id` (string, optional): Excludes already-completed offers.
  * `category` (string, optional): Filters by tag name.
  * `country` (string, optional): Filters by two-letter country code (e.g., `'IN'`).
* **Success Response (JSON)**:
```json
{
  "success": true,
  "offers": [
    {
      "id": "1",
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
      "isCompleted": false,
      "rewardType": "Single Reward",
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
            "Click on standard redirect button to join channel.",
            "Take a screenshot proving your active subscription.",
            "Submit your Telegram handle along with the screenshot file."
          ]
        }
      ]
    }
  ]
}
```

---

### 3.2 Get Specific Offer Details (With User Progress)
Fetches progress state, clicks, proofs, and audit results for a specific offer.

* **Route**: `GET /api/offers/:id`
* **Query Parameter**: `user_id` (string, required)
* **Success Response (JSON)**:
```json
{
  "success": true,
  "offer": {
    "id": "1",
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
          "Click on standard redirect button to join channel.",
          "Take a screenshot proving your active subscription.",
          "Submit your Telegram handle along with the screenshot file."
        ],
        "is_completed": false
      }
    ]
  }
}
```

---

### 3.3 Start Offer (Initialize Progress)
Triggered when a user clicks the "Start" or "Redeem" button. Prevents users from bypassing caps or targeting boundaries.

* **Route**: `POST /api/offers/start`
* **Headers**: `Authorization: Bearer <JWT_TOKEN>`
* **Request Body (JSON)**:
```json
{
  "offer_id": "1"
}
```
* **Success Response (JSON)**:
```json
{
  "success": true,
  "click_id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6"
}
```

---

### 3.4 Submit Campaign Proof (Offline Tasks Only)
Submits evidence (text inputs or screenshot links) to the server for manual verification.

* **Route**: `POST /api/offers/submit-proof`
* **Headers**: `Authorization: Bearer <JWT_TOKEN>`
* **Request Body (JSON)**:
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
* **Success Response (JSON)**:
```json
{
  "success": true,
  "message": "Proof submitted successfully"
}
```

---

### 3.5 Automated S2S Completion Webhook (Online Tasks Only)
Called directly by ad networks to complete a task automatically.

* **Route**: `GET /api/webhook/postback`
* **Query Parameters**:
  * `click_id` (string, required): Matches the UUID generated in step 3.3.
  * `tier_title` (string, required): Matches `offer_tiers.tier_title`.
* **Success Response (JSON)**:
```json
{
  "success": true,
  "message": "Tier completed and user credited successfully",
  "reward": 10.00
}
```
