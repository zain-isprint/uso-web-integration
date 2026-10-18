# 09. Troubleshooting

> Not an official i-Sprint document. See [DISCLAIMER.md](../DISCLAIMER.md).

## Symptoms

| Symptom | Check |
|---|---|
| `isReady` never answers | The page's address contains `webui`. The USO Chrome extension is installed and enabled (the page has a `ChromeExtM3`, `usoClientExt` or `usoNativeHost` cookie about 1.5 s after loading). USOClient was started after the page loaded: reload the page ([chapter 03](03-sign-in-to-uso.md), step 6). |
| `isReady` answers, but never `true` | USOClient is not signed in: check that `SetSessionId` received a valid WSASID, and that `ServerURL` is the value from `getusoclientproperties`. Invoke `enableWebUI` if it answers `null`. |
| The USO portal popup never closes | The USO portal is not configured to close itself once USOClient is active; use another way to detect completion ([chapter 03](03-sign-in-to-uso.md), option A, step 4). |
| USOClient does not fill the login | The application is assigned to the user in AccessMatrix, and its definition recognises this login page. A forced download ran after your server wrote the login details ([chapter 04](04-sync.md)). In incognito windows, the USO Chrome extension is allowed in incognito. |
| It fills the wrong account | The launch page selected the slot your server returned, after the forced download. With two windows of the same application open, follow the window in front ([chapter 06](06-multiple-accounts.md)). |
| A new profile shows old login details | The new slot was not cleared after `addProfile` ([chapter 04](04-sync.md#adding-a-profile)). |
| USO server calls fail with 401 or 403 | The `XSRF-TOKEN` cookie and the `X-XSRF-TOKEN` header are both sent and match; `Authorization` is the user's current WSASID (not an old token after a refresh). |
| USO server replies do not parse | Skip the anti-hijacking prefix (everything before the first `{` or `[`). |
| USOClient is signed out after about 10 minutes | The session is not being refreshed, or USOClient's own session is not kept alive ([chapter 07](07-keep-alive.md)). |
| Applications switch to the default account by themselves | Something sends `SetSessionId` again; keep USOClient alive with `setProfileActive` instead ([chapter 07](07-keep-alive.md)). |
| The portal window closes at sign-out | Sign USOClient out before closing application windows yourself ([chapter 08](08-sign-out.md)). |
| Other tabs close at sign-out | USOClient's graceful sign-off closes the whole browser window of the application ([chapter 08](08-sign-out.md)). |

## Logs

| Log | Where | Look for |
|---|---|---|
| USOClient | `%APPDATA%\USOClient\log\usoclient.log` (large, UTF-8) | `Received USO_WM_LOGOUTAGENT`, `Signing off application`, `Synchroniz`, `isScreenMatched`, `Http response from server` |
| USO Chrome extension's native host | `%USERPROFILE%\AppData\LocalLow\usoChromeProxy\usoChromeProxy<date>.log` (UTF-16) | The messages passed between the browser and USOClient |
| Your pages | The browser's developer tools (F12), Console | Your own logging around each message and reply |
| Secure Session Launcher | `chrome://extensions` → Secure Session Launcher → "service worker" → Console | Lines starting with `[Session Launcher]` |
