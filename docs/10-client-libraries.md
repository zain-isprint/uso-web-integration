# 10. Optional: client libraries

> Not an official i-Sprint document. See [DISCLAIMER.md](../DISCLAIMER.md).

Everything in this guide can be done with the raw messages and REST calls shown in the chapters. The libraries
below only save typing.

## JavaScript: `uso-extension-client.js` (browser)

File: [`lib/uso-extension-client.js`](../lib/uso-extension-client.js), version 1.5.0. Load it with a `<script>`
tag (global `UsoExtension`), or with `require` / AMD. Use it on pages whose address contains `webui`.

### Flows

| Function | Does | Chapter |
|---|---|---|
| `startUsoClient({ serverUrl, agentUrl, appIds, session, syncWaitMs, reload, onStatus })` | `startAgent`, settings and session, waits for `isReady` (with `enableWebUI`), reloads the page if USOClient started late, signs in again, forces a download. Resolves when ready. | [03](03-sign-in-to-uso.md) |
| `forceSync(appIds, { waitMs = 1500, confirm = true })` | Forced download; with `confirm`, waits for `getAppList` | [04](04-sync.md) |
| `prepareLaunch({ items, appIds }, onStatus)` | Waits until ready, forces a download with confirmation, selects each profile | [05](05-launch-with-credentials.md) |
| `followLaunchedWindows(launcher)` | With Secure Session Launcher: selects the profile of the window in front | [06](06-multiple-accounts.md) |
| `keepAlive(launcher)` | Re-sends `setProfileActive` for the window in front, or the profile last selected. Resolves `{ sent }`. | [07](07-keep-alive.md) |
| `logout(waitMs = 400)` | `Logout`, `QuitUso`, then waits | [08](08-sign-out.md) |

### Messages

| Function | Message |
|---|---|
| `startAgent()`, `isReady(timeoutMs)`, `enableWebUI()`, `getAppList(timeoutMs)` | The invokes of the same name |
| `setProfileActive(appId, slot, timeoutMs)` | `setProfileActive`. Calls run one at a time; confirmed profiles are recorded per site (`activeProfiles()`), and forgotten when `startUsoClient` signs USOClient in (`forgetActiveProfiles()`) |
| `setRegistryValue(name, value)`, `setSessionId(wsasid)`, `synchronizeAppList()` | The functions `SetUsoRegistryValue`, `SetSessionId`, `SynchronizeAppList` |
| `signIn({ serverUrl, agentUrl, session })` | `ServerURL`, `AgentURL` (or `CLPURL`), `SetSessionId` |
| `waitUntilReady({ tries = 40, intervalMs = 500, onWaiting })` | Polls `isReady`; resolves `true` or `false` |
| `call(func, params)`, `invoke(method, params, timeoutMs)` | Any function or invoke |

### Helpers

| Function | Returns |
|---|---|
| `isServedPage()` | `true` when the page's address contains `webui` or `start.uso` |
| `isExtensionPresent()` | `true` when the USO Chrome extension has marked the page (check about 1.5 s after loading) |
| `usoClientVersion()`, `isUsoClientInstalled()` | USOClient's version as reported by the extension, and whether it is installed |
| `agentUrlKey()` | `'AgentURL'`, or `'CLPURL'` for USOClient older than 5.5.1.0006 |
| `readSessionCookie()` | The `WSASID` cookie, or `''` |

### Example: a portal page

```html
<script src="uso-extension-client.js"></script>
<script>
  getSettingsFromYourServer().then(function (s) {          // { serverUrl, agentUrl, appIds }
    return UsoExtension.startUsoClient({
      serverUrl: s.serverUrl, agentUrl: s.agentUrl, appIds: s.appIds,
      onStatus: function (text) { document.getElementById('status').textContent = text; }
    });
  }).then(enableLaunchButtons, function (e) { showError(e.message); });
</script>
```

## Java: `uso-integration-client` (server)

i-Sprint also has a server-side Java library for the USO server calls: profile provisioning at launch (finding or
creating the slot, clearing it, writing the login details, making it the default), keeping profiles in line with
entitlements, USOClient's settings, session refresh and launch tickets. It is not part of this repository; ask
i-Sprint if you would like to use it. Every call it makes is described in the [USO server REST
reference](reference/uso-server-rest.md), so it can be reproduced in any language.
