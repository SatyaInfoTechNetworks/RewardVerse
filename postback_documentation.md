# 📡 Rewardverse – Postback / S2S Webhook Integration Documentation

> **Base URL:** `https://api-rewardverse.satyainfotechnetworks.com`
>
> All postback endpoints are **public** (no Authorization header required).  
> Duplicate callbacks are automatically **idempotent** (safe to retry).  
> Last verified: **June 2026** — matches `webhookController.js` production code.

---

## Table of Contents

1. [Generic In-House Postback](#1-generic-in-house-postback)
2. [PubScale (Completion)](#2-pubscale-completion-postback)
3. [PubScale (Chargeback / Reversal)](#3-pubscale-chargeback--reversal-postback)
4. [CPX Research](#4-cpx-research-postback)
5. [AdJump](#5-adjump-postback)
6. [Offermaru](#6-offermaru-postback)
7. [GrowDeck Playtime](#7-growdeck-playtime-postback)
8. [Opinion Universe](#8-opinion-universe-postback)
9. [Playtime Ads](#9-playtime-ads-postback)
10. [Pocketsfull (Completion + Chargeback)](#10-pocketsfull-postback)
11. [Real Opinion](#11-real-opinion-postback)
12. [Generic Offer Completed (Pending Validation)](#12-generic-offer-completed-pending-validation)
13. [Timewall (Credit / Hold / Hold Cancelled / Chargeback)](#13-timewall-postback)

---

## How Postbacks Work

```
Ad Network → HTTP GET/POST → Rewardverse Webhook Endpoint
                                    ↓
                          Verify Signature / Hash
                                    ↓
                         Resolve User by uid / id / user_id (hex)
                                    ↓
                    Check Idempotency (offer_completions.completion_id)
                                    ↓
                        Credit balance + Write transaction ledger
                                    ↓
                    Send FCM push notification + Admin Telegram alert
                                    ↓
                        Process referral commission (async)
```

**User ID Resolution Order (resolveUser helper):**
1. Firebase UID (`uid` column)
2. Primary database UUID (`id` column)
3. 10-char hex public user ID (`user_id` column)

---

## 1. Generic In-House Postback

Used for your own in-house offer tracking. Called when a user completes a tier of a custom offer.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/postback` |
| **Method** | `GET` or `POST` |
| **Auth** | None |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `click_id` | string | ✅ | Unique ID generated when user starts the offer (`user_offer_progress.click_id`) |
| `tier_title` | string | ✅ | Exact tier title string to mark as completed (case-insensitive match) |

### Example Request

```
GET /api/webhook/postback?click_id=abc123&tier_title=Level+1+Complete
```

```json
POST /api/webhook/postback
Content-Type: application/json

{
  "click_id": "abc123",
  "tier_title": "Level 1 Complete"
}
```

### Success Response (200)

```json
{
  "success": true,
  "message": "Tier completed and user credited successfully",
  "reward": 50.0
}
```

### Error Responses

| HTTP | Message |
|------|---------|
| 400 | `Missing click_id or tier_title` |
| 404 | `Invalid Click ID` |
| 404 | `User not found for this click` |
| 404 | `Tier not found for this offer` |

### Behavior Notes
- Idempotent: if tier was already completed for this `click_id`, returns `200` with `"Tier already completed (idempotent)"`.
- Marks `user_offer_progress.status` → `COMPLETED` if ALL tiers done, otherwise `STARTED`.
- Logs transaction with description: `{offerTitle} : {displayTitle}`.
- Fires push notification + referral commission processing.

---

## 2. PubScale Completion Postback

Called by PubScale S2S when a user completes a survey or offer.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/pubscale` |
| **Method** | `GET` |
| **Auth** | HMAC Signature (`md5`) |

### Signature Algorithm

```
signature = md5( SECRET_KEY + "." + user_id + "." + floor(value) + "." + token )
```

> **Secret Key:** `5e3b39c2-755c-40ba-8c96-6b9d2e60a166`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier (UID / hex ID / UUID) |
| `value` | number | ✅ | Coin reward amount |
| `token` | string | ✅ | Unique transaction token (idempotency key) |
| `signature` | string | ✅ | MD5 signature hash |
| `offer_name` | string | ❌ | Name of the completed offer (default: `"External Offer"`) |
| `goal_name` | string | ❌ | Goal/milestone name |
| `gaid` | string | ❌ | Google Advertising ID |
| `ip` | string | ❌ | User's IP address |

### PubScale Dashboard Setup

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/pubscale?user_id={userid}&value={reward}&token={transactionid}&signature={signature}&offer_name={offer_name}&goal_name={goal_name}
```

### Success Response (200)

```json
{ "status": "success", "message": "User rewarded successfully" }
```

### Duplicate Response (200)

```json
{ "status": "success", "message": "Duplicate token ignored" }
```

### Error Responses

| HTTP | status | Message |
|------|--------|---------|
| 400 | error | `Missing required parameters` |
| 403 | error | `Invalid Signature` |
| 404 | error | `User not found` |

### Behavior Notes
- Idempotency key = `token`. Duplicate tokens are silently accepted with `200`.
- Inserts into `offer_completions` with `provider = 'pubscale'`.
- Transaction source = `PUBSCALE`.

---

## 3. PubScale Chargeback / Reversal Postback

Called by PubScale when a completed reward needs to be reversed (e.g. fraud, return).

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/pubscale-chargeback` |
| **Method** | `GET` |
| **Auth** | HMAC Signature (`md5`) — same algorithm as completion |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `value` | number | ✅ | Coins to deduct |
| `token` | string | ✅ | Original completion token |
| `signature` | string | ✅ | MD5 signature hash |
| `offer_name` | string | ❌ | Offer name (default: `"External Offer"`) |
| `reason` | string | ❌ | Reason for reversal (default: `"Reversed by provider"`) |
| `gaid` | string | ❌ | Google Advertising ID |
| `ip` | string | ❌ | User IP |

### PubScale Dashboard Setup

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/pubscale-chargeback?user_id={userid}&value={reward}&token={transactionid}&signature={signature}&reason={reason}
```

### Behavior Notes
- Checks if already `REVERSED` — if so, returns `200` idempotently.
- Sets `offer_completions.status` → `REVERSED`.
- Deducts coins from user balance.
- Writes a `DEBIT` / `PUBSCALE_REVERSAL` transaction to the ledger.
- Sends admin Telegram alert `🚨` + push notification to user.
- Offer name resolved from original `offer_completions` record first, then from `offer_name` param.

---

## 4. CPX Research Postback

Called by CPX Research for survey completions and reversals.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/cpx-research` |
| **Method** | `GET` |
| **Auth** | MD5 hash |
| **Response Format** | Plain text (not JSON) |

### Signature Algorithm

```
hash = md5( trans_id + "-" + SECURE_HASH )
```

> **Secure Hash:** `c61DO2Aq2vD6kZZ9OlLZzNtiXPoDrh2R`

> **Note:** The raw `SECURE_HASH` itself is also accepted as `hash` (test mode fallback).

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `trans_id` | string | ✅ | Unique transaction ID |
| `user_id` | string | ✅ | Rewardverse user identifier |
| `hash` | string | ✅ | MD5 verification hash |
| `status` | string | ✅ | `1` = success, `2` = canceled, `-2` = fraud |
| `amount_local` | number | ❌ | Coin reward amount |
| `type` | string | ❌ | Survey type label |
| `offer_id` | string | ❌ | CPX Offer ID |

### CPX Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/cpx-research?trans_id={trans_id}&user_id={user_id}&status={status}&amount_local={amount_local}&hash={hash}&type={type}
```

### Response Values (Plain Text)

| Value | Meaning |
|-------|---------|
| `OK` | Processed successfully |
| `user_not_found` | User not found |
| `missing_parameters` | Required params missing |
| `invalid_hash` | Signature mismatch |
| `internal_error` | Server error |

### Status Codes

| `status` | Action |
|----------|--------|
| `1` | ✅ Credit user with `amount_local` coins |
| `2` | 🚨 Reversal — deduct coins, status → `REVERSED` |
| `-2` | 🚨 Fraud reversal — deduct coins, status → `FRAUD` |

### Behavior Notes
- Reversal uses original `amount` from the `transactions` table; falls back to `amount_local`.
- Transaction source = `CPX_RESEARCH` / `CPX_RESEARCH_REVERSAL`.

---

## 5. AdJump Postback

Called by AdJump for offer and campaign completions.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/adjump` |
| **Method** | `GET` |
| **Auth** | None (IP whitelist recommended) |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` / `userid` | string | ✅ | Rewardverse user identifier |
| `reward` / `reward_amount` | number | ✅ | Coin reward amount |
| `transaction_id` | string | ❌ | Unique transaction ID (auto-generated if missing) |
| `campaign` | string | ❌ | Campaign / offer name (default: `"Adjump Offer"`) |
| `offer_id` | number | ❌ | AdJump Offer ID |

### AdJump Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/adjump?user_id={user_id}&reward={reward}&transaction_id={transaction_id}&campaign={campaign_name}&offer_id={offer_id}
```

### Success Response (200)

```json
{ "status": "success", "message": "User rewarded successfully" }
```

### Behavior Notes
- If `transaction_id` is missing, auto-generated as `ADJ_{md5(user_id + reward + campaign + hourSlot)}` — providing **hourly idempotency** per offer campaign.
- Transaction source = `ADJUMP`.
- Triggers referral commission processing.

---

## 6. Offermaru Postback

Called by Offermaru S2S with HMAC-SHA256 signature verification and replay attack protection.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/offermaru` |
| **Method** | `GET` |
| **Auth** | HMAC-SHA256 in `X-Offermaru-Signature` header |

### Signature Algorithm

```
// Fields sorted alphabetically: offer_id, publisher_payout, timestamp, transaction_id, user_id, user_reward
payload = sorted_keys.map(k => `${k}=${v}`).join("&")
signature = HMAC-SHA256( OFFERMARU_SECRET, payload )
```

> **Secret:** Set in `OFFERMARU_S2S_SECRET` env variable  
> Default fallback: `b38c7127c0b72528637466fd703e2eac90a7b033b54339a7399709292f2c8043`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `transaction_id` | string | ✅ | Unique transaction ID |
| `user_reward` | number | ✅ | Coin reward for user |
| `timestamp` | number | ✅ | Unix timestamp in **ms** — rejected if > 5 min old |
| `offer_id` | string | ❌ | Offermaru Offer ID |
| `offer_name` | string | ❌ | Offer display name (default: `"Offermaru Offer"`) |
| `publisher_payout` | number | ❌ | Publisher revenue amount |

### Header

```
X-Offermaru-Signature: {hmac_sha256_signature}
```

### Offermaru Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/offermaru?user_id={user_id}&transaction_id={transaction_id}&user_reward={user_reward}&publisher_payout={publisher_payout}&offer_id={offer_id}&offer_name={offer_name}&timestamp={timestamp}
```

### Response

Returns `OK` on success (plain text), or JSON error.

### Behavior Notes
- **Replay protection**: requests older than **5 minutes** (based on `timestamp` ms) are rejected with `403`.
- If `OFFERMARU_S2S_SECRET` is set but `X-Offermaru-Signature` header is missing → `403 Missing Signature`.
- Transaction source = `OFFERMARU`.

---

## 7. GrowDeck Playtime Postback

Called by GrowDeck for playtime-based offer completions.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/growdeck` |
| **Method** | `GET` |
| **Auth** | HMAC-SHA256 signature |

### Signature Algorithm

```
rewardTrunc = Math.trunc(reward)
payload     = SECRET_KEY + "." + user_id + "." + rewardTrunc + "." + transaction_id
signature   = HMAC-SHA256( SECRET_KEY, payload )
```

> **Secret Key:** `30a11d6e8a666dd4bf5d6a4ab0a899`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `transaction_id` | string | ✅ | Unique transaction ID |
| `signature` | string | ✅ | HMAC-SHA256 signature |
| `reward` | number | ✅ | Coin reward amount |
| `campaign` | string | ❌ | Campaign / game name (default: `"GrowDeck Playtime"`) |
| `offer_id` | number | ❌ | Offer ID |
| `click_ip` | string | ❌ | User IP |
| `gaid` | string | ❌ | Google Advertising ID |

### GrowDeck Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/growdeck?user_id={user_id}&reward={reward}&transaction_id={transaction_id}&signature={signature}&campaign={campaign}&offer_id={offer_id}&gaid={gaid}
```

### Success Response (200)

```json
{ "status": "success", "message": "User rewarded successfully" }
```

### Behavior Notes
- Uses `click_ip` first, then falls back to `req.ip`.
- Transaction source = `GROWDECK`.

---

## 8. Opinion Universe Postback

Called by Opinion Universe for survey completions and reversals.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/opinionuniverse` |
| **Method** | `GET` |
| **Auth** | HMAC-SHA256 in `SIG` query param (optional) |
| **Response Format** | Plain text `1` (success) or `0` (error) |

### Signature Algorithms (all tried in order)

```
// Method 1: HMAC-SHA256 of TransactionID alone
expectedHmac = HMAC-SHA256( TOKEN, TransactionID )

// Method 2: SHA256 of sorted query params (RFC 3986) + TOKEN
payload = sortedKeys.map(k => encodeURIComponent(k)=encodeURIComponent(v)).join("&")
expectedSig = SHA256( payload + TOKEN )

// Method 3: Same as Method 2 but %20 → + (RFC 1738)

// Method 4: SHA256 of raw (unencoded) query string + TOKEN
```

> **Token:** `edeb747df552564cf19058001f70a64d0f7c51347c1d6a5f2da3fb669995a2c5`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userid` / `SID` | string | ✅ | Rewardverse user identifier |
| `TransactionID` | string | ✅ | Unique transaction ID |
| `PAYOUT` | number | ✅ | Coin reward amount |
| `STATUS` | string | ✅ | `1` = success, `2` = reversal |
| `OFFERID` | string | ❌ | Opinion Universe offer ID |
| `offername` | string | ❌ | Offer name (default: `"Opinion Universe Offer"`) |
| `eventname` | string | ❌ | Event/survey type |
| `IP` | string | ❌ | User IP |
| `gaid` | string | ❌ | Google Advertising ID |
| `SIG` | string | ❌ | Signature (any of 4 methods above) |

### Opinion Universe Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/opinionuniverse?userid={SID}&TransactionID={TransactionID}&PAYOUT={PAYOUT}&STATUS={STATUS}&OFFERID={OFFERID}&offername={OFFER_NAME}&SIG={SIG}&IP={IP}
```

### Response Values

| Value | Meaning |
|-------|---------|
| `1` | Processed successfully |
| `0` | Error (user not found, validation failed) |

### Status Codes

| `STATUS` | Action |
|----------|--------|
| `1` | ✅ Credit user |
| `2` | 🚨 Reversal — deduct coins, status → `REVERSED` |

### Behavior Notes
- If `TransactionID` contains `{` placeholder → synthetic ID auto-generated as `OU_{user_id}_{offer_id}_{PAYOUT}_{timestamp}`.
- Test callbacks with `{` in `userid` or `PAYOUT` are detected AFTER signature check → returns `1` and fires a test Telegram alert.
- If `SIG` is not provided, verification is skipped (open mode).
- Transaction source = `OPINION_UNIVERSE` / `OPINION_UNIVERSE_REVERSAL`.

---

## 9. Playtime Ads Postback

Called by Playtime Ads for milestone-based gaming completions.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/playtimeads` |
| **Method** | `GET` or `POST` |
| **Auth** | SHA1 signature |

### Signature Algorithm

```
rawString = user_id + offer_id + amount + APPLICATION_KEY + APPLICATION_SECRET_KEY
signature = SHA1( rawString )
```

> **Application Key:** `59c2f0110111f993` (or `PLAYTIME_APP_KEY` env var)  
> **Application Secret:** `9GAVPWIXW5SB3QGD` (or `PLAYTIME_APP_SECRET` env var)

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `amount` | number | ✅ | Coin reward amount |
| `signature` | string | ✅ | SHA1 signature |
| `offer_id` | string | ❌ | Playtime offer ID |
| `offer_name` | string | ❌ | Game/offer name (default: `"Playtime Offer"`) |
| `task_id` | string | ❌ | Specific task/milestone ID |
| `task_name` | string | ❌ | Task description |

### Playtime Ads Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/playtimeads?user_id={user_id}&offer_id={offer_id}&offer_name={offer_name}&amount={amount}&task_id={task_id}&task_name={task_name}&signature={signature}
```

### Success Response (200)

```json
{ "status": "success", "message": "User rewarded successfully" }
```

### Behavior Notes
- Transaction ID auto-generated as `PLAYTIME_{md5(user_id + offer_id + task_id + amount + task_name)}` — ensures per-milestone idempotency.
- Display name = `{offer_name} - {task_name}` if `task_name` is present.
- Params merged from both `req.query` and `req.body`.
- Transaction source = `PLAYTIME`.

---

## 10. Pocketsfull Postback

Handles both completions and chargebacks from Pocketsfull.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/pocketsfull` |
| **Method** | `GET` or `POST` |
| **Auth** | MD5 hash |

### Signature Algorithm

```
hash = md5( trans_id + "-" + SECURE_HASH )
```

> **Secure Hash:** `32bd6747585ce63889cc74de8bdc6b4e`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `trans_id` | string | ✅ | Unique transaction ID |
| `user_id` | string | ✅ | Rewardverse user identifier |
| `status` | string | ✅ | See status table below |
| `hash` | string | ✅ | MD5 hash |
| `amount_local` | number | ❌ | Coin amount |
| `offer_id` | string | ❌ | Offer ID |
| `type` | string | ❌ | Offer type label (default: `"Offer"`) |

### Pocketsfull Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/pocketsfull?trans_id={trans_id}&user_id={user_id}&status={status}&amount_local={amount_local}&hash={hash}&offer_id={offer_id}&type={type}
```

### Status Values

| `status` | Action |
|----------|--------|
| `approved` / `completed` / `1` | ✅ Credit user |
| `rejected` / `chargeback` / `2` | 🚨 Deduct coins (reversal → `REVERSED`) |
| any other value | ✅ `200` ignored silently |

### Success Response (200)

```json
{ "status": "success", "message": "User rewarded successfully" }
```

### Behavior Notes
- Chargeback deduction amount is taken from `offer_completions.payout_coins` first, then falls back to `amount_local`.
- Offer name for chargeback resolves from original `offer_completions.offer_name`.
- Transaction source = `POCKETSFULL` / `POCKETSFULL_REVERSAL`.

---

## 11. Real Opinion Postback

Handles JSON POST callbacks from Real Opinion surveys.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/realopinion` |
| **Method** | `POST` |
| **Auth** | None (IP whitelist recommended) |
| **Content-Type** | `application/json` |

### Request Body (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `trans_id` | string | ✅ | Unique transaction ID |
| `status` | number | ✅ | `1` = success (any other value → `200` but ignored) |
| `user_payout` | number | ❌ | Base coin reward |
| `bonus_amount` | number | ❌ | Bonus coins (added to `user_payout`) |
| `publisher_payout` | number | ❌ | Publisher revenue (stored, not credited) |
| `app_id` | string | ❌ | Real Opinion App ID |

### Example Request

```json
POST /api/webhook/realopinion
Content-Type: application/json

{
  "user_id": "abc123xyz",
  "trans_id": "RO_TXN_789456",
  "status": 1,
  "user_payout": 50,
  "bonus_amount": 10,
  "publisher_payout": 0.05
}
```

### Success Response (200)

```json
{ "success": true, "message": "Callback received and processed successfully." }
```

### Behavior Notes
- **Total reward** = `user_payout + bonus_amount`.
- Only `status = 1` triggers a credit. All other statuses return `200` but are silently ignored.
- Transaction source = `REAL_OPINION`.

---

## 12. Generic Offer Completed (Pending Validation)

Used for S2S integrations that require admin validation before crediting. Does **NOT** credit the user immediately.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/offer-completed` |
| **Method** | `POST` |
| **Auth** | None |
| **Content-Type** | `application/json` |

### Request Body (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `completion_id` | string | ✅ | Unique completion identifier |
| `offer_id` | string | ✅ | Offer ID |
| `payout` | number | ✅ | Expected coin payout |
| `user_id` | string | ❌* | User identifier (*one of `user_id` or `user_install_id` required) |
| `user_install_id` | string | ❌* | Install ID fallback |
| `provider` | string | ❌ | Ad network name (default: `"unknown"`) |

### Example Request

```json
POST /api/webhook/offer-completed
Content-Type: application/json

{
  "completion_id": "UNIQUE_COMP_ID_001",
  "offer_id": "APP_XYZ",
  "payout": 100,
  "user_id": "user_abc123",
  "provider": "custom_network"
}
```

### Success Response (200)

```json
{ "success": true, "message": "Offer recorded" }
```

### Behavior Notes
- Record saved with status `PENDING_VALIDATION` — balance is **NOT** credited yet.
- Admin must approve/reject from the admin dashboard → **Proofs** section.
- Sends admin Telegram alert `⏳` + user push notification.
- Does **NOT** trigger referral commission (happens on admin approval in `walletController`).

---

## 13. Timewall Postback

Multi-action postback for Timewall offerwall. Handles credits, holds, hold cancellations, and chargebacks.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/timewall` |
| **Method** | `GET` or `POST` |
| **Auth** | SHA256 hash (optional) |

### Signature Algorithm

```
payload = user_id + revenue + TIMEWALL_SECRET
hash    = SHA256( payload )
```

> **Secret:** `e1bd718416cbd32f670bd4587a4f3313`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `transaction_id` | string | ✅ | Unique transaction ID |
| `type` | string | ✅ | See type table below (default: `"credit"`) |
| `reward` | number | ❌ | Coin reward amount |
| `revenue` | number | ❌ | Publisher revenue (used in hash calculation) |
| `hash` | string | ❌ | SHA256 signature |
| `offer_name` | string | ❌ | Offer name (default: `"Timewall Withdrawal"`) |
| `reason` | string | ❌ | Reason for reversal/chargeback |
| `ip` | string | ❌ | User IP |
| `withdraw_id` | string | ❌ | Withdrawal reference |

### Timewall Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/timewall?user_id={user_id}&transaction_id={transaction_id}&revenue={revenue}&reward={reward}&type={type}&offer_name={offer_name}&hash={hash}
```

### Type Values

| `type` | Action |
|--------|--------|
| `credit` (default) | ✅ Credit user with `reward` coins |
| `hold` | ⏳ Record as `PENDING_VALIDATION` — wait for admin approval |
| `hold_cancelled` | ❌ Cancel a held transaction → status `CANCELLED` |
| `chargeback` | 🚨 Deduct coins (reversal → `REVERSED`) |

> **Note:** Negative `reward` or `revenue` values also trigger the chargeback flow regardless of `type`.

### Success Response (200)

```json
{ "status": "success", "message": "User rewarded successfully" }
```

### Behavior Notes
- Hash verification is done case-insensitively (both compared `.toLowerCase()`).
- IP resolved from `x-forwarded-for` → `x-real-ip` → `req.ip` → `ip` param.
- `hold_cancelled` sets status to `CANCELLED` (not `REVERSED`).
- Transaction source = `TIMEWALL` / `TIMEWALL_REVERSAL`.

---

## Common Response Patterns

### All Postbacks

| Condition | HTTP | Response |
|-----------|------|----------|
| ✅ Success | `200` | `{"status":"success","message":"..."}` or `OK` or `1` |
| 🔁 Duplicate (idempotent) | `200` | `"Already processed"` / `"Duplicate token ignored"` |
| ❌ Missing params | `400` | `{"status":"error","message":"Missing required parameters"}` |
| 🔒 Invalid signature | `403` | `{"status":"error","message":"Invalid Signature"}` |
| 👤 User not found | `404` | `{"status":"error","message":"User not found"}` |
| 💥 Server error | `500` | `{"status":"error","message":"..."}` |

---

## Security Features

| Feature | Description |
|---------|-------------|
| **Timing-safe comparison** | All signature checks use `crypto.timingSafeEqual()` via `safeCompare()` helper |
| **Idempotency** | All postbacks check `offer_completions.completion_id` before crediting |
| **Replay protection** | Offermaru rejects requests older than 5 minutes via `timestamp` param |
| **Atomic DB transactions** | All balance + ledger writes are wrapped in MySQL `BEGIN / COMMIT` blocks |
| **Referral processing** | All successful completions automatically trigger `processReferralRewards()` async |

---

## Admin Notifications

Every successful (or reversed) postback fires:
1. **Telegram Alert** to the admin channel with:
   - 👤 User name + hex ID
   - 🔥 Offer name
   - 📡 Network name + brand logo image preview
   - 💰 Coins credited/deducted
   - 🆔 Transaction ID
2. **FCM Push Notification** to the user's device

---

## Testing Postbacks Locally

You can test any postback with `curl`:

```bash
# Test Generic Postback
curl -X POST "https://api-rewardverse.satyainfotechnetworks.com/api/webhook/postback" \
  -H "Content-Type: application/json" \
  -d '{"click_id":"YOUR_CLICK_ID","tier_title":"Level 1"}'

# Test PubScale (build signature first)
curl "https://api-rewardverse.satyainfotechnetworks.com/api/webhook/pubscale?user_id=USER_UID&value=100&token=UNIQUE_TOKEN&signature=YOUR_MD5_SIG&offer_name=Test+Offer"

# Test CPX Research
curl "https://api-rewardverse.satyainfotechnetworks.com/api/webhook/cpx-research?trans_id=TX123&user_id=USER_UID&status=1&amount_local=50&hash=YOUR_MD5_HASH"

# Test Pocketsfull
curl "https://api-rewardverse.satyainfotechnetworks.com/api/webhook/pocketsfull?trans_id=TX123&user_id=USER_UID&status=completed&amount_local=75&hash=YOUR_MD5_HASH"

# Test Playtime Ads
curl "https://api-rewardverse.satyainfotechnetworks.com/api/webhook/playtimeads?user_id=USER_UID&offer_id=123&amount=60&signature=YOUR_SHA1&task_name=Level+5"

# Test Timewall
curl "https://api-rewardverse.satyainfotechnetworks.com/api/webhook/timewall?user_id=USER_UID&transaction_id=TXID001&type=credit&reward=50&offer_name=TestOffer"

# Test Real Opinion
curl -X POST "https://api-rewardverse.satyainfotechnetworks.com/api/webhook/realopinion" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"USER_UID","trans_id":"RO_TX001","status":1,"user_payout":50,"bonus_amount":10}'
```

---

## Environment Variables for Postbacks

```env
# Playtime Ads
PLAYTIME_APP_KEY=59c2f0110111f993
PLAYTIME_APP_SECRET=3QDAWT60JYHQ2IWZ

# Offermaru
OFFERMARU_S2S_SECRET=b38c7127c0b72528637466fd703e2eac90a7b033b54339a7399709292f2c8043
```

> All other secrets (PubScale, CPX Research, GrowDeck, Pocketsfull, Timewall, Opinion Universe, Real Opinion) are **hardcoded constants** in `webhookController.js`.

---

## Route Registration Summary (`server.js`)

| Route | Methods | Handler |
|-------|---------|---------|
| `/api/webhook/postback` | GET, POST | `handlePostback` |
| `/api/webhook/pubscale` | GET | `handlePubscale` |
| `/api/webhook/pubscale-chargeback` | GET | `handlePubscaleChargeback` |
| `/api/webhook/cpx-research` | GET | `handleCpxResearch` |
| `/api/webhook/adjump` | GET | `handleAdjump` |
| `/api/webhook/offermaru` | GET | `handleOffermaru` |
| `/api/webhook/growdeck` | GET | `handleGrowdeck` |
| `/api/webhook/opinionuniverse` | GET | `handleOpinionUniverse` |
| `/api/webhook/playtimeads` | GET, POST | `handlePlaytimeAds` |
| `/api/webhook/pocketsfull` | GET, POST | `handlePocketsfull` |
| `/api/webhook/realopinion` | POST | `handleRealOpinion` |
| `/api/webhook/offer-completed` | POST | `handleOfferCompleted` |
| `/api/webhook/timewall` | GET, POST | `handleTimewall` |

---

*Documentation updated June 2026 — Verified against `webhookController.js` production code — Rewardverse Backend v2.5 — SatyaInfoTechNetworks*
