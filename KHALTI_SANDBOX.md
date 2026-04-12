# Khalti sandbox (ePayment)

## Environment

- `KHALTI_SECRET_KEY` — **Live secret key** from [test-admin.khalti.com](https://test-admin.khalti.com) (sandbox).
- `KHALTI_BASE_URL=https://dev.khalti.com/api/v2`
- `KHALTI_RETURN_URL` — Must match `return_url` sent to Khalti (default: `http://localhost:3000/patient/payment/khalti/return`).
- `APPOINTMENT_FEE_PAISA` — Amount in **paisa** (e.g. `50000` = NPR 500). Minimum **1000** paisa (NPR 10).

## Merchant / redirect whitelist

In the Khalti **test** merchant dashboard, add your **website URL** and **return URL** if the dashboard asks for allowed domains/URLs (same as `FRONTEND_URL` and `KHALTI_RETURN_URL`).

## Test flow

1. Doctor confirms appointment → patient opens **Pay Now** → **Pay with Khalti**.
2. Server calls `POST /epayment/initiate/` → browser redirects to Khalti `payment_url`.
3. Sandbox: use test phone numbers (e.g. `9800000001`) and MPIN **1111**, OTP **987654** (see Khalti docs).
4. After payment, Khalti redirects to `KHALTI_RETURN_URL` with `pidx` query param.
5. App calls `POST /api/payments/khalti/verify` → Khalti **lookup** → on `Completed`, appointment is marked paid and doctor receives an in-app notification.

## Authorization header

Server sends: `Authorization: Key <KHALTI_SECRET_KEY>` (per Khalti docs).
