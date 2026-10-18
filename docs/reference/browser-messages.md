# Reference: browser messages to USOClient

> Not an official i-Sprint document. See [DISCLAIMER.md](../../DISCLAIMER.md).

Sent by your page with `window.postMessage(message, '*')`. The page's address must contain `webui` (or
`start.uso`); the USO Chrome extension passes the messages to USOClient.

## Format

| Kind | Message | Reply |
|---|---|---|
| Function | `{ type: 0, func: "<name>", params: [ ...values ] }` | None |
| Invoke | `{ type: 4, invoke: JSON.stringify({ method: "<name>", params: { ... } }), params: {} }` | `message` event with `{ type: 4, ret: "<JSON: { method, result, error }>" }` |

Replies name only the method: keep at most one invoke per method waiting, and use a time limit. No reply within
the limit usually means the extension or USOClient is not reachable from this page.

## Functions (no reply)

| Function | `params` | Used for |
|---|---|---|
| `SetUsoRegistryValue` | `["ServerURL", <url>]` | USOClient's server: the `value` of `getusoclientproperties` ([chapter 03](../03-sign-in-to-uso.md)) |
| `SetUsoRegistryValue` | `["AgentURL", <url>]` | The USO portal page, e.g. `https://am.example.com/usoserver/start.uso`. USOClient older than 5.5.1.0006: `"CLPURL"` |
| `SetUsoRegistryValue` | `["ListOfAppIDForSynchronization", "<id>,<id>,"]` | The applications to download; a different list forces a download ([chapter 04](../04-sync.md)) |
| `SetSessionId` | `[<WSASID>]` | Signs USOClient in with the AccessMatrix session. **At start-up only** ([chapter 07](../07-keep-alive.md)) |
| `SynchronizeAppList` | `[]` | Downloads applications and profiles, if the list changed |
| `Logout` | `[]` | Signs USOClient out (signs off its applications first) |
| `QuitUso` | `[]` | Closes USOClient |

## Invokes (with reply)

| Method | `params` | `result` | Used for |
|---|---|---|---|
| `startAgent` | `{}` | Not used | Starts USOClient if it is not running |
| `isReady` | `{}` | `true` when signed in and ready; `null` while it does not yet accept the page | Waiting for USOClient ([chapter 03](../03-sign-in-to-uso.md)) |
| `enableWebUI` | `{}` | Not used | After two `null` answers from `isReady` |
| `getAppList` | `{}` | The application list | Confirming that a download was processed ([chapter 04](../04-sync.md)) |
| `setProfileActive` | `{ appId: "<id>", profileId: <slot number> }` | Not used | Selecting the profile USOClient fills; also renews USOClient's session ([chapter 05](../05-launch-with-credentials.md), [07](../07-keep-alive.md)) |

## Cookies the USO Chrome extension sets on the page

| Cookie | Meaning |
|---|---|
| `ChromeExtM3`, `usoClientExt`, `usoNativeHost` | The extension is present on this page (check about 1.5 s after loading) |
| `usoVersion` | USOClient's version, e.g. `5,6,2,40`; `99,9,9,9` or `0,0,0,0` when unknown or not installed |
