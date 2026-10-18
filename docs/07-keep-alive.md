# 07. Keeping the session alive

> Not an official i-Sprint document. See [DISCLAIMER.md](../DISCLAIMER.md).

AccessMatrix ends a session after a period without activity (**Session Idle Time**, 600 seconds by default) and
in any case after a maximum time (**Session Lifetime**, for example 8 hours). Both are AccessMatrix settings.
Two holders use the user's session, and both must keep it alive:

| Holder | How it stays alive |
|---|---|
| **Your server** (its copy of the WSASID, and the cookie) | It refreshes the session (part 1) |
| **USOClient** | It renews its own session each time it receives `setProfileActive` (part 2) |

## 1. Your server: refresh the session

Ordinary REST calls do **not** reset the idle time. Only a session refresh does:

```
POST https://am.example.com/am5/rest/authn/session/refresh
Content-Type: application/json

{ "sessionToken": "<WSASID>" }
```

```json
{ "result": { "sessionToken": "<new WSASID>", ... } }
```

- The reply is a **new token** for the same session. Switch to it straight away: store it in your server's
  session and send it to the browser as the new `WSASID` cookie (same name, path and domain as before).
- The old token keeps its own idle clock. **Using an old token after it has expired ends the whole session**, so
  never keep using it.
- A reply with `fault` (for example code `4003`) means the session has ended: ask the user to sign in again.

**How often.** Read the idle time once:

```
POST https://am.example.com/am5/rest/authn/session/verify     { "sessionToken": "<WSASID>" }
→ { "result": { "idleTimeOutInSecs": 600, "expiresAt": ..., ... } }
```

Refresh at about **40% of the idle time** (240 seconds for 600), while the user has your portal open. Then a missed
refresh still leaves time for the next one. If a refresh fails for another reason (network, server busy), retry
every 30 seconds for as long as the idle time since the last success has not passed.

Drive the timer from your portal page (it knows the portal is open), and do the refresh on your server (it holds
the token):

```js
function scheduleRefresh(ms) {
  setTimeout(function () {
    fetch('/api/session/refresh', { method: 'POST', credentials: 'same-origin' })   // your server refreshes
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (r.ended) { showSignInAgain(); return; }
        keepUsoClientAlive();              // part 2
        scheduleRefresh(r.intervalMs);     // e.g. 40% of idleTimeOutInSecs
      })
      .catch(function () { scheduleRefresh(30000); });
  }, ms);
}
```

## 2. USOClient: keep its own session alive

USOClient checks its session with the server regularly (about every 5 minutes) and signs itself out when the
session has expired. It renews its session each time it receives `setProfileActive`. So, at each refresh, send
`setProfileActive` again for **the profile it should already be on**:

- the profile of the application window in front, or the one in front most recently (with Secure Session
  Launcher: `windows.front`);
- otherwise the profile you selected last;
- if nothing was launched yet, any profile of one of the user's applications (for example slot 1 of the first
  one): with no application window open, this has no visible effect.

```js
function keepUsoClientAlive() {
  // With the optional library and Secure Session Launcher:
  return UsoExtension.keepAlive(SessionLauncher).then(function (r) {
    if (r.sent === 0 && appIds.length) return UsoExtension.setProfileActive(appIds[0], 1);
  });
}
```

> **Do not send `SetSessionId` with the new token.** It makes USOClient sign in again, which resets every
> application to its default profile, so windows switch account unexpectedly. `setProfileActive` keeps USOClient's
> session alive without signing it in again.

## In the ARCS example

ARCS's setting "Session refresh interval" defaults to Auto (40% of the idle time). The ARCS portal page runs the
timer; the ARCS server calls `authn/session/refresh`, stores the new token and sends the new `WSASID` cookie; the
portal page then re-sends `setProfileActive` for the profile of the window in front.
