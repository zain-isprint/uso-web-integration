# 02. Prerequisites

> Not an official i-Sprint document. See [DISCLAIMER.md](../DISCLAIMER.md).

## Versions

The integration in this guide was tested with:

| Product | Version |
|---|---|
| USOClient | 5.6.2.0040GA-E38 or later |
| USO Chrome extension (Manifest V3) | 5.7.1.13 or later |
| AccessMatrix, with its USO server | 6.0.2.0224-GA-E02 |
| Browser | Google Chrome |

Older versions may need different settings; for example, USOClient before 5.5.1.0006 uses the registry value
`CLPURL` where later versions use `AgentURL` (chapter 03).

## On each user's PC

- **USOClient** installed. It does not need to be running: your page can start it (chapter 03).
- **USO Chrome extension** installed and enabled in Chrome.

## In AccessMatrix

- **Sign-in (CLP or AMG)** configured for the authentication methods you want: standard password, IWA,
  SAML, OIDC, external authentication and so on. This is configured in AccessMatrix and is not covered here.
  This guide starts after the user has signed in.
- **The applications** USOClient fills (ESSO applications) defined, and assigned to the users who may use
  them.
- **The USO portal** (`https://am.example.com/usoserver/start.uso`) reachable from the users' browsers.

## The AccessMatrix session (WSASID)

Everything in this guide uses the user's **AccessMatrix session token**, called the **WSASID**. However the
user signed in, the result is a session token, normally held by the browser as the `WSASID` cookie.

| Who needs it | Why |
|---|---|
| USOClient | It is signed in with this token (`SetSessionId`, chapter 03), so the user signs in only once |
| Your server | It calls the USO server as the user (header `Authorization: <WSASID>`) to write login details (chapter 05), and refreshes the session (chapter 07) |
| The USO portal | Finds the `WSASID` cookie and signs the user on without asking again |

Things to get right:

- **Cookie domain.** For the USO portal to find the session, and for your portal page to read it, the
  `WSASID` cookie must be set for a domain that covers them, for example `.example.com` when AccessMatrix is
  at `am.example.com` and your portal at `portal.example.com`. Set this in AccessMatrix's cookie settings.
- **Readable by your page (no-popup mode only).** In the no-popup mode (chapter 03, option B) your page passes
  the token to USOClient, so the page must be able to read it: the cookie must not be `HttpOnly`, or your
  server must give the token to the page another way.
- **One session, two holders.** Your server and USOClient use the same session. When your server refreshes it
  (chapter 07), it gets a new token and must update its own copy and the cookie.

## Your portal pages

- **Address contains `webui`.** The USO Chrome extension relays messages only from pages whose address
  contains `webui` (or `start.uso`). Open the pages that talk to USOClient as, for example,
  `https://portal.example.com/portal?webui` and `https://portal.example.com/launch?webui`.
- **Pop-ups allowed** for your portal, if you use the popup mode (chapter 03, option A) or open applications
  in new windows.

## Your server

- Can reach the USO server over HTTPS (`https://am.example.com/usoserver`).
- Can keep a session per user (to hold the user's WSASID).
- Can make HTTP calls with cookies (the USO server uses an `XSRF-TOKEN` cookie, chapter 05).

No i-Sprint library is required. The [client libraries](../README.md#chapters) are optional helpers.
