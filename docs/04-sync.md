# 04. Keeping USOClient up to date

> Not an official i-Sprint document. See [DISCLAIMER.md](../DISCLAIMER.md).

USOClient keeps its own copy of the user's applications, profiles and login details, downloaded from the USO
server. Two things keep that copy right:

1. **Forcing a download** from the browser, whenever the USO server has changed (after sign-in, and at each
   launch).
2. **Keeping the user's profiles in line with what your application entitles them to**, on the USO server,
   from your server.

## 1. Forcing an application download (browser)

USOClient downloads its applications when asked with `SynchronizeAppList`, but **only if the list of
application IDs it is given differs from the one it already has**. To force a download, give it a different
list first, then the real one:

```js
function forceDownload(appIds, waitMs) {
  // 1. A list that cannot match: USOClient sees a change and downloads
  usoCall('SetUsoRegistryValue', ['ListOfAppIDForSynchronization', 'RESYNC-PLACEHOLDER,']);
  usoCall('SynchronizeAppList', []);
  // 2. After a short wait, the real list (comma-separated, with a trailing comma)
  return new Promise(function (resolve) {
    setTimeout(function () {
      usoCall('SetUsoRegistryValue', ['ListOfAppIDForSynchronization', appIds.join(',') + ',']);
      resolve();
    }, waitMs);
  });
}
```

| When | Wait (`waitMs`) | Confirm |
|---|---|---|
| Right after USOClient is ready ([chapter 03](03-sign-in-to-uso.md)) | About 6 s, as USOClient may still be starting | Not needed |
| On the launch page, after your server wrote login details ([chapter 05](05-launch-with-credentials.md)) | About 1.5 s | Invoke `getAppList` and wait for its reply (up to 4 s) before selecting the profile |

`appIds` are the user's application IDs, from the USO server (`getapplist`, [chapter 03](03-sign-in-to-uso.md),
step 3). `usoCall` and `usoInvoke` are the helpers from chapter 03.

> **Required:** after USOClient starts, do one forced download before the first profile change
> (`setProfileActive`). Enable your launch buttons only after it.

With the optional library: `UsoExtension.forceSync(appIds, { waitMs: 1500, confirm: true })`.

## 2. Profiles in line with entitlements (server)

A **profile** is one set of login details for one application: one account. A user can have several profiles
per application, numbered from 1 (the **slot**), each with a name. If your application decides which accounts
a user may use (its entitlements), keep the user's USO profiles the same:

- **add** a profile for each account the user is entitled to, named after it (for example your account ID);
- **remove** profiles for accounts the user is no longer entitled to.

Do this when the user signs in, and whenever entitlements change. USOClient shows the change after its next
download (part 1).

### Reading the profiles

```
GET /usoserver/rest/asaservice/getuserappattr?appId=CRM
```

```json
{ "%multiple.profile": "2", "%profilename.1": "ID1", "%profilename.2": "ID2", "%lastprofile": "1" }
```

| Attribute | Meaning |
|---|---|
| `%multiple.profile` | Number of profiles. **Missing means one profile.** |
| `%profilename.N` | Name of profile N |
| `%lastprofile` | The default (active) profile |
| Other `….N` entries | Per-profile values; keep them with their profile |

### Adding a profile

1. If the user has **one profile still named `Profile 1`** (the default), rename it instead of adding:
   `POST /usoserver/rest/essoservice/renameProfile` `{"appId": "CRM", "profileId": "1", "profileName": "ID3"}`.
2. Otherwise add it at slot = count + 1:
   `POST /usoserver/rest/essoservice/addProfile` `{"appId": "CRM", "profileId": "3", "profileCount": "3", "profileName": "ID3"}`.
3. **Clear its login details.** The USO server keeps the login details of a slot that was deleted earlier, so a
   new profile in that slot would show them. Write empty values:
   `POST /usoserver/rest/essoservice/resetAppInfo`
   `{"appId": "CRM", "attributes": {}, "profileId": "3", "password": "", "userId": ""}`.

An empty profile is fine: your server writes the real login details at launch ([chapter 05](05-launch-with-credentials.md)).

### Removing a profile

```
POST /usoserver/rest/essoservice/deleteProfile
{ "appId": "CRM", "attributes": { …the attribute set as it should be after the delete… } }
```

The call takes the whole attribute set **after** the delete:

- leave out the deleted slot's numbered entries;
- move every numbered entry above it down by one (`%profilename.3` becomes `%profilename.2`);
- lower `%multiple.profile` by one;
- adjust `%lastprofile`: the deleted slot becomes `1`, higher slots move down by one.

**It renumbers the names only, not the login details.** Before deleting, read the login details of every slot
above the deleted one (`GET /usoserver/rest/asaservice/getappinfo?appId=CRM&profileId=N`, which returns
`userId`, `password` and `attributes`). After the delete, write each one back one slot lower with
`resetAppInfo`, then clear the top slot.

Rules: delete the highest unwanted slot first, read the profiles again before each delete, and never delete
the last profile (a user always keeps one).

### Assigning the application itself

The user must also be assigned the application (the ESSO application) in AccessMatrix, or the USO server has
no profiles for it. This is administration in AccessMatrix (by an administrator, or your provisioning
process) and is not covered here.

## In the ARCS example

ARCS keeps every user's profiles in line with their ARCS entitlements when they sign in, and for all users
from its admin page ("Sync entitlements"). Profiles are named after ARCS profile IDs (`ID1`, `ID2`,
`isprint001`…), which is what the portal shows on each application button.
