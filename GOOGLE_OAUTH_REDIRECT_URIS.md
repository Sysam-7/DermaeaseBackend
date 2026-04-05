# Fix Google `redirect_uri_mismatch` (Error 400)

This error means **Google does not have the exact same redirect URI** registered for the **same OAuth client** your backend uses.

## 1) See the exact URI your server uses

With the backend running on port **5000**, open in the browser:

**http://localhost:5000/api/auth/google/callback-info**

You will get JSON like:

```json
{
  "redirectUri": "http://localhost:5000/api/auth/google/callback",
  "clientId": "455554315989-....apps.googleusercontent.com"
}
```

Copy **`redirectUri`** character-for-character. Copy **`clientId`** and use it in the next step.

## 2) Google Cloud Console (must match that Client ID)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Under **OAuth 2.0 Client IDs**, click the row whose **Client ID** is **exactly** the same as **`clientId`** from step 1.  
   - It must be type **Web application** (not Android / iOS / Desktop only).
3. Under **Authorized redirect URIs** → **+ ADD URI** → paste **`redirectUri`** from step 1.  
   - **No** trailing slash.  
   - Use **`http://`** not **`https://`** for localhost.  
   - Path must include **`/api`**: `.../api/auth/google/callback` (not `.../auth/google/callback`).
4. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000`
   - `http://localhost:5000`
5. Click **Save**. Wait **2–5 minutes** (Google caches settings).

## 3) Common mistakes

| Mistake | Fix |
|--------|-----|
| Edited the wrong OAuth client | Open the client whose ID matches `callback-info` → `clientId` |
| Only added `http://localhost:5000/auth/google/callback` | Missing `/api` — use full path from `callback-info` |
| Used `https://localhost:...` | Local dev uses `http://` |
| `127.0.0.1` vs `localhost` | Must match **exactly** what `redirectUri` shows (or add a second URI in Console for that host) |
| Trailing slash | Remove it: `.../callback` not `.../callback/` |

## 4) Restart backend

After changing `.env` (`GOOGLE_CALLBACK_URL`), restart the Node server and check the log line:

`🔐 Google OAuth callback URL: ...`

It must match what you put in Google Console.
