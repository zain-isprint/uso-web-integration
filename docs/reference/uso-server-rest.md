# Reference: USO server REST

> Not an official i-Sprint document. See [DISCLAIMER.md](../../DISCLAIMER.md).

Called **from your server**, as the user. Base address: `https://am.example.com/usoserver`.

## Conventions

1. **Start a session:** `GET /usoserver/` once. Keep the `XSRF-TOKEN` cookie it sets.
2. **Every call** sends:
   - `Authorization: <WSASID>` (the user's current AccessMatrix session token);
   - `X-XSRF-TOKEN: <XSRF-TOKEN value>`, and the `XSRF-TOKEN` cookie itself;
   - `Content-Type: application/json` for `POST`.
3. **Replies** start with an anti-hijacking prefix such as `)]}',`. Skip everything before the first `{` or `[`,
   then parse the JSON.
4. **Errors:** a status other than 2xx, or a `fault` object in the reply.

## USOClient settings

### `POST /rest/asaservice/getusoclientproperties`

```json
request:  { "id": "getusoclientproperties" }
response: { "value": "https://am.example.com/am5/start.uso?reqid=usoclientrequest.uso&" }
```

`value` is USOClient's `ServerURL` ([chapter 03](../03-sign-in-to-uso.md)).

### `POST /rest/asaservice/getapplist`

```json
request:  {}
response: { "applist": [ { "appId": "CRM", "appType": "S", ... }, { "appId": "HR", "appType": "G", ... } ] }
```

The user's applications. Use the `appId` of entries whose `appType` is `S` or `G`.

## Profiles

### `GET /rest/asaservice/getuserappattr?appId=<appId>`

```json
{ "%multiple.profile": "2", "%profilename.1": "ID1", "%profilename.2": "ID2", "%lastprofile": "1" }
```

The user's attribute set for the application. No `%multiple.profile` means one profile. See
[chapter 04](../04-sync.md#reading-the-profiles).

### `POST /rest/essoservice/renameProfile`

```json
{ "appId": "CRM", "profileId": "1", "profileName": "ID1" }
```

### `POST /rest/essoservice/addProfile`

```json
{ "appId": "CRM", "profileId": "3", "profileCount": "3", "profileName": "ID3" }
```

`profileId` and `profileCount` are the new slot: the current count + 1.

### `POST /rest/essoservice/deleteProfile`

```json
{ "appId": "CRM", "attributes": { "%multiple.profile": "1", "%profilename.1": "ID1", "%lastprofile": "1" } }
```

`attributes` is the whole attribute set **as it should be after the delete**. The call does not move login
details; see [chapter 04](../04-sync.md#removing-a-profile).

### `POST /rest/essoservice/setProfileActive`

```json
{ "appId": "CRM", "profileId": "3" }
```

Makes the profile the default (server side). In the browser, also send USOClient `setProfileActive`
([browser messages](browser-messages.md)).

## Login details

### `GET /rest/asaservice/getappinfo?appId=<appId>&profileId=<slot>`

```json
{ "userId": "jsmith", "password": "...", "attributes": { ... } }
```

The login details of one profile.

### `POST /rest/essoservice/resetAppInfo`

```json
{ "appId": "CRM", "attributes": { ... }, "profileId": "3", "userId": "jsmith", "password": "<password>" }
```

Writes the login details of one profile. Keep `attributes` from `getappinfo`. To clear a profile, send empty
`userId`, `password` and `attributes`.
