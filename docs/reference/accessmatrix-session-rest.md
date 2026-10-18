# Reference: AccessMatrix session REST

> Not an official i-Sprint document. See [DISCLAIMER.md](../../DISCLAIMER.md).

Only the two calls this guide needs, to keep an existing session alive. How the session is created (signing in
to AccessMatrix) is outside this guide.

Base address: `https://am.example.com/am5/rest`. Requests are `POST` with `Content-Type: application/json` and
`Accept: application/json`. Replies are `{ "result": ... }` on success, or `{ "fault": { "code": "...",
"message": "..." } }`.

## `POST /authn/session/verify`

```json
request:  { "sessionToken": "<WSASID>" }
response: { "result": { "idleTimeOutInSecs": 600, "expiresAt": ..., ... } }
```

Checks the session. `idleTimeOutInSecs` is the session idle time, from which you choose the refresh interval
([chapter 07](../07-keep-alive.md)).

## `POST /authn/session/refresh`

```json
request:  { "sessionToken": "<WSASID>" }
response: { "result": { "sessionToken": "<new WSASID>", ... } }
```

Resets the session's idle time and returns a **new token** for the same session. Use the new token from then
on, everywhere: your server's copy and the `WSASID` cookie. The old token expires on its own, and using it after
that ends the session. A `fault` reply (for example code `4003`) means the session has ended.
