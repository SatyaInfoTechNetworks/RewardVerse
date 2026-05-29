# 📡 Rewardverse – Postback / S2S Webhook Integration Documentation

> **Base URL:** `https://api-rewardverse.satyainfotechnetworks.com`
>
> All postback endpoints are **public** (no Authorization header required).  
> Duplicate callbacks are automatically **idempotent** (safe to retry).

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
13. [Timewall (Credit / Hold / Chargeback)](#13-timewall-postback)

---

## How Postbacks Work

```
Ad Network → HTTP GET/POST → Rewardverse Webhook Endpoint
                                    ↓
                          Verify Signature / Hash
                                    ↓
                         Resolve User by user_id / uid / user_id hex
                                    ↓
                    Check Idempotency (duplicate completion_id check)
                                    ↓
                        Credit balance + Write transaction ledger
                                    ↓
                Send FCM push notification + Admin Telegram alert
```

**User ID Resolution Order:**
1. Firebase UID (`uid` column)
2. Primary database ID (`id` column)
3. 10-char hex public user ID (`user_id` column)

---

## 1. Generic In-House Postback

Used for your own in-house offer tracking. Called when a user completes a tier of an offer.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/postback` |
| **Method** | `GET` or `POST` |
| **Auth** | None |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `click_id` | string | ✅ | Unique ID generated when user starts the offer (`user_offer_progress.click_id`) |
| `tier_title` | string | ✅ | Exact tier title string to mark as completed |

### Example Request

```
GET /api/webhook/postback?click_id=abc123&tier_title=Level+1+Complete
```

```json
POST /api/webhook/postback
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
| 404 | `Tier not found for this offer` |

### Behavior Notes
- Idempotent: if the tier was already completed for this `click_id`, returns `200` with `"Tier already completed (idempotent)"`.
- Automatically fires a push notification to the user.
- Triggers referral commission processing.

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
| `user_id` | string | ✅ | Rewardverse user identifier (UID / hex ID) |
| `value` | number | ✅ | Coin reward amount |
| `token` | string | ✅ | Unique transaction token (idempotency key) |
| `signature` | string | ✅ | MD5 signature hash |
| `offer_name` | string | ❌ | Name of the completed offer |
| `goal_name` | string | ❌ | Goal/milestone name |
| `gaid` | string | ❌ | Google Advertising ID |
| `ip` | string | ❌ | User's IP address |

### PubScale Dashboard Setup

Configure your postback URL in PubScale dashboard as:
```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/pubscale?user_id={userid}&value={reward}&token={transactionid}&signature={signature}&offer_name={offer_name}&goal_name={goal_name}
```

### Success Response (200)

```json
{
  "status": "success",
  "message": "User rewarded successfully"
}
```

### Duplicate Response (200)

```json
{
  "status": "success",
  "message": "Duplicate token ignored"
}
```

### Error Responses

| HTTP | status | Message |
|------|--------|---------|
| 400 | error | `Missing required parameters` |
| 403 | error | `Invalid Signature` |
| 404 | error | `User not found` |

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
| `offer_name` | string | ❌ | Offer name |
| `reason` | string | ❌ | Reason for reversal |

### PubScale Dashboard Setup

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/pubscale-chargeback?user_id={userid}&value={reward}&token={transactionid}&signature={signature}&reason={reason}
```

### Behavior Notes
- Marks completion record status as `REVERSED`.
- Deducts coins from user balance.
- Writes a `DEBIT` / `PUBSCALE_REVERSAL` transaction to the ledger.
- Sends admin Telegram alert `🚨` and push notification to user.

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
| `2` | 🚨 Reversal — deduct coins (status → `REVERSED`) |
| `-2` | 🚨 Fraud reversal — deduct coins (status → `FRAUD`) |

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
| `user_id` | string | ✅ | Rewardverse user identifier |
| `reward` / `reward_amount` | number | ✅ | Coin reward amount |
| `transaction_id` | string | ❌ | Unique transaction ID (auto-generated if missing) |
| `campaign` | string | ❌ | Campaign / offer name |
| `offer_id` | number | ❌ | AdJump Offer ID |

### AdJump Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/adjump?user_id={user_id}&reward={reward}&transaction_id={transaction_id}&campaign={campaign_name}&offer_id={offer_id}
```

### Success Response (200)

```json
{
  "status": "success",
  "message": "User rewarded successfully"
}
```

### Notes
- If `transaction_id` is missing, one is auto-generated using MD5 of `user_id + reward + campaign + hour` — providing **hourly idempotency** per offer campaign.
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
payload = sorted_keys.map(k => `${k}=${v}`).join("&")
// Fields: offer_id, publisher_payout, timestamp, transaction_id, user_id, user_reward
signature = HMAC-SHA256( OFFERMARU_SECRET, payload )
```

> **Secret:** Set in `OFFERMARU_S2S_SECRET` environment variable  
> Default fallback: `b38c7127c0b72528637466fd703e2eac90a7b033b54339a7399709292f2c8043`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `transaction_id` | string | ✅ | Unique transaction ID |
| `user_reward` | number | ✅ | Coin reward for user |
| `timestamp` | number | ✅ | Unix timestamp (ms) — request rejected if >5 min old |
| `offer_id` | string | ❌ | Offermaru Offer ID |
| `offer_name` | string | ❌ | Offer display name |
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

### Notes
- **Replay attack protection**: Requests older than **5 minutes** are rejected.
- Idempotent via `transaction_id`.

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
payload = SECRET_KEY + "." + user_id + "." + rewardTrunc + "." + transaction_id
signature = HMAC-SHA256( SECRET_KEY, payload )
```

> **Secret Key:** `30a11d6e8a666dd4bf5d6a4ab0a899`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `transaction_id` | string | ✅ | Unique transaction ID |
| `signature` | string | ✅ | HMAC-SHA256 signature |
| `reward` | number | ✅ | Coin reward amount |
| `campaign` | string | ❌ | Campaign / game name |
| `offer_id` | number | ❌ | Offer ID |
| `click_ip` | string | ❌ | User IP |
| `gaid` | string | ❌ | Google Advertising ID |

### GrowDeck Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/growdeck?user_id={user_id}&reward={reward}&transaction_id={transaction_id}&signature={signature}&campaign={campaign}&offer_id={offer_id}&gaid={gaid}
```

### Success Response (200)

```json
{
  "status": "success",
  "message": "User rewarded successfully"
}
```

---

## 8. Opinion Universe Postback

Called by Opinion Universe for survey completions and reversals.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/opinionuniverse` |
| **Method** | `GET` |
| **Auth** | HMAC-SHA256 in `SIG` query param (optional) |
| **Response Format** | Plain text `1` (success) or `0` (error) |

### Signature Algorithm

```
signature = HMAC-SHA256( TOKEN, transaction_id )
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
| `offername` | string | ❌ | Offer name |
| `eventname` | string | ❌ | Event/survey type |
| `IP` | string | ❌ | User IP |
| `gaid` | string | ❌ | Google Advertising ID |
| `SIG` | string | ❌ | HMAC-SHA256 signature |

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
| `2` | 🚨 Reversal — deduct coins |

### Notes
- Test callbacks containing `{` placeholder characters are automatically detected and skipped with `1` response.
- Missing `TransactionID` triggers auto-generation of a synthetic ID.

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
> **Application Secret:** `3QDAWT60JYHQ2IWZ` (or `PLAYTIME_APP_SECRET` env var)

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `amount` | number | ✅ | Coin reward amount |
| `signature` | string | ✅ | SHA1 signature |
| `offer_id` | string | ❌ | Playtime offer ID |
| `offer_name` | string | ❌ | Game/offer name |
| `task_id` | string | ❌ | Specific task/milestone ID |
| `task_name` | string | ❌ | Task description |

### Playtime Ads Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/playtimeads?user_id={user_id}&offer_id={offer_id}&offer_name={offer_name}&amount={amount}&task_id={task_id}&task_name={task_name}&signature={signature}
```

### Success Response (200)

```json
{
  "status": "success",
  "message": "User rewarded successfully"
}
```

### Notes
- Transaction ID is auto-generated as `PLAYTIME_{md5(user_id+offer_id+task_id+amount+task_name)}` — ensures per-milestone idempotency.
- Both GET and POST are supported.

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
| `type` | string | ❌ | Offer type label |

### Pocketsfull Dashboard Postback URL

```
https://api-rewardverse.satyainfotechnetworks.com/api/webhook/pocketsfull?trans_id={trans_id}&user_id={user_id}&status={status}&amount_local={amount_local}&hash={hash}&offer_id={offer_id}&type={type}
```

### Status Values

| `status` | Action |
|----------|--------|
| `approved` / `completed` / `1` | ✅ Credit user |
| `rejected` / `chargeback` / `2` | 🚨 Deduct coins (reversal) |

### Success Response (200)

```json
{
  "status": "success",
  "message": "User rewarded successfully"
}
```

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
| `status` | number | ✅ | `1` = success (any other value is ignored) |
| `user_payout` | number | ❌ | Base coin reward |
| `bonus_amount` | number | ❌ | Bonus coins (added to `user_payout`) |
| `publisher_payout` | number | ❌ | Publisher revenue |
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
{
  "success": true,
  "message": "Callback received and processed successfully."
}
```

### Notes
- **Total reward** = `user_payout + bonus_amount`.
- Only `status = 1` triggers a credit. All other statuses return `200` but are ignored.

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
| `provider` | string | ❌ | Ad network name |

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
{
  "success": true,
  "message": "Offer recorded"
}
```

### Notes
- Record is saved with status `PENDING_VALIDATION`.
- Admin must manually approve/reject from the admin dashboard under **Proofs**.
- Sends admin Telegram alert `⏳` and a user notification.
- Does **NOT** credit balance until admin approves.

---

## 13. Timewall Postback

Multi-action postback for Timewall offerwall. Handles credits, holds, cancellations, and chargebacks.

| Field | Value |
|-------|-------|
| **Endpoint** | `/api/webhook/timewall` |
| **Method** | `GET` or `POST` |
| **Auth** | SHA256 hash (optional) |

### Signature Algorithm

```
payload = user_id + revenue + TIMEWALL_SECRET
hash = SHA256( payload )
```

> **Secret:** `e1bd718416cbd32f670bd4587a4f3313`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | Rewardverse user identifier |
| `transaction_id` | string | ✅ | Unique transaction ID |
| `type` | string | ✅ | See type table below |
| `reward` | number | ❌ | Coin reward amount |
| `revenue` | number | ❌ | Publisher revenue (used in hash) |
| `hash` | string | ❌ | SHA256 signature |
| `offer_name` | string | ❌ | Offer name |
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
| `hold` | ⏳ Record as `PENDING_VALIDATION` — wait for approval |
| `hold_cancelled` | ❌ Cancel a held transaction |
| `chargeback` | 🚨 Deduct coins (reversal) |

> **Note:** Negative `reward` or `revenue` values also trigger the chargeback flow regardless of `type`.

### Success Response (200)

```json
{
  "status": "success",
  "message": "User rewarded successfully"
}
```

---

## Common Response Patterns

### All Postbacks

| Condition | HTTP | Response |
|-----------|------|----------|
| ✅ Success | `200` | `{"status":"success","message":"..."}` or `OK` or `1` |
| 🔁 Duplicate (idempotent) | `200` | `"Already processed"` |
| ❌ Missing params | `400` | `{"status":"error","message":"Missing required parameters"}` |
| 🔒 Invalid signature | `403` | `{"status":"error","message":"Invalid Signature"}` |
| 👤 User not found | `404` | `{"status":"error","message":"User not found"}` |
| 💥 Server error | `500` | `{"status":"error","message":"..."}` |

---

## Security Features

| Feature | Description |
|---------|-------------|
| **Timing-safe comparison** | All signature checks use `crypto.timingSafeEqual()` to prevent timing attacks |
| **Idempotency** | All postbacks check `offer_completions.completion_id` before crediting |
| **Replay protection** | Offermaru rejects requests older than 5 minutes via `timestamp` param |
| **DB transactions** | All balance + ledger writes are wrapped in atomic MySQL transactions |
| **Referral processing** | All successful completions automatically trigger referral commission calculation |

---

## Admin Notifications

Every successful (or reversed) postback fires:
1. **Telegram Alert** to the admin channel with:
   - 👤 User name + hex ID
   - 🔥 Offer name
   - 📡 Network name + logo
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

# Test Timewall
curl "https://api-rewardverse.satyainfotechnetworks.com/api/webhook/timewall?user_id=USER_UID&transaction_id=TXID001&type=credit&reward=50&offer_name=TestOffer"
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

> All other secrets (PubScale, CPX, GrowDeck, Pocketsfull, Timewall, Opinion Universe, Real Opinion) are **hardcoded constants** in `webhookController.js`.

---

*Documentation generated for Rewardverse Backend v2.5 — SatyaInfoTechNetworks*
