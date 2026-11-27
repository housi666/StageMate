/*! StageMate v0.6.12 · Build 91 · 2026-11-27 */
/* StageMate – Datenschicht
 * ------------------------------------------------------------
 * Die einzige Stelle, die weiss, WO die Daten liegen.
 * Die App spricht nur mit window.StagemateData und bekommt immer
 * dieselbe Schnittstelle, egal welches Backend darunter läuft:
 *
 *   db.doc('pfad/id')            -> { id, path, get(), set(daten), delete() }
 *   db.collection('pfad')        -> { doc(id?), where(feld, op, wert), limit(n), get() }
 *   snapshot                     -> { id, exists, data() }
 *   query-Ergebnis               -> { docs:[snapshot], size, empty }
 *
 * Backends:
 *   'claude'   – Datenbank der Claude-Laufzeit (window.claude.use('db'))
 *   'local'    – Testmodus im Browser (localStorage)
 *   'firebase' – Google Firebase (Firestore + Anmeldung mit E-Mail/Passwort).
 *                Aktiv, sobald js/firebase-config.js und das Firebase-SDK geladen sind
 *                (Web-Version, z.B. auf GitHub Pages). In der Claude-Ansicht nicht verfügbar.
 */
(function () {
  'use strict';

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const hasClaude = () => !!(window.claude && typeof window.claude.use === 'function');
  const claudeUse = async name => hasClaude() ? window.claude.use(name) : null;

  // ================= Backend: lokal (Testmodus) =================
  function makeLocalDb() {
    const KEY = 'bandLocalDb';
    const load = () => { try { return JSON.parse(ls.get(KEY) || '{}'); } catch (e) { return {}; } };
    const save = o => ls.set(KEY, JSON.stringify(o));
    const snap = (path, data) => ({ id: path.split('/').pop(), exists: data !== undefined, data: () => data === undefined ? undefined : clone(data) });
    const docRef = path => ({
      id: path.split('/').pop(), path,
      async get() { return snap(path, load()[path]); },
      async set(d) { const o = load(); o[path] = clone(d); save(o); },
      async delete() { const o = load(); delete o[path]; save(o); },
    });
    const collRef = (cpath, filters = [], lim = 1000) => ({
      path: cpath,
      doc(id) { return docRef(cpath + '/' + (id || ('l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)))); },
      where(f, op, v) { return collRef(cpath, [...filters, [f, op, v]], lim); },
      limit(n) { return collRef(cpath, filters, n); },
      async get() {
        const o = load(); const depth = cpath.split('/').length + 1;
        let docs = Object.keys(o).filter(k => k.startsWith(cpath + '/') && k.split('/').length === depth).map(k => snap(k, o[k]));
        docs = docs.filter(d => filters.every(([f, op, v]) => {
          const x = d.data()[f];
          return op === '==' ? x === v : op === 'array-contains' ? Array.isArray(x) && x.includes(v) : true;
        })).slice(0, lim);
        return { docs, size: docs.length, empty: !docs.length };
      },
    });
    return { doc: docRef, collection: p => collRef(p) };
  }

  // Lokale Dateiablage (nur Testmodus): id -> Objekt-URL
  const localBlobs = {};
  const localAssets = {
    upload: async (blob, o) => {
      const id = 'loc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      localBlobs[id] = URL.createObjectURL(blob);
      return { id, url: localBlobs[id], sizeBytes: blob.size, contentType: (o && o.type) || blob.type };
    },
    delete: async id => { if (localBlobs[id]) URL.revokeObjectURL(localBlobs[id]); delete localBlobs[id]; return { deleted: true }; },
  };

  // ================= Backend: Firebase =================
  const fbConfig = () => window.STAGEMATE_FIREBASE || null;
  const fbReady = () => !!(fbConfig() && window.firebase && typeof firebase.initializeApp === 'function' && firebase.auth && firebase.firestore);
  let fbAuth = null;

  // Firestore kennt keine Listen in Listen und kein undefined -> beim Speichern umwandeln, beim Lesen zurück
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function fbEncode(v) {
    if (Array.isArray(v)) return v.map(x => Array.isArray(x) ? { __arr: fbEncode(x) } : fbEncode(x));
    if (isObj(v)) { const o = {}; for (const k in v) if (v[k] !== undefined) o[k] = fbEncode(v[k]); return o; }
    return v;
  }
  function fbDecode(v) {
    if (Array.isArray(v)) return v.map(fbDecode);
    if (isObj(v)) {
      const keys = Object.keys(v);
      if (keys.length === 1 && keys[0] === '__arr' && Array.isArray(v.__arr)) return fbDecode(v.__arr);
      const o = {}; for (const k of keys) o[k] = fbDecode(v[k]); return o;
    }
    return v;
  }
  function makeFirebaseDb(fs) {
    const wrapSnap = s => ({ id: s.id, exists: !!s.exists, data: () => s.exists ? fbDecode(s.data()) : undefined });
    const wrapQuery = q => { const docs = q.docs.map(wrapSnap); return { docs, size: docs.length, empty: !docs.length }; };
    const docRef = path => ({
      id: path.split('/').pop(), path,
      async get() { return wrapSnap(await fs.doc(path).get()); },
      async set(d) { await fs.doc(path).set(fbEncode(clone(d))); },
      async delete() { await fs.doc(path).delete(); },
    });
    const collRef = (cpath, q) => ({
      path: cpath,
      doc(id) { return docRef(cpath + '/' + (id || fs.collection(cpath).doc().id)); },
      where(f, op, v) { return collRef(cpath, (q || fs.collection(cpath)).where(f, op, v)); },
      limit(n) { return collRef(cpath, (q || fs.collection(cpath)).limit(n)); },
      async get() { return wrapQuery(await (q || fs.collection(cpath)).get()); },
      onSnapshot(next, err) { return (q || fs.collection(cpath)).onSnapshot(s => next(wrapQuery(s)), e => { if (err) err(e); }); },
    });
    return { doc: docRef, collection: p => collRef(p) };
  }

  const FB_ERRORS = {
    'auth/invalid-email': 'Diese E-Mail-Adresse ist ungültig.',
    'auth/missing-email': 'Bitte gib deine E-Mail-Adresse ein.',
    'auth/missing-password': 'Bitte gib dein Passwort ein.',
    'auth/user-not-found': 'E-Mail oder Passwort stimmt nicht.',
    'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
    'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
    'auth/invalid-login-credentials': 'E-Mail oder Passwort stimmt nicht.',
    'auth/email-already-in-use': 'Mit dieser E-Mail gibt es schon ein Konto. Melde dich an.',
    'auth/weak-password': 'Das Passwort ist zu schwach (mindestens 6 Zeichen).',
    'auth/too-many-requests': 'Zu viele Versuche. Bitte warte kurz und versuche es nochmals.',
    'auth/network-request-failed': 'Keine Verbindung zum Server. Prüfe deine Internetverbindung.',
    'auth/requires-recent-login': 'Bitte melde dich aus Sicherheitsgründen neu an und versuche es nochmals.',
    'auth/operation-not-allowed': 'Anmelden mit E-Mail/Passwort ist in Firebase noch nicht eingeschaltet.',
  };
  const fbError = e => FB_ERRORS[e && e.code] || ('Das hat nicht geklappt' + (e && e.code ? ' (' + e.code + ')' : '') + '.');

  async function connectFirebase(onNeedLogin) {
    if (!firebase.apps.length) firebase.initializeApp(fbConfig());
    fbAuth = firebase.auth();
    try { fbAuth.languageCode = 'de'; } catch (e) {}
    const fs = firebase.firestore();
    const user = await new Promise(resolve => {
      let asked = false;
      const un = fbAuth.onAuthStateChanged(u => {
        if (u) { un(); resolve(u); }
        else if (!asked) { asked = true; if (onNeedLogin) onNeedLogin(); }
      });
    });
    return { mode: 'firebase', backend: 'firebase', db: makeFirebaseDb(fs), uid: user.uid, name: '', email: user.email || '', readOnly: false };
  }
  async function fbCall(fn) {
    if (!fbAuth) return { ok: false, error: 'Keine Verbindung zum Server.' };
    try { await fn(fbAuth); return { ok: true }; } catch (e) { return { ok: false, error: fbError(e), code: e && e.code }; }
  }
  const signIn = (email, pw) => fbCall(a => a.signInWithEmailAndPassword(String(email || '').trim(), pw || ''));
  const signUp = (email, pw) => fbCall(a => a.createUserWithEmailAndPassword(String(email || '').trim(), pw || ''));
  const resetPassword = email => fbCall(a => a.sendPasswordResetEmail(String(email || '').trim()));
  // Passwort bestätigen (nötig vor Passwortänderung und Kontolöschung)
  async function reauthenticate(pw) {
    return fbCall(async a => {
      const u = a.currentUser; if (!u) throw { code: 'auth/user-not-found' };
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw || ''));
    });
  }
  async function changePassword(oldPw, newPw) {
    const r = await reauthenticate(oldPw); if (!r.ok) return r;
    return fbCall(a => a.currentUser.updatePassword(newPw));
  }
  // Löscht das Anmeldekonto (vorher reauthenticate aufrufen und die eigenen Daten löschen)
  const deleteAccount = () => fbCall(a => a.currentUser.delete());

  async function signOut() {
    if (state.backend === 'firebase' && fbAuth) { try { await fbAuth.signOut(); } catch (e) {} location.reload(); return true; }
    return false;
  }

  // ================= Zustand =================
  const state = {
    mode: 'loading',      // 'loading' | 'db' (Claude) | 'local' | 'firebase'
    backend: null,        // 'claude' | 'local' | 'firebase'
    db: null,
    uid: null,
    name: '',             // vom Backend vorgeschlagener Anzeigename
    email: '',            // E-Mail des Kontos (nur Firebase)
    readOnly: false,
  };
  let assetsApi;          // undefined = noch nicht geprüft, null = nicht verfügbar
  let downloadsApi;

  function useLocal() {
    Object.assign(state, { mode: 'local', backend: 'local', db: makeLocalDb(), uid: 'local-user', name: '', readOnly: false });
    assetsApi = undefined; downloadsApi = undefined;
    return state;
  }

  async function connectClaude() {
    if (!hasClaude()) return null;
    const [user, realDb] = await Promise.all([window.claude.use('user'), window.claude.use('db')]);
    if (!user || !realDb) return null;
    const id = await user.id();
    if (!id) return null;
    let name = '', readOnly = false;
    try { const me = await user.me(); name = (me && me.name) || ''; } catch (e) {}
    try { if (user.can && (await user.can('data.write')) === false) readOnly = true; } catch (e) {}
    return { mode: 'db', backend: 'claude', db: realDb, uid: id, name, readOnly };
  }

  /**
   * Verbindet mit dem besten verfügbaren Backend.
   * Antwortet das Backend nicht innerhalb von timeoutMs, wird der Testmodus verwendet
   * (eine spätere Antwort wird dann ignoriert).
   */
  async function connect({ timeoutMs = 10000, onNeedLogin, onOffline } = {}) {
    // Web-Version mit Firebase: kein Rückfall in den Testmodus, sondern Anmeldung abwarten
    if (fbConfig()) {
      if (!fbReady()) { if (onOffline) onOffline(); return new Promise(() => {}); }
      const res = await connectFirebase(onNeedLogin);
      Object.assign(state, res); assetsApi = undefined; downloadsApi = undefined;
      return state;
    }
    let settled = false;
    return new Promise(resolve => {
      const done = s => { if (settled) return; settled = true; clearTimeout(timer); resolve(s); };
      const timer = setTimeout(() => done(useLocal()), timeoutMs);
      connectClaude()
        .then(res => { if (settled) return; if (res) { Object.assign(state, res); assetsApi = undefined; downloadsApi = undefined; done(state); } else done(useLocal()); })
        .catch(() => done(useLocal()));
    });
  }

  // ================= Dateien (Anhänge) =================
  async function assets() {
    if (assetsApi !== undefined) return assetsApi;
    if (state.mode === 'local') return (assetsApi = localAssets);
    if (state.backend === 'firebase') return (assetsApi = null);   // Datei-Upload braucht den kostenpflichtigen Blaze-Tarif
    try { assetsApi = await claudeUse('assets'); } catch (e) { assetsApi = null; }
    return assetsApi || null;
  }
  const assetUrl = id => localBlobs[id] || new URL('/_blob/' + id, location.href).href;

  // ================= Downloads / Export =================
  /**
   * Speichert eine Datei beim Benutzer.
   * Rückgabe: 'saved' | 'declined' | 'failed' | 'browser' (normaler Browser-Download)
   */
  async function saveFile({ filename, data, type = 'text/plain;charset=utf-8' }) {
    if (downloadsApi === undefined) { try { downloadsApi = state.mode === 'db' ? await claudeUse('downloads') : null; } catch (e) { downloadsApi = null; } }
    if (downloadsApi) {
      try { await downloadsApi.save({ filename, data }); return 'saved'; }
      catch (err) { return err && err.code === 'declined' ? 'declined' : 'failed'; }
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return 'browser';
  }

  // ================= Entwickler-Zugang (nur Web-Version) =================
  // Eigene, getrennte Firebase-Sitzung ("dev"), damit das normale Konto angemeldet bleibt.
  // Freigegeben ist nur, wer in Firestore unter developers/<uid> eingetragen ist (Regeln prüfen das).
  let devApp = null;
  async function devSignIn(email, password) {
    // Nicht state.backend prüfen: auf der Anmeldeseite ist die Verbindung noch nicht fertig (backend = null)
    if (!fbConfig()) return { ok: false, error: 'Nur in der Web-Version verfügbar.' };
    if (!fbReady()) return { ok: false, error: 'Keine Verbindung zu Firebase. Prüfe deine Internetverbindung.' };
    try {
      devApp = firebase.apps.find(a => a.name === 'dev') || firebase.initializeApp(fbConfig(), 'dev');
      const cred = await devApp.auth().signInWithEmailAndPassword(email, password);
      const fs = devApp.firestore();
      let readErr = null;
      const ok = await fs.doc('developers/' + cred.user.uid).get().catch(e => { readErr = e; return null; });
      if (readErr) { await devApp.auth().signOut().catch(() => {}); return { ok: false, error: 'Firestore verweigert das Lesen der Freigabe.', uid: cred.user.uid, readCode: readErr.code || 'unbekannt' }; }
      if (!ok || !ok.exists) { await devApp.auth().signOut().catch(() => {}); return { ok: false, error: 'Dieses Konto ist nicht als Entwickler freigegeben.', uid: cred.user.uid }; }
      return { ok: true, db: makeFirebaseDb(fs), uid: cred.user.uid };
    } catch (e) { return { ok: false, error: fbError(e), code: e && e.code }; }
  }
  async function devSignOut() { if (devApp) { try { await devApp.auth().signOut(); } catch (e) {} } }

  window.StagemateData = Object.freeze({
    connect,
    useLocal,
    assets,
    assetUrl,
    saveFile,
    get mode() { return state.mode; },
    get backend() { return state.backend; },
    get db() { return state.db; },
    get uid() { return state.uid; },
    get name() { return state.name; },
    get email() { return state.email; },
    get usesFirebase() { return !!fbConfig(); },
    signIn, signUp, resetPassword, signOut, reauthenticate, changePassword, deleteAccount,
    devSignIn, devSignOut,
    get readOnly() { return state.readOnly; },
  });
})();
