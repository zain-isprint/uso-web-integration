/*!
 * uso-extension-client.js 1.5.0
 * Talks to USOClient from a web page, through the USO Chrome extension (window.postMessage).
 * With the Secure Session Launcher extension, also keeps USOClient on the profile of the application
 * window in front (followLaunchedWindows) and keeps USOClient's session alive (keepAlive).
 *
 * The page's URL must contain "webui" (or "start.uso"), or the USO extension does not relay its
 * messages. Load with a <script> tag (global UsoExtension) or require/import it (CommonJS / AMD).
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UsoExtension = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.5.0';
  var ACTIVE_KEY = 'usoExtension.activeProfiles'; // localStorage: {appId: slot} USOClient last confirmed, shared by the site's pages
  var callbacks = {};   // method -> callback(result, error); one outstanding invoke per method
  var listening = false;

  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener('message', function (event) {
      if (event.source !== window || !event.data || event.data.type !== 4 || event.data.ret == null) return;
      var reply;
      try { reply = JSON.parse(event.data.ret); } catch (e) { return; }
      var cb = callbacks[reply.method];
      if (typeof cb === 'function') cb(reply.result, reply.error);
    });
  }

  function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function readCookie(name) {
    var m = new RegExp('(?:^|;\\s*)' + name + '=([^;]*)').exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* ------------------------------------------------------------------ low level */

  /**
   * Function call (no reply): {type: 0, func, params}.
   * @param {string} func    for example 'SetSessionId'
   * @param {Array}  params  positional parameters
   */
  function call(func, params) {
    window.postMessage({ type: 0, func: func, params: params || [] }, '*');
  }

  /**
   * Invoke with reply: {type: 4, invoke: JSON {method, params}, params: {}}.
   * Resolves {result} on a reply, {timedOut: true} when there is none in time; rejects when USOClient
   * returns an error. Only one invoke per method can be outstanding: a second one replaces the first.
   * @param {string} method
   * @param {object} [params]
   * @param {number} [timeoutMs=3000]
   * @returns {Promise<{result?: *, timedOut?: boolean}>}
   */
  function invoke(method, params, timeoutMs) {
    listen();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (callbacks[method] === done) delete callbacks[method];
        resolve({ timedOut: true });
      }, timeoutMs || 3000);
      function done(result, error) {
        clearTimeout(timer);
        delete callbacks[method];
        if (error != null) reject(new Error(String(error)));
        else resolve({ result: result });
      }
      callbacks[method] = done;
      window.postMessage({ type: 4, invoke: JSON.stringify({ method: method, params: params || {} }), params: {} }, '*');
    });
  }

  /* ------------------------------------------------------------------ detection */

  /** True when the page URL contains "webui" or "start.uso" (pages the USO extension serves). */
  function isServedPage() {
    return /webui|start\.uso/.test(location.href);
  }

  /** True when the USO extension has marked this page (cookies ChromeExtM3, usoClientExt or usoNativeHost). Check ~1.5 s after load. */
  function isExtensionPresent() {
    return /(?:^|;\s*)(ChromeExtM3|usoClientExt|usoNativeHost)=/.test(document.cookie);
  }

  /** USOClient version reported by the extension ('5,6,2,...'), or '' when unknown. */
  function usoClientVersion() {
    return readCookie('usoVersion').replace(/\s/g, '');
  }

  /** True when the extension reports a real USOClient version (not '', '99,9,9,9' or '0,0,0,0'). */
  function isUsoClientInstalled() {
    var v = usoClientVersion();
    return v !== '' && v !== '99,9,9,9' && v !== '0,0,0,0';
  }

  /** Registry key for the agent page: 'AgentURL' from USOClient 5.5.1.0006, 'CLPURL' before. */
  function agentUrlKey() {
    var v = usoClientVersion();
    return !v || v === '99,9,9,9' || v >= '5,5,1,0006' ? 'AgentURL' : 'CLPURL';
  }

  /** The user's AccessMatrix session from the WSASID cookie, or ''. */
  function readSessionCookie() {
    return readCookie('WSASID');
  }

  /* ------------------------------------------------------------------ USOClient messages */

  function startAgent() { return invoke('startAgent', {}); }
  function isReady(timeoutMs) { return invoke('isReady', {}, timeoutMs || 1500); }
  function enableWebUI() { return invoke('enableWebUI', {}); }
  function getAppList(timeoutMs) { return invoke('getAppList', {}, timeoutMs || 4000); }

  /**
   * Selects the profile USOClient fills for an application.
   * @param {string} appId  ESSO application ID
   * @param {number} slot   profile number (1, 2...)
   */
  function setProfileActive(appId, slot, timeoutMs) {
    // One at a time: only one invoke per method can be outstanding (see invoke).
    var run = profileChain.then(function () {
      return invoke('setProfileActive', { appId: appId, profileId: Number(slot) }, timeoutMs || 4000);
    }).then(function (r) {
      if (!r.timedOut) noteActiveProfile(appId, slot);
      return r;
    });
    profileChain = run.catch(function () { /* the caller handles it */ });
    return run;
  }
  var profileChain = Promise.resolve();

  /* ------------------------------------------------------------------ profiles USOClient is on */

  /** The profiles USOClient last confirmed, {appId: slot}, as recorded by any page of this site. */
  function activeProfiles() {
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  function noteActiveProfile(appId, slot) {
    var active = activeProfiles();
    active[appId] = Number(slot);
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(active)); } catch (e) { /* storage blocked: switches are just not skipped */ }
  }

  /** Forget the recorded profiles. USOClient resets every application to its default profile when it signs in. */
  function forgetActiveProfiles() {
    try { localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* ignore */ }
  }

  function usoItemsOf(data) {
    var items = data && Array.isArray(data.uso) ? data.uso : [];
    return items.filter(function (i) { return i && i.appId && i.slot != null; })
      .map(function (i) { return { appId: String(i.appId), slot: Number(i.slot) }; });
  }

  function activateAll(items) {
    return items.reduce(function (chain, item) {
      return chain.then(function (sent) {
        return setProfileActive(item.appId, item.slot).then(function (r) { return sent + (r.timedOut ? 0 : 1); }, function () { return sent; });
      });
    }, Promise.resolve(0));
  }

  /**
   * Keeps USOClient on the profile of the application window in front. Needs the Secure Session Launcher
   * extension; launch each window with data {uso: [{appId, slot}]}. Call once on the portal page, after
   * USOClient is ready.
   * @param {object} launcher  the Secure Session Launcher client (secure-session-launcher.js): on(), subscribe()
   * @returns {Promise} resolves when subscribed; rejects when the extension is missing or the site not approved
   */
  function followLaunchedWindows(launcher) {
    launcher.on('window.focused', function (event) {
      var active = activeProfiles();
      var needed = usoItemsOf(event.data).filter(function (i) { return active[i.appId] !== i.slot; });
      if (!needed.length) return; // USOClient is already on this window's profile(s)
      activateAll(needed).then(function (sent) {
        if (sent < needed.length && typeof console !== 'undefined') console.warn('USOClient did not confirm every profile switch for', event.app || event.window);
      });
    });
    return launcher.subscribe(['window.focused']);
  }

  /**
   * Keeps USOClient's own session alive: re-sends setProfileActive for the profile USOClient should be on
   * (USOClient renews its session on every setProfileActive). That is the application window in front,
   * else the one in front most recently, else the profile last recorded. Call each time the portal renews
   * the AccessMatrix session. Never sends SetSessionId (that makes USOClient sign in again).
   * @param {object} [launcher]  the Secure Session Launcher client; without it, the recorded profile is used
   * @returns {Promise<{sent: number}>} sent is 0 when no profile is known yet
   */
  function keepAlive(launcher) {
    var fromLauncher = launcher && launcher.windowInFront
      ? launcher.windowInFront().then(function (r) { return usoItemsOf((r.front || r.last || {}).data); }, function () { return []; })
      : Promise.resolve([]);
    return fromLauncher.then(function (items) {
      if (!items.length) {
        var active = activeProfiles();
        items = Object.keys(active).slice(0, 1).map(function (appId) { return { appId: appId, slot: active[appId] }; });
      }
      return activateAll(items).then(function (sent) { return { sent: sent }; });
    });
  }

  function setRegistryValue(name, value) { call('SetUsoRegistryValue', [name, value]); }
  function setSessionId(wsasid) { call('SetSessionId', [wsasid]); }
  function synchronizeAppList() { call('SynchronizeAppList', []); }

  /** Sets ServerURL, the agent page (AgentURL/CLPURL) and the session, in that order (as the USO portal does). */
  function signIn(options) {
    if (options.serverUrl) setRegistryValue('ServerURL', options.serverUrl);
    if (options.agentUrl) setRegistryValue(agentUrlKey(), options.agentUrl);
    setSessionId(options.session);
  }

  /**
   * Polls isReady until it returns true.
   * @param {object} [options]
   * @param {number} [options.tries=40]       attempts (about 30 s with the defaults)
   * @param {number} [options.intervalMs=500] pause between attempts
   * @param {function} [options.onWaiting]    called after each unsuccessful attempt with the attempt number
   * @returns {Promise<boolean>} true when ready, false when it never was
   */
  function waitUntilReady(options) {
    options = options || {};
    var tries = options.tries || 40, interval = options.intervalMs || 500, nulls = 0, attempt = 0;
    function next() {
      attempt++;
      return isReady(1500).then(function (r) {
        if (!r.timedOut && r.result === true) return true;
        if (!r.timedOut && r.result == null && ++nulls === 2) enableWebUI(); // as the USO portal does
        if (options.onWaiting) options.onWaiting(attempt);
        if (attempt >= tries) return false;
        return delay(interval).then(next);
      }, function () {
        if (attempt >= tries) return false;
        return delay(interval).then(next);
      });
    }
    return next();
  }

  /**
   * Forces USOClient to download applications and profiles from the USO server: sets a placeholder
   * ListOfAppIDForSynchronization, sends SynchronizeAppList, waits, then sets the real list.
   * USOClient only downloads when the list differs from its own, hence the placeholder.
   * @param {string[]} appIds              the user's application IDs (from the server)
   * @param {object}   [options]
   * @param {number}   [options.waitMs=1500]  pause before restoring the real list
   * @param {boolean}  [options.confirm=true] then invoke getAppList and wait for its reply
   * @returns {Promise<void>} rejects when confirm is on and getAppList does not answer
   */
  function forceSync(appIds, options) {
    options = options || {};
    setRegistryValue('ListOfAppIDForSynchronization', options.placeholder || 'USO-RESYNC,');
    synchronizeAppList();
    return delay(options.waitMs == null ? 1500 : options.waitMs).then(function () {
      if (appIds && appIds.length) setRegistryValue('ListOfAppIDForSynchronization', appIds.join(',') + ',');
      if (options.confirm === false) return;
      return getAppList(4000).then(function (r) {
        if (r.timedOut) throw new Error('USOClient did not reply to getAppList after synchronization.');
      });
    });
  }

  /**
   * Starts USOClient and signs it in, then forces the first download. For the page users land on after
   * signing in (the portal page).
   * @param {object} options
   * @param {string} options.serverUrl   from the server (UsoServerClient.usoClientServerUrl)
   * @param {string} options.agentUrl    USO portal start.uso URL
   * @param {string[]} options.appIds    from the server (UsoServerClient.applicationIds)
   * @param {string} [options.session]   WSASID; read from the cookie when omitted
   * @param {number} [options.syncWaitMs=6000]
   * @param {object} [options.reload]    {afterMs: 6000, max: 3, storageKey: 'uso.reloads'}: reload the page when
   *                                     USOClient does not answer, because the extension only reaches a newly
   *                                     started USOClient from a page loaded after it started. false to disable.
   * @param {function} [options.onStatus] progress callback(text)
   * @returns {Promise<void>} resolves when USOClient is ready and synchronized
   */
  function startUsoClient(options) {
    var status = options.onStatus || function () {};
    var session = options.session || readSessionCookie();
    if (!session) return Promise.reject(new Error('No AccessMatrix session (WSASID cookie).'));
    var reload = options.reload === false ? null : Object.assign({ afterMs: 6000, max: 3, storageKey: 'uso.reloads' }, options.reload || {});
    var reloads = 0;
    if (reload) { try { reloads = Number(sessionStorage.getItem(reload.storageKey)) || 0; } catch (e) { reloads = reload.max; } }
    var ready = false;
    if (reload && reloads < reload.max) {
      setTimeout(function () {
        if (ready) return;
        try { sessionStorage.setItem(reload.storageKey, String(reloads + 1)); } catch (e) { return; }
        location.reload();
      }, reload.afterMs);
    }
    status(reloads ? 'Connecting to USOClient...' : 'Starting USOClient...');
    startAgent();
    signIn({ serverUrl: options.serverUrl, agentUrl: options.agentUrl, session: session });
    return waitUntilReady().then(function (ok) {
      if (!ok) throw new Error('USOClient did not report that it is ready.');
      ready = true;
      forgetActiveProfiles(); // USOClient has just signed in: every application is on its default profile
      if (reload) { try { sessionStorage.setItem(reload.storageKey, '0'); } catch (e) { /* ignore */ } }
      signIn({ serverUrl: options.serverUrl, agentUrl: options.agentUrl, session: session });
      status('Synchronizing applications...');
      return forceSync(options.appIds, { waitMs: options.syncWaitMs == null ? 6000 : options.syncWaitMs, confirm: false });
    }).then(function () { status(''); });
  }

  /**
   * Brings USOClient up to date for a launch and selects the profile(s). For the launch page, after the
   * server has written the login details.
   * @param {object} launch
   * @param {Array<{appId: string, slot: number}>} launch.items
   * @param {string[]} launch.appIds
   * @param {function} [onStatus]
   * @returns {Promise<void>}
   */
  function prepareLaunch(launch, onStatus) {
    var status = onStatus || function () {};
    var items = launch.items || [];
    if (!items.length) return Promise.resolve();
    return waitUntilReady({ tries: 20 }).then(function (ok) {
      if (!ok) throw new Error('USOClient did not become ready.');
      status('Updating USOClient...');
      return forceSync(launch.appIds, { waitMs: 1500, confirm: true });
    }).then(function () {
      return items.reduce(function (chain, item) {
        return chain.then(function () {
          status('Selecting profile ' + (item.profileName || item.slot) + '...');
          return setProfileActive(item.appId, item.slot).then(function (r) {
            if (r.timedOut) throw new Error('USOClient did not acknowledge profile ' + item.slot + ' of ' + item.appId + '.');
          });
        });
      }, Promise.resolve());
    });
  }

  /**
   * Signs USOClient out and closes it (Logout + QuitUso), then waits for the extension to pass them on.
   * @param {number} [waitMs=400]
   */
  function logout(waitMs) {
    call('Logout', []);
    call('QuitUso', []);
    return delay(waitMs == null ? 400 : waitMs);
  }

  return {
    VERSION: VERSION,
    // low level
    call: call, invoke: invoke,
    // detection
    isServedPage: isServedPage, isExtensionPresent: isExtensionPresent, usoClientVersion: usoClientVersion,
    isUsoClientInstalled: isUsoClientInstalled, agentUrlKey: agentUrlKey, readSessionCookie: readSessionCookie,
    // USOClient messages
    startAgent: startAgent, isReady: isReady, enableWebUI: enableWebUI, getAppList: getAppList,
    setProfileActive: setProfileActive, setRegistryValue: setRegistryValue, setSessionId: setSessionId,
    synchronizeAppList: synchronizeAppList, signIn: signIn,
    // flows
    waitUntilReady: waitUntilReady, forceSync: forceSync, startUsoClient: startUsoClient,
    prepareLaunch: prepareLaunch, logout: logout,
    // with the Secure Session Launcher extension
    followLaunchedWindows: followLaunchedWindows, keepAlive: keepAlive,
    activeProfiles: activeProfiles, forgetActiveProfiles: forgetActiveProfiles
  };
}));
