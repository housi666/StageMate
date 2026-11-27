/*! StageMate v0.6.7 · Build 86 · 2026-11-27 */
/* StageMate – App-Logik (Oberfläche, Register, Rechte) */
  // Version, Build und Changelog kommen aus js/version.js
  document.querySelectorAll('[data-app-version]').forEach(n => { n.textContent = APP_VERSION; n.title = `${APP_PHASE} · Build ${APP_BUILD} · ${APP_BUILD_DATE}`; });

(() => {
  const FIXED_ROLES = ['Gründer', 'Organisation', 'Checkliste'];   // immer vorhanden, können nicht entfernt werden
  const ROLE_REGS = { 'Checkliste': ['page4'], 'Setlist': ['page6', 'page7'], 'Timetable': ['page8'], 'Finanzen': ['page5'] };   // Rolle schaltet „Bearbeiten“ im Register frei
  const CL_ROLE = 'Checkliste';   // schaltet „Bearbeiten“ in der Registerkarte „Checkliste“ frei
  const ROLE_RENAMES = { 'Management': 'Organisation', 'Verwaltung': 'Organisation' };
  const renameRoles = list => Array.isArray(list) ? [...new Set(list.map(r => ROLE_RENAMES[r] || r))] : list;
  const DEFAULT_ROLES = ['Gründer', 'Gesang', 'Backing Vocals', 'Gitarre', 'Bass', 'Schlagzeug', 'Percussion', 'Keyboard', 'Bläser', 'Technik', 'Organisation', 'Checkliste', 'Setlist', 'Timetable', 'Finanzen'];
  // Register, deren Sichtbarkeit/Berechtigung der Admin steuert
  const REGISTERS = [
    { id: 'page2', title: 'Kalender' },
    { id: 'page3', title: 'Gigs' },
    { id: 'page4', title: 'Checkliste' },
    { id: 'page5', title: 'Finanzen' },
    { id: 'page6', title: 'Setlist' },
    { id: 'page7', title: 'Songs' },
    { id: 'page8', title: 'Timetable' },
  ];
  const LEVELS = { edit: 'Bearbeiten', read: 'Nur lesen', hidden: 'Ausgeblendet' };
  const PAGE_TITLES = { home: 'Startbildschirm', overview: 'Übersicht', profile: 'Profil & Bands', team: 'Verwaltung', settings: 'Einstellungen' };
  REGISTERS.forEach(r => PAGE_TITLES[r.id] = r.title);

  const logo = document.getElementById('logoTpl');
  document.querySelectorAll('.logo-slot').forEach(s => s.replaceWith(logo.content.cloneNode(true)));

  const $ = id => document.getElementById(id);
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    sdel(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  const initials = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const clone = o => JSON.parse(JSON.stringify(o));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ================= Datenspeicher =================
  // Datenmodell:
  //   members/<uid>                         Profil: { name, email, phone, bandIds:[...], memberships:{ <bandId>:{ roles:[...] } }, lastBand }
  //   bands/<bandId>                        Verzeichnis: { name, code, createdBy, createdAt }
  //   bandadmin/<adminUid>/bands/<bandId>   Admin-Einstellungen: { roles:[...], access:{ defaults:{reg:level}, members:{uid:{reg:level}} } }
  //                                         -> nur der Admin selbst (und der App-Besitzer) kann hier schreiben
  let db = null, uid = null, mode = 'loading', rawDb = null;

  // Datenzugriff läuft ausschliesslich über die Datenschicht (js/data.js)
  const Data = window.StagemateData;

  function normCfg(c) {
    c = c ? clone(c) : {};
    if (!Array.isArray(c.roles)) c.roles = [...DEFAULT_ROLES];
    c.access = c.access || {};
    c.access.defaults = c.access.defaults || {};
    c.access.members = c.access.members || {};
    delete c.access.roles;   // Rechte gibt es nur pro Mitglied
    c.assignments = c.assignments || {};
    c.extra = c.extra || {};
    c.removed = c.removed || {};   // uid -> Zeitpunkt der Entfernung
    c.logo = typeof c.logo === 'string' && c.logo.startsWith('data:image/') ? c.logo : null;
    if (!Array.isArray(c.categories) || !c.categories.length) c.categories = [
      { id: 'probe', name: 'Probe', color: '#3b82f6' }, { id: 'auftritt', name: 'Gig', color: '#8b5cf6' },
      { id: 'sitzung', name: 'Sitzung', color: '#e8a33d' }, { id: 'sonstiges', name: 'Sonstiges', color: '#10b981' }];
    // „Gig“ ist fest und kann nicht entfernt werden
    if (!c.categories.some(k => k.id === 'auftritt')) c.categories.splice(1, 0, { id: 'auftritt', name: 'Gig', color: '#8b5cf6' });
    // Frühere Standardwerte übernehmen: „Auftritt“ heisst jetzt „Gig“ und ist violett (nur wenn unverändert)
    c.categories.forEach(k => {
      if (k.id === 'auftritt' && k.name === 'Auftritt') { k.name = 'Gig'; if (k.color === '#e8a33d') k.color = '#8b5cf6'; }
      if (k.id === 'sitzung' && k.name === 'Sitzung' && k.color === '#8b5cf6' && c.categories.some(x => x.id === 'auftritt' && x.color === '#8b5cf6')) k.color = '#e8a33d';
    });
    c.roles = renameRoles(c.roles);
    Object.keys(c.assignments).forEach(k => { c.assignments[k] = renameRoles(c.assignments[k]); });
    Object.values(c.extra).forEach(e => { e.roles = renameRoles(e.roles || []); });
    if (!c.roles.includes('Gründer')) c.roles.unshift('Gründer');
    if (!c.roles.includes('Organisation')) c.roles.push('Organisation');
    if (!c.roles.includes('Checkliste')) c.roles.push('Checkliste');
    if (!Array.isArray(c.admins)) c.admins = [];
    return c;
  }
  const cfgPath = (adminUid, bandId) => `bandadmin/${adminUid}/bands/${bandId}`;

  async function loadBand(id) {
    const s = await db.doc('bands/' + id).get();
    if (!s.exists) return null;
    const b = { id, ...s.data() };
    // Das Dokument des Admins (Ersteller der Band) ist die Grundlage.
    // Mitglieder mit der Rolle „Organisation“ speichern Rollen-Änderungen im eigenen Dokument;
    // für Rollen gilt die neueste Fassung eines berechtigten Mitglieds.
    let cfg = null;
    if (b.createdBy) {
      const c = await db.doc(cfgPath(b.createdBy, id)).get();
      if (c.exists) cfg = c.data();
    }
    b.cfg = normCfg(cfg);
    b.cfg.admins = [];   // keine Manager mehr
    const base = { roles: b.cfg.roles, assignments: b.cfg.assignments, categories: b.cfg.categories, logo: b.cfg.logo, rolesAt: b.cfg.rolesAt || b.cfg.updatedAt || '' };
    const verwOf = asg => Object.keys(asg || {}).filter(u => (asg[u] || []).includes('Organisation') && u !== b.createdBy && !b.cfg.removed[u]).sort();
    const docs = {};
    let verw = verwOf(base.assignments), best = base;
    for (let i = 0; i < 5 && b.createdBy; i++) {
      const missing = verw.filter(u => !(u in docs));
      const got = await Promise.all(missing.map(u => db.doc(cfgPath(u, id)).get().catch(() => null)));
      missing.forEach((u, k) => { docs[u] = got[k] && got[k].exists ? got[k].data() : null; });
      best = base;
      verw.forEach(u => { const d = docs[u]; if (d && d.rolesAt && d.rolesAt > (best.rolesAt || '')) best = d; });
      const next = verwOf(normCfg({ assignments: best.assignments }).assignments);
      if (next.join() === verw.join()) break;
      verw = next;
    }
    if (best !== base) {
      const n = normCfg({ roles: best.roles, assignments: best.assignments });
      b.cfg.roles = n.roles; b.cfg.assignments = n.assignments; b.cfg.rolesAt = best.rolesAt;
      if (Array.isArray(best.categories) && best.categories.length) b.cfg.categories = best.categories;
      if (best.logo !== undefined) b.cfg.logo = typeof best.logo === 'string' && best.logo.startsWith('data:image/') ? best.logo : null;
    }
    b.verwalter = verwOf(b.cfg.assignments);
    // Wer sich mit einem persönlichen Code registriert hat, dem der Admin „Organisation“ mitgegeben hat
    const verwEntries = Object.entries(b.cfg.extra).filter(([, e]) => (e.roles || []).includes('Organisation')).map(([k]) => k);
    if (verwEntries.length) {
      try {
        const q = await db.collection('members').where('bandIds', 'array-contains', id).get();
        q.docs.forEach(d => {
          const m = d.data(); const ms = m.memberships && m.memberships[id];
          if (ms && verwEntries.includes(ms.entry) && !b.cfg.assignments[d.id] && !b.cfg.removed[d.id] && d.id !== b.createdBy && !b.verwalter.includes(d.id)) b.verwalter.push(d.id);
        });
      } catch (e) {}
    }
    return b;
  }
  async function loadBands(ids) {
    const out = {};
    await Promise.all(ids.map(async id => { const b = await loadBand(id); if (b) out[id] = b; }));
    return out;
  }
  async function findBandByCode(code) {
    const q = await db.collection('bands').where('code', '==', code).limit(1).get();
    return q.empty ? null : loadBand(q.docs[0].id);
  }
  // Persönliche Einladung: invites/<CODE> zeigt auf einen Eintrag, den ein Admin angelegt hat.
  // Gültig nur, wenn der Eintrag in den aktuellen Band-Einstellungen mit genau diesem Code steht.
  async function findInvite(code) {
    const s = await db.doc('invites/' + code).get();
    if (!s.exists) return null;
    const d = s.data();
    const band = d && d.bandId ? await loadBand(d.bandId) : null;
    if (!band) return null;
    const entry = band.cfg.extra[d.entryId];
    if (!entry || entry.code !== code) return null;
    return { band, entry: { id: d.entryId, ...entry } };
  }
  // ================= Band-Tag =================
  const TAG_RE = /^[A-Z0-9]{1,3}$/;
  const TAG_COOLDOWN = 5 * 60 * 1000;
  const fmtTag = t => !t ? '' : t.length === 1 ? `-${t}-` : t.length === 2 ? `${t[0]}-${t[1]}` : t;
  const normTagInput = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  const TAG_RULES = () => (typeof STAGEMATE_TAG_RULES !== 'undefined' ? STAGEMATE_TAG_RULES : {});
  const SHOW_DEFAULT = { logo: true, name: true, tag: true };
  const showOf = b => ({ ...SHOW_DEFAULT, ...((b && b.show) || {}) });
  const tagCooldownLeft = b => b && b.tagAt ? TAG_COOLDOWN - (Date.now() - Date.parse(b.tagAt)) : 0;
  function tagWords(name) {
    const R = TAG_RULES();
    let s = String(name || '').toUpperCase();
    Object.entries(R.replace || {}).forEach(([a, b]) => { s = s.split(a).join(b); });
    s = s.replace(/[^A-Z0-9]+/g, ' ').trim();
    const all = s ? s.split(' ') : [];
    const ign = new Set(R.ignoreWords || []);
    const words = all.filter(w => !ign.has(w));
    return words.length ? words : all;
  }
  function tagCandidates(name, len) {
    const R = TAG_RULES(), V = new RegExp('[' + (R.vowels || 'AEIOU') + ']', 'g');
    const words = tagWords(name); if (!words.length) return [];
    const joined = words.join('');
    const S = {
      initials: () => { let t = words.map(w => w[0]).join(''); const last = words[words.length - 1]; if (t.length < len) t += last.slice(1).replace(V, ''); if (t.length < len) t += last.slice(1); return t; },
      initialsDigits: () => words.map(w => /^\d+$/.test(w) ? w : w[0]).join(''),
      consonants: () => joined[0] + joined.slice(1).replace(V, ''),
      firstLetters: () => joined,
    };
    const out = [];
    (R.strategies || Object.keys(S)).forEach(k => { if (!S[k]) return; const t = S[k]().slice(0, len); if (t.length === len && !out.includes(t)) out.push(t); });
    return out;
  }
  const tagSuggestions = name => [1, 2, 3].map(n => tagCandidates(name, n)[0]).filter(Boolean);
  async function tagTaken(tag, exceptBandId) {
    try { const q = await db.collection('bands').where('tag', '==', tag).get(); return q.docs.some(d => d.id !== exceptBandId); } catch (e) { return false; }
  }
  async function autoTag(name, exceptBandId) {
    const len = TAG_RULES().length || 3;
    for (const L of [...new Set([len, 3, 2, 1])]) for (const t of tagCandidates(name, L)) if (!(await tagTaken(t, exceptBandId))) return t;
    const first = (tagCandidates(name, 1)[0] || 'X');
    for (let i = 0; i < 20; i++) { const t = first + genCode().replace(/[^A-Z0-9]/g, '').slice(0, 2); if (!(await tagTaken(t, exceptBandId))) return t; }
    return '';
  }
  function tagChip(t) { const c = el('span', 'band-tag', fmtTag(t)); c.title = 'Band-Tag ' + t; return c; }
  function mountTagEditor(box, { getName, getTag, setTag, bandId }) {
    box.innerHTML = ''; box.className = 'tag-editor';
    const row = el('div', 'te-row');
    const inp = el('input', 'te-input'); inp.type = 'text'; inp.maxLength = 3; inp.placeholder = 'z. B. NFL'; inp.autocomplete = 'off'; inp.spellcheck = false;
    const gen = el('button', 'btn small ghost', 'Generieren'); gen.type = 'button';
    const pv = el('span', 'band-tag te-preview');
    row.append(inp, gen, el('span', 'te-arrow', 'Anzeige:'), pv);
    const sug = el('div', 'te-sug'), note = el('div', 'te-note');
    box.append(row, sug, note);
    const paint = () => { const t = getTag(); if (inp.value !== t) inp.value = t; pv.textContent = t ? fmtTag(t) : '–'; pv.classList.toggle('empty', !t); };
    const renderSug = () => {
      sug.innerHTML = '';
      const list = tagSuggestions(getName());
      if (!list.length) { sug.append(el('span', 'te-sl', 'Beispiele erscheinen, sobald ein Bandname eingetragen ist.')); return; }
      sug.append(el('span', 'te-sl', 'Beispiele:'));
      list.forEach(t => { const b = el('button', 'te-chip', fmtTag(t)); b.type = 'button'; b.title = 'Übernehmen'; b.addEventListener('click', () => { setTag(t); paint(); }); sug.append(b); });
    };
    inp.addEventListener('input', () => { const v = normTagInput(inp.value); setTag(v); paint(); });
    gen.addEventListener('click', async () => {
      if (!getName()) return (note.textContent = 'Gib zuerst einen Bandnamen ein.');
      gen.disabled = true; note.textContent = 'Suche freien Tag …';
      const t = await autoTag(getName(), bandId ? bandId() : null);
      gen.disabled = false; note.textContent = t ? '' : 'Es wurde kein freier Tag gefunden.';
      if (t) { setTag(t); paint(); }
    });
    box._refresh = () => { paint(); renderSug(); };
    box._note = t => { note.textContent = t || ''; };
    box._refresh();
  }

  // ================= Nickname =================
  const nickKey = n => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
  function wordBlocked(v) {
    const L = typeof STAGEMATE_BADWORDS !== 'undefined' ? STAGEMATE_BADWORDS : { contains: [], exact: [] };
    const map = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
    const low = String(v || '').toLowerCase().replace(/[013457@$!]/g, c => map[c]);
    const plain = low.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
    const letters = plain.replace(/[^a-z0-9]/g, '');
    const tokens = plain.split(/[^a-z0-9]+/).filter(Boolean);
    return (L.contains || []).some(w => letters.includes(w)) || (L.exact || []).some(w => tokens.includes(w) || letters === w);
  }
  async function nickTaken(name) {
    const key = nickKey(name);
    try {
      const [a, b] = await Promise.all([
        db.collection('members').where('nickKey', '==', key).get(),
        db.collection('members').where('name', '==', name).get(),
      ]);
      return [...a.docs, ...b.docs].some(d => d.id !== uid);
    } catch (e) { return false; }
  }

  // ================= PUID (eine ID pro Konto) =================
  async function newPuid() {
    for (let i = 0; i < 8; i++) {
      const r = new Uint32Array(1); crypto.getRandomValues(r);
      const id = 'PUID-' + String(r[0] % 100000000).padStart(8, '0');
      try { const q = await db.collection('members').where('puid', '==', id).get(); if (q.empty) return id; } catch (e) { return id; }
    }
    return 'PUID-' + Date.now().toString().slice(-8);
  }
  async function ensurePuid() {
    if (!profile || readOnly || (profile.puid && !profile._migrateContact)) return;
    try {
      const p = clone(profile); delete p._migrateContact;
      if (!p.puid) p.puid = await newPuid();
      await db.doc('members/' + uid).set(p); profile = p;
    } catch (e) {}
  }

  async function createBand(name, tag) {
    let code;
    for (let i = 0; i < 6; i++) {
      code = genCode();
      const q = await db.collection('bands').where('code', '==', code).limit(1).get();
      if (q.empty) break;
    }
    const ref = db.collection('bands').doc();
    const now = new Date().toISOString();
    const band = { name, code, tag: tag || '', tagAt: now, tagAtMs: Date.now(), show: { ...SHOW_DEFAULT }, createdBy: uid, createdAt: now };
    const cfg = normCfg(null);
    await db.doc(cfgPath(uid, ref.id)).set(cfg);
    await ref.set(band);
    return { id: ref.id, ...band, cfg };
  }
  async function loadMembers(bandId) {
    const q = await db.collection('members').where('bandIds', 'array-contains', bandId).get();
    const list = q.docs.map(d => ({ uid: d.id, ...d.data() }));
    // Kontaktangaben liegen getrennt und sind nur für Mitglieder gemeinsamer Bands lesbar
    await Promise.all(list.map(async m => {
      try { const c = await db.doc('contacts/' + m.uid).get(); if (c.exists) { const d = c.data(); m.email = d.email || ''; m.phone = d.phone || ''; } } catch (e) {}
    }));
    return list;
  }

  // ================= Kontaktangaben (E-Mail, Telefon) =================
  // members/<uid>   öffentlich für angemeldete Benutzer (Nickname, Name, Bands …)
  // contacts/<uid>  E-Mail und Telefon – nur die Person selbst und Mitglieder gemeinsamer Bands
  let lastContact = null, lastPrivate = null;
  // Ernährung & Allergien (freiwillig): in contacts/<uid> unter „food“ – nur mit Haken „für meine Bands sichtbar“ in der Zusammenfassung
  const FOOD_DIETS = ['vegetarisch', 'vegan', 'ohne Schweinefleisch', 'laktosefrei', 'glutenfrei'];
  const FOOD_ALLERGENS = ['Glutenhaltiges Getreide', 'Krebstiere', 'Eier', 'Fisch', 'Erdnüsse', 'Soja', 'Milch (inkl. Laktose)', 'Schalenfrüchte (Nüsse)', 'Sellerie', 'Senf', 'Sesam', 'Schwefeldioxid und Sulfite', 'Lupinen', 'Weichtiere'];
  const foodKey = f => JSON.stringify(f || null);
  // Ernährung getrennt gespeichert (v0.4.48): vollständig nur bei dir (private/<uid>/prefs/food); nur mit Haken „für meine Bands verwenden“
  // zusätzlich eine Kopie in foodshare/<uid>, die Mitglieder gemeinsamer Bands lesen dürfen. Ohne Haken gibt es keine Kopie.
  let lastFood;
  async function saveFood(base, f) {
    const key = foodKey(f);
    if (key === lastFood) return;
    const now = new Date().toISOString();
    if (f) await base.doc('private/' + uid + '/prefs/food').set({ ...f, updatedAt: now });
    else { try { await base.doc('private/' + uid + '/prefs/food').delete(); } catch (e) {} }
    if (f && f.share) await base.doc('foodshare/' + uid).set({ diet: f.diet || [], allergens: f.allergens || [], note: f.note || '', updatedAt: now });
    else { try { await base.doc('foodshare/' + uid).delete(); } catch (e) {} }
    lastFood = key;
  }
  function withContacts(base) {
    return {
      collection: p => base.collection(p),
      doc(path) {
        const ref = base.doc(path);
        const m = /^members\/([^/]+)$/.exec(path);
        if (!m) return ref;
        return {
          id: ref.id, path: ref.path,
          get: () => ref.get(),
          async set(d) {
            const rest = { ...d }; delete rest.email; delete rest.phone; delete rest.food; delete rest._migrateContact;
            // Verborgenes Profilbild: nur im privaten Dokument der Person speichern
            if (d.photoPublic === false) {
              delete rest.photo;
              if (m[1] === uid) {
                const pkey = d.photo || '';
                if (pkey !== lastPrivate) { await base.doc('private/' + m[1]).set({ photo: d.photo || null, updatedAt: new Date().toISOString() }); lastPrivate = pkey; }
              }
            }
            await ref.set(rest);
            if (m[1] === uid && ('email' in d || 'phone' in d)) {
              const c = { email: d.email || '', phone: d.phone || '' };
              const key = JSON.stringify(c);
              if (key !== lastContact) { await base.doc('contacts/' + m[1]).set({ ...c, updatedAt: new Date().toISOString() }); lastContact = key; }
            }
            if (m[1] === uid && 'food' in d) await saveFood(base, d.food || null);
          },
          async delete() {
            await ref.delete();
            if (m[1] === uid) {
              try { await base.doc('contacts/' + m[1]).delete(); } catch (e) {}
              try { await base.doc('private/' + m[1]).delete(); } catch (e) {}
              try { await base.doc('private/' + m[1] + '/prefs/food').delete(); } catch (e) {}
              try { await base.doc('foodshare/' + m[1]).delete(); } catch (e) {}
              lastContact = null; lastPrivate = null; lastFood = null;
            }
          },
        };
      },
    };
  }
  async function loadOwnContact(p) {
    if (!p) return p;
    try {
      const c = await db.doc('contacts/' + uid).get();
      if (c.exists) {
        const d = c.data(); p.email = d.email || ''; p.phone = d.phone || ''; lastContact = JSON.stringify({ email: p.email, phone: p.phone });
        // Alt (bis v0.4.47): Ernährung lag in contacts und war für alle gemeinsamen Bands lesbar → einmalig verschieben
        if (d.food) {
          p.food = d.food; lastFood = undefined;
          try { await saveFood(db, d.food); await db.doc('contacts/' + uid).set({ email: p.email, phone: p.phone, updatedAt: new Date().toISOString() }); }
          catch (e) { console.warn('[Ernährung] Verschieben fehlgeschlagen', e); }
        }
      }
      else if (p.email || p.phone) p._migrateContact = true;   // ältere Profile: Kontakt noch im öffentlichen Dokument
    } catch (e) {}
    if (!p.food) {
      try { const fd = await db.doc('private/' + uid + '/prefs/food').get(); if (fd.exists) { const { updatedAt, ...rest } = fd.data(); p.food = rest; lastFood = foodKey(rest); } else lastFood = foodKey(null); } catch (e) {}
    }
    if (p.photoPublic === false) {
      try { const pr = await db.doc('private/' + uid).get(); if (pr.exists) { p.photo = pr.data().photo || null; lastPrivate = p.photo || ''; } } catch (e) {}
    }
    return p;
  }
  function foodBuild() {
    const box = $('fFood'); if (!box || box.childElementCount) return;
    const grp = (title, arr, cls) => { const g = el('div', 'food-grp'); g.append(el('div', 'food-t', title)); arr.forEach(v => { const lb = el('label', 'hc-opt'), cb = el('input'); cb.type = 'checkbox'; cb.value = v; cb.className = cls; lb.append(cb, v); g.append(lb); }); box.append(g); };
    grp('Ernährung', FOOD_DIETS, 'fd-diet'); grp('Allergien und Unverträglichkeiten', FOOD_ALLERGENS, 'fd-all');
  }
  function foodFill(f) {
    foodBuild(); f = f || {};
    document.querySelectorAll('#fFood .fd-diet').forEach(c => { c.checked = (f.diet || []).includes(c.value); });
    document.querySelectorAll('#fFood .fd-all').forEach(c => { c.checked = (f.allergens || []).includes(c.value); });
    $('fFoodNote').value = f.note || ''; $('fFoodShare').checked = !!f.share;
  }
  function foodRead() {
    const diet = [...document.querySelectorAll('#fFood .fd-diet:checked')].map(c => c.value), allergens = [...document.querySelectorAll('#fFood .fd-all:checked')].map(c => c.value);
    const note = ($('fFoodNote').value || '').trim().slice(0, 200), share = $('fFoodShare').checked;
    return diet.length || allergens.length || note ? { diet, allergens, note, share } : null;
  }
  async function foodSaveOnly() {
    const m = $('foodMsg'); if (!profile) return setMsg(m, 'Bitte lege zuerst dein Profil an.', 'error');
    $('foodSave').disabled = true; setMsg(m, 'Wird gespeichert …');
    try {
      const p = clone(profile); p.food = foodRead(); p.updatedAt = new Date().toISOString();
      await db.doc('members/' + uid).set(p); profile = p;
      setMsg(m, 'Gespeichert ✓', 'ok'); flash('Ernährung gespeichert ✓');
    } catch (e) { setMsg(m, friendlyError(e), 'error'); }
    $('foodSave').disabled = readOnly;
  }
  $('foodSave').addEventListener('click', foodSaveOnly);
  function genCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = ''; const r = new Uint32Array(6); crypto.getRandomValues(r);
    for (const n of r) s += abc[n % abc.length];
    return s;
  }

  // ================= Zustand =================
  let profile = null;
  let bands = {};
  let currentBand = null;
  let currentPage = 'overview';
  let suggestedName = '';
  let pendingReg = null;   // Registrierung läuft: Formularwerte bleiben, bis das Konto steht
  let fbLoginShown = false;   // Konto-Anmeldung der Web-Version ist sichtbar
  const regMode = () => fbLoginShown && !uid;
  let suggestedEmail = '';   // E-Mail des Kontos (Web-Version)
  let readOnly = false;
  let activeTab = 'login';
  let newBandMode = 'join';
  let joinBand = null;
  let joinEntry = null;   // persönliche Einladung (Eintrag des Admins)
  let editRoles = {};
  let newRoles = new Set();

  // Mitgliedschaft gilt, solange der Admin die Person nicht nach ihrem Beitritt entfernt hat
  function isActiveIn(m, bandId, cfg) {
    const r = cfg && cfg.removed && cfg.removed[m.uid];
    if (!r) return true;
    const j = (m.memberships && m.memberships[bandId] && m.memberships[bandId].joinedAt) || '';
    return j > r;
  }
  const bandIdsOf = p => (p && Array.isArray(p.bandIds)) ? p.bandIds.filter(id => bands[id] && isActiveIn({ uid, memberships: p.memberships }, id, bands[id].cfg)) : [];
  // Rollen eines Mitglieds: vom Admin festgelegt, sonst selbst gewählt
  function memberRoles(m, bandId, cfg) {
    cfg = cfg || (bands[bandId] && bands[bandId].cfg);
    const own = renameRoles((m && m.memberships && m.memberships[bandId] && m.memberships[bandId].roles) || []);
    const r = cfg && cfg.assignments[m.uid] ? cfg.assignments[m.uid] : own;
    return cfg ? r.filter(x => cfg.roles.includes(x)) : r;
  }
  const rolesOf = (p, id) => memberRoles({ ...(p || {}), uid }, id);
  const assignedByAdmin = id => !!(bands[id] && bands[id].cfg.assignments[uid]);
  const isFounder = (id, who = uid) => !!bands[id] && bands[id].createdBy === who;
  const isAdminUid = (id, who) => !!bands[id] && (bands[id].createdBy === who || bands[id].cfg.admins.includes(who));
  // "In eine Rolle schlüpfen": Admins sehen die App vorübergehend aus Sicht eines Mitglieds
  let viewAs = null;   // { uid, name, roles } oder null; uid null = neues Mitglied (Standard)
  const realIsAdmin = id => isAdminUid(id, uid);
  const isAdmin = id => !viewAs && realIsAdmin(id);
  const isVerwalter = id => !!bands[id] && (bands[id].verwalter || []).includes(uid);
  // darf Rollen verwalten – in der Vorschau so, wie es das betrachtete Mitglied dürfte
  const canRoles = id => viewAs
    ? (viewAs.uid ? !!(bands[id] && (bands[id].verwalter || []).includes(viewAs.uid)) : !!(viewAs.pending && viewAs.roles.includes('Organisation')))
    : (realIsAdmin(id) || isVerwalter(id));
  const actorUid = () => viewAs ? viewAs.uid : uid;

  // Berechtigung: Einstellung für das Mitglied, sonst Standard
  // Rollen einer Person in einer Band (für Rechte, die an Rollen hängen)
  function rolesOfUid(bandId, who) {
    const b = bands[bandId]; if (!b) return [];
    if (viewAs && who === uid && bandId === currentBand) return viewAs.roles || [];
    if (who === uid) return rolesOf(profile, bandId);
    if (b.cfg.assignments[who]) return b.cfg.assignments[who];
    const m = (typeof members !== 'undefined' && Array.isArray(members) ? members : []).find(x => x.uid === who);
    return m ? memberRoles(m, bandId) : [];
  }
  const regDefault = reg => reg === 'page5' ? 'read' : 'edit';   // Grundeinstellung pro Registerkarte
  function levelFor(bandId, reg, memberUid = uid) {
    const b = bands[bandId];
    if (!b) return 'edit';
    const a = b.cfg.access;
    // Rolle „Checkliste“ schaltet „Bearbeiten“ in der Checkliste frei
    if (rolesOfUid(bandId, memberUid).some(r => (ROLE_REGS[r] || []).includes(reg))) return 'edit';
    if (viewAs && memberUid === uid && bandId === currentBand) {
      const o = viewAs.uid && a.members[viewAs.uid] && a.members[viewAs.uid][reg];
      return o || a.defaults[reg] || (reg === 'page5' ? 'read' : 'edit');
    }
    if (isAdminUid(bandId, memberUid)) return 'edit';
    if (a.members[memberUid] && a.members[memberUid][reg]) return a.members[memberUid][reg];
    return a.defaults[reg] || (reg === 'page5' ? 'read' : 'edit');   // Finanzen: ohne Einstellung nur lesen
  }
  function friendlyError(e) {
    const c = e && e.code;
    if (c === 'invalid_argument') return 'Keine Berechtigung zum Speichern. Bitte den Besitzer der App, dich als Mitwirkende/n freizugeben.';
    if (c === 'quota_exceeded') return 'Der Speicherplatz der App ist voll.';
    return 'Speichern hat nicht geklappt. Bitte versuche es gleich noch einmal.';
  }
  function setMsg(node, text, kind) { node.textContent = text || ''; node.className = 'msg' + (kind ? ' ' + kind : ''); }

  // ================= Rollen-Chips =================
  function renderChips(container, set, roles, disabled) {
    container.innerHTML = '';
    roles.forEach(r => {
      const b = el('button', 'chip' + (set.has(r) ? ' on' : ''), r);
      b.type = 'button';
      if (disabled) { b.disabled = true; container.appendChild(b); return; }
      b.addEventListener('click', () => { set.has(r) ? set.delete(r) : set.add(r); b.classList.toggle('on'); });
      container.appendChild(b);
    });
  }

  // ================= Formular (Registrieren / Profil) =================
  const form = $('profileForm');

  function renderNewRoleChips() {
    const box = $('newRoles');
    const selfRoles = list => list.filter(r => !FIXED_ROLES.includes(r));   // Gründer/Organisation vergeben nur Admin oder Organisation
    if (newBandMode === 'create') return renderChips(box, newRoles, selfRoles(DEFAULT_ROLES));
    if (newBandMode === 'join') {
      if (joinBand) return renderChips(box, newRoles, selfRoles(joinBand.cfg.roles));
      box.innerHTML = '';
    }
  }

  function setBandMode(m) {
    newBandMode = m;
    newRoles = new Set();
    document.querySelectorAll('#bandMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    $('newBandFields').classList.toggle('hidden', m === 'none');
    $('joinField').classList.toggle('hidden', m !== 'join');
    $('joinFound').classList.toggle('hidden', m !== 'join');
    $('createField').classList.toggle('hidden', m !== 'create');
    renderNewRoleChips();
  }
  document.querySelectorAll('#bandMode button').forEach(b => b.addEventListener('click', () => setBandMode(b.dataset.mode)));

  // Code prüfen, sobald 6 Zeichen eingegeben sind
  let lookupSeq = 0;
  $('fCode').addEventListener('input', async () => {
    const code = $('fCode').value.trim().toUpperCase();
    const f = $('joinFound');
    joinBand = null; joinEntry = null; newRoles = new Set(); renderNewRoleChips();
    if (!/^[A-Z0-9]{6}([A-Z0-9]{2})?$/.test(code)) { f.className = 'found muted'; f.textContent = 'Gib den Band-Code (6 Zeichen) oder deinen persönlichen Code (8 Zeichen) ein.'; return; }
    const seq = ++lookupSeq;
    f.className = 'found muted'; f.textContent = 'Band wird gesucht …';
    try {
      let b = null, entry = null;
      if (code.length === 8) { const r = await findInvite(code); if (r) { b = r.band; entry = r.entry; } }
      else b = await findBandByCode(code);
      if (seq !== lookupSeq) return;
      if (!b) { f.className = 'found err'; f.textContent = 'Zu diesem Code wurde keine Band gefunden.'; return; }
      joinBand = b; joinEntry = entry;
      f.className = 'found';
      if (entry) {
        f.textContent = `✓ Persönliche Einladung von „${b.name}“ für ${entry.name}`;
        newRoles = new Set(memberRoles({ uid, memberships: { [b.id]: { roles: entry.roles || [] } } }, b.id, b.cfg));
        if (!$('fName').value.trim()) $('fName').value = entry.name;
      } else {
        f.textContent = `✓ Band gefunden: ${b.name}`;
      }
      renderNewRoleChips();
    } catch (e) {
      if (seq === lookupSeq) { f.className = 'found err'; f.textContent = 'Suche fehlgeschlagen. Bitte erneut versuchen.'; }
    }
  });

  // ================= Profilbild =================
  let photoDraft;   // undefined = unverändert, null = löschen, String = neues Bild (nur vor der Registrierung)
  function setAvatar(node, name, photo, opts = {}) {
    const ok = typeof photo === 'string' && photo.startsWith('data:image/');
    const locked = !!opts.locked;
    node.textContent = initials(name);
    node.style.backgroundImage = ok && !locked ? `url("${photo}")` : '';
    node.classList.toggle('has-photo', ok && !locked);
    node.classList.toggle('img-locked', locked);
    node.classList.toggle('img-zoom', ok && !locked && opts.zoom !== false);
    node.onclick = locked
      ? e => { e.preventDefault(); e.stopPropagation(); flash('Dieses Profilbild ist privat – die Person hat es in ihren Einstellungen verborgen.', true); }
      : ok && opts.zoom !== false ? e => { e.preventDefault(); e.stopPropagation(); openImage(photo, name); } : null;
  }
  // Profilbild einer anderen Person: privat?
  const photoLocked = m => !!m && m.uid !== uid && m.photoPublic === false;
  // ----- Grosse Bildansicht -----
  function openImage(src, title) {
    $('imgBig').src = src; $('imgTitle').textContent = title || '';
    $('imgModal').classList.remove('hidden');
  }
  const closeImage = () => { $('imgModal').classList.add('hidden'); $('imgBig').removeAttribute('src'); };
  $('imgX').addEventListener('click', closeImage);
  $('imgBack').addEventListener('click', closeImage);
  $('imgModal').addEventListener('click', e => { if (e.target === $('imgModal')) closeImage(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('imgModal').classList.contains('hidden')) closeImage(); });
  const currentPhoto = () => photoDraft !== undefined ? photoDraft : (profile && profile.photo) || null;
  function renderPhoto() {
    const ph = currentPhoto();
    setAvatar($('fPhotoPreview'), $('fName').value || (profile && profile.name) || '?', ph);
    $('fPhotoBtn').textContent = ph ? 'Bild ändern' : 'Bild hinzufügen';
    $('fPhotoDel').classList.toggle('hidden', !ph);
  }
  function resizeImage(file, size = 256) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const c = document.createElement('canvas'); c.width = c.height = size;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }
  function applyPhoto(data) {
    photoDraft = data;
    renderPhoto();
    const msg = $('photoMsg');
    if (!profile) setMsg(msg, data ? 'Wird bei der Registrierung gespeichert.' : '', '');
    else {
      const changed = (data || null) !== ((profile && profile.photo) || null);
      setMsg(msg, changed ? (data ? 'Neues Bild – noch nicht gespeichert.' : 'Bild wird beim Speichern gelöscht.') : '', '');
    }
    updateDirty();
  }
  $('fPhoto').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMsg($('photoMsg'), 'Bitte wähle eine Bilddatei.', 'error');
    try {
      const data = await resizeImage(file);
      await applyPhoto(data);
    } catch (err) {
      setMsg($('photoMsg'), 'Dieses Bild konnte nicht gelesen werden. Versuche es mit JPG oder PNG.', 'error');
    }
  });
  $('fPhotoDel').addEventListener('click', () => applyPhoto(null));
  $('fName').addEventListener('input', renderPhoto);

  // ----- Nicht gespeicherte Änderungen im Profil erkennen -----
  let profileSnap = '';
  function profileState() {
    const roles = {};
    Object.keys(editRoles).sort().forEach(k => { roles[k] = [...editRoles[k]].sort(); });
    const code = $('fCode').value.trim(), bname = $('fBandName').value.trim();
    const nb = newBandMode !== 'none' && (code || bname || newRoles.size) ? [newBandMode, code, bname, [...newRoles].sort().join(',')].join('|') : '';
    return JSON.stringify({ n: $('fName').value.trim(), fn: $('fFirst').value.trim(), ln: $('fLast').value.trim(), t: $('fTerms').checked, e: $('fEmail').value.trim(), p: $('fPhone').value.trim(), fd: foodRead(), ph: currentPhoto() || null, r: roles, nb });
  }
  const isProfileDirty = () => !!profile && !!profileSnap && !$('app').classList.contains('hidden') && profileState() !== profileSnap;
  ['input', 'change', 'click'].forEach(ev => form.addEventListener(ev, () => setTimeout(updateDirty, 0)));

  function prepareForm() {
    const ids = bandIdsOf(profile);
    const hasBands = ids.length > 0;
    $('fName').value = profile?.name || suggestedName || '';
    $('fFirst').value = profile?.firstName || '';
    $('fLast').value = profile?.lastName || '';
    $('fEmail').value = profile?.email || suggestedEmail || '';
    // Web-Version: die E-Mail des Kontos gilt, kein zweites E-Mail-Feld
    $('fEmailField').classList.toggle('hidden', Data.backend === 'firebase' && !regMode());
    $('fTerms').checked = false;
    $('termsWrap').classList.toggle('hidden', !needsTerms());
    regTag = ''; mountRegTag();
    $('puidRow').classList.toggle('hidden', !(profile && profile.puid));
    $('puidVal').textContent = (profile && profile.puid) || ''; $('puidVal').classList.add('hidden'); $('puidBtn').textContent = 'PUID anzeigen';
    $('fPhone').value = profile?.phone || ''; foodFill(profile && profile.food);
    photoDraft = undefined; setMsg($('photoMsg'), ''); renderPhoto();
    $('fCode').value = ''; $('fBandName').value = '';
    joinBand = null; joinEntry = null; setMsg($('bandAddMsg'), '');
    const f = $('joinFound'); f.className = 'found muted'; f.textContent = 'Gib den Band-Code (6 Zeichen) oder deinen persönlichen Code (8 Zeichen) ein.';

    editRoles = {};
    // Rollen nur bei der allerersten Registrierung auswählen
    $('newRolesField').classList.toggle('hidden', !!profile);

    if (profile) {
      $('regTitle').textContent = 'Profil';
      $('regHint').textContent = 'Ändere deine Angaben. Bands trittst du auf dem Startbildschirm bei oder gründest sie dort.';
      $('regBtn').textContent = 'Speichern';
    } else {
      $('regTitle').textContent = regMode() ? 'Registrieren' : 'Profil anlegen';
      $('regHint').textContent = regMode() ? 'Lege dein Profil und dein Passwort fest. Danach bist du automatisch angemeldet.' : 'Ergänze dein Profil. Bands findest du danach auf dem Startbildschirm.';
      $('regBtn').textContent = regMode() ? 'Registrieren' : 'Speichern';
    }
    $('regOnly').classList.toggle('hidden', !regMode());
    ['fRegPw', 'fRegPw2'].forEach(id => { $(id).value = ''; }); $('fTestBand').checked = false;
    setBandMode('none');
    $('regBtn').disabled = readOnly;
    setMsg($('regMsg'), readOnly ? 'Du hast nur Leserechte. Bitte den Besitzer der App, dich als Mitwirkende/n freizugeben.' : '', readOnly ? 'error' : '');
    profileSnap = profileState();
    updateDirty();
  }

  // Band-Tag bei der Gründung
  let regTag = '';
  function mountRegTag() { mountTagEditor($('fTagEditor'), { getName: () => $('fBandName').value.trim(), getTag: () => regTag, setTag: v => { regTag = v; } }); }
  $('fBandName').addEventListener('input', () => { const b = $('fTagEditor'); if (b._refresh) b._refresh(); });
  // PUID nur per Klick einblenden
  $('puidBtn').addEventListener('click', () => {
    const v = $('puidVal'), show = v.classList.contains('hidden');
    v.classList.toggle('hidden', !show); $('puidBtn').textContent = show ? 'Ausblenden' : 'PUID anzeigen';
  });
  // Passwort für Änderungen an persönlichen Angaben (Web-Version)
  function askPassword() {
    return new Promise(resolve => {
      const m = $('pwAskModal'), inp = $('pwAskInput');
      inp.value = ''; setMsg($('pwAskMsg'), ''); m.classList.remove('hidden'); setTimeout(() => inp.focus(), 30);
      const done = v => { m.classList.add('hidden'); ['pwAskOk', 'pwAskCancel', 'pwAskX'].forEach(id => $(id).onclick = null); inp.onkeydown = null; resolve(v); };
      $('pwAskOk').onclick = () => { if (!inp.value) return setMsg($('pwAskMsg'), 'Bitte gib dein Passwort ein.', 'error'); done(inp.value); };
      $('pwAskCancel').onclick = () => done(null); $('pwAskX').onclick = () => done(null);
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('pwAskOk').onclick(); } };
    });
  }

  async function submitProfile() {
    const msg = !$('bandAddModal').classList.contains('hidden') ? $('bandAddMsg') : $('regMsg');
    const name = $('fName').value.trim();
    const firstName = $('fFirst').value.trim(), lastName = $('fLast').value.trim();
    const email = Data.backend === 'firebase' && !regMode() ? (Data.email || '') : $('fEmail').value.trim();
    const acceptTerms = needsTerms();
    const phone = $('fPhone').value.trim();
    if (name.length < 2) return setMsg(msg, 'Bitte gib einen Nickname ein (mind. 2 Zeichen).', 'error');
    if (wordBlocked(name)) return setMsg(msg, 'Dieser Nickname enthält ein gesperrtes Wort. Bitte wähle einen anderen.', 'error');
    if (!firstName) return setMsg(msg, 'Bitte gib deinen Vornamen ein.', 'error');
    if (!lastName) return setMsg(msg, 'Bitte gib deinen Nachnamen ein.', 'error');
    if (acceptTerms && !$('fTerms').checked) return setMsg(msg, 'Bitte akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung.', 'error');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg(msg, 'Die E-Mail-Adresse sieht nicht gültig aus.', 'error');
    // Registrierung (noch kein Konto): zuerst das Konto anlegen, danach speichert finish() das Profil automatisch
    if (regMode()) {
      if (!email) return setMsg(msg, 'Bitte gib eine E-Mail-Adresse ein (sie darf zum Testen erfunden sein).', 'error');
      const pw = $('fRegPw').value;
      if (pw.length < 6) return setMsg(msg, 'Das Passwort braucht mindestens 6 Zeichen.', 'error');
      if (pw !== $('fRegPw2').value) return setMsg(msg, 'Die beiden Passwörter stimmen nicht überein.', 'error');
      const rb = $('regBtn'); rb.disabled = true; setMsg(msg, 'Konto wird erstellt …');
      pendingReg = { testBand: $('fTestBand').checked };
      const r = await Data.signUp(email, pw);
      rb.disabled = false;
      if (!r.ok) { pendingReg = null; return setMsg(msg, r.error, 'error'); }
      rememberLogin(email, pw);
      return;   // finish() übernimmt: Profil speichern und in den Startbildschirm
    }
    for (const id in editRoles) {
      if (editRoles[id].size === 0) return setMsg(msg, `Bitte wähle mindestens eine Rolle für „${bands[id].name}“.`, 'error');
    }
    const code = $('fCode').value.trim().toUpperCase();
    const bandName = $('fBandName').value.trim();
    if (newBandMode === 'join' && !/^[A-Z0-9]{6}([A-Z0-9]{2})?$/.test(code)) return setMsg(msg, 'Bitte gib einen gültigen Code ein (6 oder 8 Zeichen).', 'error');
    if (newBandMode === 'join' && !joinBand) return setMsg(msg, 'Zu diesem Code wurde (noch) keine Band gefunden.', 'error');
    if (newBandMode === 'create' && bandName.length < 2) return setMsg(msg, 'Bitte gib den Namen der neuen Band ein.', 'error');
    if (newBandMode === 'create' && wordBlocked(bandName)) return setMsg(msg, 'Der Bandname enthält ein gesperrtes Wort.', 'error');
    if (newBandMode === 'create' && regTag && !TAG_RE.test(regTag)) return setMsg(msg, 'Der Band-Tag braucht 1 bis 3 Zeichen (A–Z, 0–9).', 'error');
    if (!profile && newBandMode !== 'none' && newRoles.size === 0) return setMsg(msg, 'Bitte wähle mindestens ein Instrument bzw. eine Rolle.', 'error');

    const btn = $('regBtn'); btn.disabled = true;
    setMsg(msg, 'Wird geprüft …');
    const isNew = !profile;
    if ((isNew || nickKey(name) !== nickKey(profile.name)) && await nickTaken(name)) { btn.disabled = false; return setMsg(msg, `Der Nickname „${name}“ ist schon vergeben. Bitte wähle einen anderen.`, 'error'); }
    let bandTag = '';
    if (newBandMode === 'create') {
      bandTag = regTag || await autoTag(bandName);
      if (!bandTag) { btn.disabled = false; return setMsg(msg, 'Es konnte kein Band-Tag erzeugt werden. Bitte gib selbst einen ein.', 'error'); }
      if (regTag && await tagTaken(regTag)) { btn.disabled = false; return setMsg(msg, `Der Band-Tag ${fmtTag(regTag)} ist schon vergeben.`, 'error'); }
    }
    const personalChanged = !isNew && (name !== (profile.name || '') || firstName !== (profile.firstName || '') || lastName !== (profile.lastName || '') || phone !== (profile.phone || '') || photoDraft !== undefined);
    if (personalChanged && Data.backend === 'firebase') {
      const pw = await askPassword();
      if (!pw) { btn.disabled = false; return setMsg(msg, 'Nicht gespeichert – Passwort nicht bestätigt.', 'error'); }
      const r = await Data.reauthenticate(pw);
      if (!r.ok) { btn.disabled = false; return setMsg(msg, /credential|wrong-password/.test(r.code || '') ? 'Das Passwort stimmt nicht.' : r.error, 'error'); }
    }
    setMsg(msg, 'Wird gespeichert …');
    try {
      const now = new Date().toISOString();
      const p = profile ? clone(profile) : { createdAt: now, bandIds: [], memberships: {} };
      if (!p.puid) p.puid = await newPuid();
      p.nickKey = nickKey(name);
      if (p.photoPublic === undefined) p.photoPublic = true;
      p.name = name; p.firstName = firstName; p.lastName = lastName; p.email = email; p.phone = phone; p.food = foodRead(); p.updatedAt = now;
      if (acceptTerms) p.terms = { version: LEGAL_VERSION, acceptedAt: now };
      if (photoDraft !== undefined) { if (photoDraft) p.photo = photoDraft; else delete p.photo; }
      p.bandIds = bandIdsOf(p);
      p.memberships = p.memberships || {};
      for (const id in editRoles) p.memberships[id] = { ...(p.memberships[id] || {}), roles: [...editRoles[id]] };
      delete p.role;

      let added = null;
      if (newBandMode === 'join') {
        const activeThere = p.bandIds.includes(joinBand.id) && isActiveIn({ uid, memberships: p.memberships }, joinBand.id, joinBand.cfg);
        if (activeThere) { btn.disabled = false; return setMsg(msg, `Du bist bereits Mitglied von „${joinBand.name}“.`, 'error'); }
        if (joinBand.cfg.removed[uid] && !joinEntry) { btn.disabled = false; return setMsg(msg, `Du wurdest aus „${joinBand.name}“ entfernt. Bitte den Admin um einen persönlichen Einladungscode.`, 'error'); }
        added = joinBand;
      } else if (newBandMode === 'create') {
        added = await createBand(bandName, bandTag);
      }
      if (added) {
        bands[added.id] = added;
        if (!p.bandIds.includes(added.id)) p.bandIds.push(added.id);
        p.memberships[added.id] = { roles: [...newRoles], joinedAt: now };
        if (newBandMode === 'join' && joinEntry) p.memberships[added.id].entry = joinEntry.id;
        p.lastBand = added.id;
      }
      await db.doc('members/' + uid).set(p);
      profile = p; photoDraft = undefined;

      let text = 'Gespeichert.';
      if (added && newBandMode === 'create') text = `Band „${added.name}“ ${fmtTag(added.tag)} gegründet! Du bist Admin. Einladungscode: ${added.code}`;
      else if (added) text = `Willkommen bei „${added.name}“!`;
      setMsg(msg, text, 'ok');
      if (added) $('bandAddModal').classList.add('hidden');

      if (isNew || added || acceptTerms || !$('app').classList.contains('hidden')) {
        const fromAuth = $('app').classList.contains('hidden');
        setTimeout(() => {
          if (fromAuth) enterHub(); else enterApp(added ? added.id : currentBand);
          if (!isNew) { prepareForm(); setMsg($('regMsg'), text, 'ok'); flash('Profil gespeichert ✓'); }
        }, isNew ? 900 : 0);
      } else {
        renderAuth();
      }
    } catch (e) {
      if (e && e.code === 'invalid_argument') readOnly = true;
      setMsg(msg, friendlyError(e), 'error');
    } finally {
      btn.disabled = readOnly;
    }
  }
  form.addEventListener('submit', ev => { ev.preventDefault(); submitProfile(); });

  // ================= Nutzungsbedingungen & Datenschutz =================
  const needsTerms = () => !profile || !profile.terms || profile.terms.version !== LEGAL_VERSION;
  function openLegal(tab) {
    const show = t => {
      document.querySelectorAll('[data-legal-tab]').forEach(b => b.classList.toggle('on', b.dataset.legalTab === t));
      $('legalBody').innerHTML = t === 'privacy' ? LEGAL_PRIVACY : LEGAL_TERMS;
      $('legalBody').scrollTop = 0;
    };
    show(tab === 'privacy' ? 'privacy' : 'terms');
    $('legalVer').textContent = 'Fassung vom ' + LEGAL_VERSION.split('-').reverse().join('.');
    $('legalModal').classList.remove('hidden');
    if (!openLegal.bound) {
      openLegal.bound = true;
      document.querySelectorAll('[data-legal-tab]').forEach(b => b.addEventListener('click', () => show(b.dataset.legalTab)));
    }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-legal]');
    if (b) { e.preventDefault(); e.stopPropagation(); openLegal(b.dataset.legal); }
  }, true);
  $('legalClose').addEventListener('click', () => $('legalModal').classList.add('hidden'));

  // ================= Changelog (verschachtelt: 0 → 0.3 → v0.3.5) =================
  const CL_TYPES = { neu: 'Neu', besser: 'Besser', fix: 'Fix', intern: 'Intern' };
  function openChangelog() {
    const body = $('clogBody'); body.innerHTML = '';
    const list = (typeof APP_CHANGELOG !== 'undefined' ? APP_CHANGELOG : []);
    const groups = {};
    list.forEach(v => {
      const [ma, mi] = v.version.replace(/^v/, '').split('.');
      ((groups[ma] = groups[ma] || {})[ma + '.' + mi] = groups[ma][ma + '.' + mi] || []).push(v);
    });
    const first = list[0] && list[0].version;
    const fold = (cls, title, sub, open) => { const d = el('details', 'clog-' + cls); d.open = !!open; const sm = el('summary'); sm.append(el('span', 'clog-t', title)); if (sub) sm.append(el('span', 'clog-sub', sub)); d.append(sm); return d; };
    Object.keys(groups).sort((a, b) => b - a).forEach((ma, i) => {
      const dm = fold('major', `Version ${ma}`, Object.values(groups[ma]).reduce((n, x) => n + x.length, 0) + ' Versionen', i === 0);
      Object.keys(groups[ma]).sort((a, b) => Number(b.split('.')[1]) - Number(a.split('.')[1])).forEach((mi, j) => {
        const vs = groups[ma][mi];
        const dmi = fold('minor', `Version ${mi}`, vs.length + (vs.length === 1 ? ' Version' : ' Versionen'), i === 0 && j === 0);
        vs.forEach(v => {
          const dv = fold('ver', v.version, v.date ? v.date.split('-').reverse().join('.') : '–', v.version === first);
          const ul = el('ul', 'clog-items');
          (v.items || []).forEach(it => { const li = el('li'); li.append(el('span', 'clog-type ' + it.type, CL_TYPES[it.type] || it.type), el('span', null, it.text)); ul.append(li); });
          dv.append(ul); dmi.append(dv);
        });
        dm.append(dmi);
      });
      body.append(dm);
    });
    if (!list.length) body.append(el('div', 'mnote', 'Kein Changelog vorhanden.'));
    $('clogModal').classList.remove('hidden');
  }
  // Neben jedem Datenschutz-Knopf einen Changelog-Knopf (ausser im Satz zum Akzeptieren)
  document.querySelectorAll('[data-legal="privacy"]').forEach(b => {
    if (b.closest('label, .terms-row, .check')) return;
    const c = el('button', b.className, (b.textContent.includes('🔒') ? '📝 ' : '') + 'Changelog'); c.type = 'button'; c.dataset.changelog = '1';
    b.after(c);
    const prev = b.previousSibling;
    if (prev && prev.nodeType === 3 && prev.textContent.includes('·')) b.after(document.createTextNode(' · '));
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-changelog]')) { e.preventDefault(); openChangelog(); } });
  $('clogClose').addEventListener('click', () => $('clogModal').classList.add('hidden'));
  $('clogModal').addEventListener('click', e => { if (e.target === $('clogModal')) $('clogModal').classList.add('hidden'); });
  $('clogOpenAll').addEventListener('click', () => $('clogBody').querySelectorAll('details').forEach(d => { d.open = true; }));
  $('clogCloseAll').addEventListener('click', () => $('clogBody').querySelectorAll('details').forEach(d => { d.open = false; }));
  $('legalModal').addEventListener('click', e => { if (e.target === $('legalModal')) $('legalModal').classList.add('hidden'); });

  // ================= Passwort ansehen (nur solange gedrückt) =================
  const EYE_SVG = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function enhancePw(input) {
    if (!input || input.dataset.pwEnh) return;
    input.dataset.pwEnh = '1';
    const wrap = el('span', 'pw-wrap');
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    const b = el('button', 'pw-eye'); b.type = 'button'; b.tabIndex = -1; b.innerHTML = EYE_SVG;
    b.title = 'Gedrückt halten, um das Passwort zu sehen'; b.setAttribute('aria-label', b.title);
    const show = e => { e.preventDefault(); input.type = 'text'; b.classList.add('on'); };
    const hide = () => { input.type = 'password'; b.classList.remove('on'); };
    b.addEventListener('pointerdown', show);
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(ev => b.addEventListener(ev, hide));
    b.addEventListener('contextmenu', e => e.preventDefault());
    wrap.appendChild(b);
  }
  ['accPwOld', 'accPwNew', 'accPwNew2', 'accDelPw', 'fRegPw', 'fRegPw2'].forEach(id => enhancePw($(id)));

  // ================= Konto (nur Web-Version) =================
  function renderAccount() {
    const on = Data.backend === 'firebase';
    $('accountCard').classList.toggle('hidden', !on);
    if (!on) return;
    $('accEmail').textContent = Data.email || '';
  }
  $('accPwBtn').addEventListener('click', async () => {
    const m = $('accPwMsg'), oldPw = $('accPwOld').value, n1 = $('accPwNew').value, n2 = $('accPwNew2').value;
    if (!oldPw) return setMsg(m, 'Bitte gib dein aktuelles Passwort ein.', 'error');
    if (n1.length < 6) return setMsg(m, 'Das neue Passwort braucht mindestens 6 Zeichen.', 'error');
    if (n1 !== n2) return setMsg(m, 'Die beiden neuen Passwörter stimmen nicht überein.', 'error');
    if (n1 === oldPw) return setMsg(m, 'Das neue Passwort ist gleich wie das alte.', 'error');
    $('accPwBtn').disabled = true; setMsg(m, 'Wird geändert …');
    const r = await Data.changePassword(oldPw, n1);
    $('accPwBtn').disabled = false;
    if (!r.ok) return setMsg(m, /credential|wrong-password/.test(r.code || '') ? 'Das aktuelle Passwort stimmt nicht.' : r.error, 'error');
    ['accPwOld', 'accPwNew', 'accPwNew2'].forEach(id => $(id).value = '');
    setMsg(m, 'Passwort geändert ✓', 'ok'); flash('Passwort geändert ✓');
  });
  $('accDelBtn').addEventListener('click', async () => {
    const m = $('accDelMsg'), pw = $('accDelPw').value;
    const own = bandIdsOf(profile).filter(id => isFounder(id));
    if (own.length) return setMsg(m, `Du bist Gründer/Admin von „${own.map(id => bands[id].name).join('“, „')}“. Löse die Band zuerst auf (Verwaltung → Band auflösen).`, 'error');
    if (!$('accDelOk').checked) return setMsg(m, 'Bitte bestätige zuerst mit dem Häkchen.', 'error');
    if (!pw) return setMsg(m, 'Bitte gib dein Passwort ein.', 'error');
    $('accDelBtn').disabled = true; setMsg(m, 'Konto wird gelöscht …');
    const r = await Data.reauthenticate(pw);
    if (!r.ok) { $('accDelBtn').disabled = false; return setMsg(m, /credential|wrong-password/.test(r.code || '') ? 'Das Passwort stimmt nicht.' : r.error, 'error'); }
    try {
      await Promise.all(bandIdsOf(profile).map(id => db.doc(`bandadmin/${uid}/bands/${id}`).delete().catch(() => {})));
      await db.doc('members/' + uid).delete();
    } catch (e) { $('accDelBtn').disabled = false; return setMsg(m, 'Die Profildaten konnten nicht gelöscht werden. Bitte versuche es nochmals.', 'error'); }
    const d = await Data.deleteAccount();
    if (!d.ok) { $('accDelBtn').disabled = false; return setMsg(m, d.error, 'error'); }
    ls.sdel('bandLoggedIn');
    location.reload();
  });

  // ================= Anmeldeseite =================
  function showTab(t) {
    activeTab = t;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    renderAuth();
  }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('goRegister').addEventListener('click', () => showTab('register'));

  function renderAuth() {
    const loading = mode === 'loading';
    $('loadingBox').classList.toggle('hidden', !loading);
    $('demoBanner').classList.toggle('hidden', mode !== 'local');
    $('footnote').classList.toggle('hidden', mode === 'local' || Data.backend === 'firebase');
    // Web-Version: das Konto ist schon angemeldet – nur noch das Profil anlegen bzw. ergänzen
    { const t = document.querySelector('#auth .auth-side .card > .tabs'); if (t) t.classList.toggle('hidden', Data.backend === 'firebase'); }
    $('loginPane').classList.toggle('hidden', loading || activeTab !== 'login');
    $('registerSlot').classList.toggle('hidden', loading || activeTab !== 'register');
    if (loading) return;
    const ids = bandIdsOf(profile);
    $('loginKnown').classList.toggle('hidden', !profile);
    $('loginUnknown').classList.toggle('hidden', !!profile);
    if (profile) {
      setAvatar($('loginAvatar'), profile.name, profile.photo);
      $('loginName').textContent = profile.name;
      $('loginBands').textContent = ids.length ? ids.map(id => bands[id].name).join(' · ') : 'Noch in keiner Band';
      $('loginBtn').textContent = ids.length ? 'Anmelden' : 'Band beitreten oder gründen';
    }
    if (activeTab === 'register' && form.parentElement !== $('registerSlot')) { $('registerSlot').appendChild(form); prepareForm(); }
  }

  $('loginBtn').addEventListener('click', () => {
    if (needsTerms() || (!bandIdsOf(profile).length && Data.backend !== 'firebase')) return showTab('register');
    enterHub();
  });

  // ================= Übersicht „Deine Bands“ (nach dem Anmelden) =================
  let bandsPane = null;
  function bandCard(id) {
    const b = bands[id], sh = showOf(b);
    const card = el('button', 'bov-card' + (id === profile.lastBand ? ' last' : '')); card.type = 'button';
    const lg = el('span', 'bov-logo');
    fillBandLogo(lg, id, { canSee: isFounder(id) || (b.verwalter || []).includes(uid) });
    const txt = el('span', 'bov-txt');
    const title = el('span', 'bov-name');
    // Sichtbarkeit der Band gilt auch hier; ist gar nichts sichtbar, bleibt der Name stehen
    const showName = sh.name || !(sh.tag && b.tag);
    if (showName) title.append(b.name);
    if (sh.tag && b.tag) title.append(tagChip(b.tag));
    const roles = rolesOf(profile, id);
    const meta = el('span', 'bov-meta', (isFounder(id) ? 'Admin · ' : '') + (roles.length ? roles.join(' · ') : 'Keine Rolle'));
    txt.append(title, meta);
    if (id === profile.lastBand) txt.append(el('span', 'bov-last', 'Zuletzt geöffnet'));
    card.append(lg, txt, el('span', 'bov-go', '›'));
    card.addEventListener('click', () => enterApp(id));
    return card;
  }
  function showBandsOverview() {
    const ids = bandIdsOf(profile);
    if (!ids.length) return showTab('register');
    const card = document.querySelector('#auth .auth-side .card');
    if (bandsPane) bandsPane.remove();
    bandsPane = el('div'); bandsPane.id = 'bandsPane';
    const head = el('div', 'bov-head');
    const av = el('div', 'avatar'); setAvatar(av, profile.name, profile.photo);
    const hl = el('div');
    const h = el('h2', null, 'Deine Bands');
    const hint = el('p', 'hint'); hint.append('Hallo ', el('strong', null, profile.name), '! Wähle die Band, mit der du arbeiten willst.');
    hl.append(h, hint); head.append(av, hl);
    const list = el('div', 'bov-list');
    const sorted = [...ids].sort((a, c) => (a === profile.lastBand ? -1 : c === profile.lastBand ? 1 : (bands[a].name || '').localeCompare(bands[c].name || '', 'de')));
    sorted.forEach(id => list.append(bandCard(id)));
    const foot = el('div', 'bov-foot');
    const add = el('button', 'linkish-btn', '+ Band beitreten oder gründen'); add.type = 'button';
    add.addEventListener('click', () => { hideBandsOverview(); enterHub(); hubAddBandMode('join'); });
    const out = el('button', 'linkish-btn bov-out', 'Abmelden'); out.type = 'button';
    out.addEventListener('click', async () => { ls.sdel('bandLoggedIn'); if (await Data.signOut()) return; hideBandsOverview(); showTab('login'); });
    foot.append(add, out);
    bandsPane.append(head, list, foot);
    card.prepend(bandsPane);
    card.classList.add('ov-mode');
  }
  function hideBandsOverview() {
    const card = document.querySelector('#auth .auth-side .card');
    if (card) card.classList.remove('ov-mode');
    if (bandsPane) { bandsPane.remove(); bandsPane = null; }
  }

  // ================= App =================
  function enterApp(bandId) {
    { const am = document.getElementById('alphaModal'); if (am) am.classList.add('hidden'); }   // Pre-Alpha-Hinweis gehört nur zum Anmeldebildschirm
    if (typeof showTipsHint === 'function') showTipsHint();
    const ids = bandIdsOf(profile);
    if (!ids.length) return;
    hideBandsOverview();
    inHub = false; $('app').classList.remove('hub-mode'); ls.sset('smView', 'band');
    $('brandSub').textContent = 'Band-Verwaltung';
    if (currentPage === 'home') currentPage = 'overview';
    currentBand = ids.includes(bandId) ? bandId : ids[0];
    ls.sset('bandLoggedIn', '1'); ls.sset('smBand', currentBand);
    applyNavOrder();
    const sw = $('bandSwitch'); sw.innerHTML = '';
    ids.forEach(id => { const o = el('option', null, bands[id].name + (isFounder(id) ? ' (Admin)' : '')); o.value = id; sw.appendChild(o); });
    sw.value = currentBand;

    $('auth').classList.add('hidden');
    $('app').classList.remove('hidden');
    ensurePuid();
    tickSideClock(); delete bandMembersCache[currentBand]; startPresence(); syncSidebar();
    if (form.parentElement !== $('profileSlot')) { $('profileSlot').appendChild(form); prepareForm(); }
    renderAppHeader();
    showPage(currentPage);
  }

  function renderAppHeader() {
    const band = bands[currentBand];
    const roles = viewAs ? viewAs.roles : rolesOf(profile, currentBand);
    const sh = showOf(band);
    const bn = $('brandName'); bn.innerHTML = '';
    if (sh.name) bn.append(band.name);
    if (sh.tag && band.tag) bn.append(tagChip(band.tag));
    renderBandList();
    renderBrandLogo();
    loadEvents();
    renderSideUser();
    const wl = $('welcomeLine'); wl.innerHTML = '';
    wl.append('Hallo ', el('strong', null, profile.name.split(/\s+/)[0]), ', willkommen zurück!');
    $('ovCode').textContent = band.code;

    // Navigation nach Berechtigungen
    REGISTERS.forEach(r => {
      const btn = document.querySelector(`#nav [data-page="${r.id}"]`);
      if (btn) btn.classList.toggle('hidden', levelFor(currentBand, r.id) === 'hidden');
    });
  }


  // ----- Band-Auswahl (aufklappbar) -----
  function renderBandList() {
    const ids = bandIdsOf(profile);
    $('bandCount').textContent = ids.length;
    const wrap = $('bandList'); wrap.innerHTML = '';
    const inner = el('div');
    ids.forEach(id => {
      const b = el('button', 'band-opt' + (id === currentBand ? ' current' : '')); b.type = 'button';
      b.append(el('span', 'bo-dot'), el('span', 'bo-name', bands[id].name));
      if (bands[id].tag && showOf(bands[id]).tag) b.append(tagChip(bands[id].tag));
      if (isFounder(id)) b.append(el('span', 'bo-tag', 'Admin'));
      b.addEventListener('click', () => {
        $('bandSwitchWrap').classList.remove('open'); $('bandToggle').setAttribute('aria-expanded', 'false');
        if (id === currentBand) return;
        const sw = $('bandSwitch'); sw.value = id; sw.dispatchEvent(new Event('change'));
      });
      inner.appendChild(b);
    });
    const add = el('button', 'band-opt add', '+ Band beitreten oder gründen'); add.type = 'button';
    add.addEventListener('click', () => { $('bandSwitchWrap').classList.remove('open'); hubAddBandMode('join'); });
    inner.appendChild(add);
    wrap.appendChild(inner);
  }
  $('bandToggle').addEventListener('click', () => {
    const open = $('bandSwitchWrap').classList.toggle('open');
    $('bandToggle').setAttribute('aria-expanded', String(open));
  });

  $('bandSwitch').addEventListener('change', async e => {
    viewAs = null; renderViewAs();
    currentBand = e.target.value;
    renderAppHeader();
    showPage(currentPage);
    if (profile.lastBand !== currentBand && !readOnly) {
      profile.lastBand = currentBand;
      try { await db.doc('members/' + uid).set(profile); } catch (err) {}
    }
  });

  $('copyCode').addEventListener('click', async () => {
    const b = $('copyCode');
    try { await navigator.clipboard.writeText(bands[currentBand].code); b.textContent = 'Kopiert ✓'; }
    catch (e) { b.textContent = 'Bitte markieren'; }
    setTimeout(() => { b.textContent = 'Kopieren'; }, 1600);
  });

  // ----- Vor / Zurück (wie im Browser) -----
  const navHist = []; let navPos = -1, navSilent = false;
  function navRecord(page) {
    if (navSilent) return;
    const e = { page, band: inHub ? null : currentBand, hub: inHub };
    const cur = navHist[navPos];
    if (cur && cur.page === e.page && cur.band === e.band && cur.hub === e.hub) return;
    navHist.splice(navPos + 1); navHist.push(e); if (navHist.length > 50) navHist.shift(); navPos = navHist.length - 1;
    navButtons();
  }
  function navButtons() { $('navBack').disabled = navPos <= 0; $('navFwd').disabled = navPos >= navHist.length - 1; }
  function navGo(delta) {
    const i = navPos + delta; if (i < 0 || i >= navHist.length) return;
    const e = navHist[i]; navPos = i; navSilent = true;
    try {
      if (e.hub) { if (!inHub) enterHub(); else showPage('home'); }
      else if (inHub || e.band !== currentBand) { if (bandIdsOf(profile).includes(e.band)) { currentPage = e.page; enterApp(e.band); } }
      else showPage(e.page);
    } finally { navSilent = false; navButtons(); }
  }
  $('navBack').addEventListener('click', () => navGo(-1));
  $('navFwd').addEventListener('click', () => navGo(1));
  $('setlistBack').addEventListener('click', () => { if (navPos > 0) navGo(-1); else showPage('overview'); });
  function showPage(page) {
    if (page === 'profile' || page === 'settings') {
      if (!inHub) { enterHub(); }
      return openHubSection(page);
    }
    const reg = REGISTERS.find(r => r.id === page);
    if (reg && levelFor(currentBand, page) === 'hidden') page = 'overview';
    currentPage = page;
    placeUI(page === 'home' ? 'hub' : page);
    navRecord(page);
    $('page-home').classList.toggle('hidden', page !== 'home');
    if (page === 'home') { renderHub(); if (!isSettingsDirty()) setDraft = null; renderSettingsAll(); requestAnimationFrame(packHub); }
    document.querySelectorAll('.sidebar [data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    $('pageTitle').textContent = PAGE_TITLES[page];
    $('roBadge').classList.toggle('hidden', !(reg && levelFor(currentBand, page) === 'read'));
    $('page-overview').classList.toggle('hidden', page !== 'overview');
    if (page === 'overview') { renderOverview(); renderOvMembers(); refreshOnline(); }
    $('page-profile').classList.toggle('hidden', page !== 'profile');
    if (page === 'profile') renderAccount();
    $('page-team').classList.toggle('hidden', page !== 'team');
    $('page-settings').classList.toggle('hidden', page !== 'settings');
    $('page-placeholder').classList.toggle('hidden', !reg || page === 'page2' || page === 'page3' || page === 'page4' || page === 'page5' || page === 'page6' || page === 'page7' || page === 'page8');
    $('page-gigs').classList.toggle('hidden', page !== 'page3');
    if (page === 'page3') renderGigs();
    $('page-checklist').classList.toggle('hidden', page !== 'page4');
    if (page === 'page4') renderChecklistPage();
    $('page-finance').classList.toggle('hidden', page !== 'page5');
    if (page === 'page5') openFinance();
    $('page-setlist').classList.toggle('hidden', page !== 'page6');
    if (page === 'page6') openSetlist();
    $('page-songs').classList.toggle('hidden', page !== 'page7');
    if (page === 'page7') openSongs();
    $('page-timetable').classList.toggle('hidden', page !== 'page8');
    if (page === 'page8') openTimetable();
    $('page-calendar').classList.toggle('hidden', page !== 'page2');
    if (page === 'page2') renderCalendar(0);
    if (page === 'profile' && !isProfileDirty()) prepareForm();
    if (page === 'team') openTeam();
    if (page === 'settings') { if (!isSettingsDirty()) setDraft = null; renderSettingsAll(); }
    updateDirty();
  }
  // ================= Startbildschirm: Bands, Profil und Einstellungen auf einem Bildschirm =================
  let inHub = false;
  // Status-Auswahl: auf der Bandseite (Desktop, Leiste offen) unter der Uhr oben links, sonst in der Kopfzeile oben rechts
  function placeStatus() {
    const sw = document.querySelector('.st-wrap'), app = $('app'), sb = document.querySelector('.sidebar');
    if (!sw || !sb) return;
    const side = !app.classList.contains('hub-mode') && !sb.classList.contains('collapsed') && window.matchMedia('(min-width: 761px)').matches;
    const tb = document.querySelector('.topbar');
    if (side) { if (sw.parentElement !== $('sideClock').parentElement || !sw.classList.contains('in-side')) { $('sideClock').after(sw); sw.classList.add('in-side'); } }
    else if (sw.parentElement !== tb) { tb.appendChild(sw); sw.classList.remove('in-side'); }
  }
  { const mo = new MutationObserver(placeStatus); mo.observe($('app'), { attributes: true, attributeFilter: ['class'] }); mo.observe(document.querySelector('.sidebar'), { attributes: true, attributeFilter: ['class'] }); window.matchMedia('(min-width: 761px)').addEventListener('change', placeStatus); placeStatus(); }
  const accCard = $('accountCard');
  function placeUI(where) {
    const sw = document.querySelector('.settings-wrap');
    if (where === 'hub') {
      if (form.parentElement !== $('hubProfileSlot')) { $('hubProfileSlot').append(form, accCard); if (!isProfileDirty()) prepareForm(); renderAccount(); }
      if (sw.parentElement !== $('hubSettingsSlot')) $('hubSettingsSlot').append(sw);
    } else {
      if (form.parentElement === $('hubProfileSlot')) { $('profileSlot').append(form); $('profileSlot').after(accCard); if (!isProfileDirty()) prepareForm(); }
      if (sw.parentElement !== $('page-settings')) $('page-settings').append(sw);
    }
  }
  // ----- Persönliche Übersicht: Anzeigen (Widgets), je ein Drittel breit, verschiebbar (animiert) -----
  const HUB_DEFAULT = ['bands', 'quick', 'nextgig', 'agenda', 'events', 'mycal', 'tasks', 'profile', 'settings'];
  let hubOrder = HUB_DEFAULT.slice();
  try {
    const sv = JSON.parse(ls.get('hubLayout') || 'null');
    if (sv && Array.isArray(sv.order)) {
      hubOrder = sv.order.filter(k => HUB_DEFAULT.includes(k));
      // neue Anzeigen an ihrem Standardplatz einfügen
      HUB_DEFAULT.forEach((k, i) => { if (!hubOrder.includes(k)) hubOrder.splice(Math.min(i, hubOrder.length), 0, k); });
    }
  } catch (e) {}
  let hubFold = {};   // Zuklapp-Stufe je Anzeige: 0 offen, 1 halb, 2 eine Zeile
  try { const sv2 = JSON.parse(ls.get('hubLayout') || 'null'); if (sv2 && sv2.fold && typeof sv2.fold === 'object') hubFold = sv2.fold; } catch (e) {}
  const saveHubLayout = () => { try { ls.set('hubLayout', JSON.stringify({ order: hubOrder, fold: hubFold })); } catch (e) {} };
  const hubSecs = () => [...$('hubGrid').querySelectorAll(':scope > .hub-sec')];
  // FLIP-Animation: Positionen vorher merken, ändern, dann sanft an den neuen Platz gleiten
  function hubAnimate(change, skip) {
    const secs = hubSecs(), before = new Map(secs.map(s => [s, s.getBoundingClientRect()]));
    change();
    secs.forEach(s => {
      if (s === skip) return;
      const a = before.get(s), b = s.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      s.style.transition = 'none'; s.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => { requestAnimationFrame(() => { s.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'; s.style.transform = ''; }); });
      clearTimeout(s._ht); s._ht = setTimeout(() => { s.style.transition = ''; }, 320);
    });
  }
  function applyHubLayout() {
    const grid = $('hubGrid'), map = {};
    hubSecs().forEach(sec => { map[sec.dataset.hub] = sec; });
    hubOrder.forEach(k => { if (map[k]) grid.append(map[k]); });
    packHub();
  }
  // Anzeigen immer nach oben zusammenschieben: jede Anzeige kommt in die gerade kürzeste Spalte
  const HUB_GAP = 14;
  function packHub() {
    const grid = $('hubGrid'); if (!grid || !grid.offsetParent) return;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const h = new Array(cols).fill(0);
    hubSecs().forEach(sec => {
      const span = Math.ceil(sec.getBoundingClientRect().height) + HUB_GAP;
      let c = 0; for (let i = 1; i < cols; i++) if (h[i] < h[c] - 1) c = i;
      sec.style.gridColumn = String(c + 1);
      sec.style.gridRow = `${h[c] + 1} / span ${span}`;
      h[c] += span;
    });
  }
  let packT = null;
  const schedulePack = () => { cancelAnimationFrame(packT); packT = requestAnimationFrame(packHub); };
  if (window.ResizeObserver) { const ro = new ResizeObserver(schedulePack); hubSecs().forEach(sec => ro.observe(sec)); }
  window.addEventListener('resize', schedulePack);
  hubSecs().forEach(sec => {
    const old = sec.querySelector('.hub-head');
    const head = el('div', 'hub-head');
    const drag = el('span', 'hub-drag', '⠿'); drag.title = 'Anzeige verschieben (ziehen)'; drag.setAttribute('aria-label', 'Anzeige verschieben');
    const title = el('span', 'hub-title'); title.append(...old.childNodes);
    const fold = el('button', 'hub-fold'); fold.type = 'button';
    const FOLD_T = ['Zuklappen (halb)', 'Weiter zuklappen (eine Zeile)', 'Wieder aufklappen'];
    const setFold = n => {
      sec.classList.remove('fold1', 'fold2'); if (n) sec.classList.add('fold' + n);
      fold.textContent = n === 2 ? '▸' : '▾'; fold.title = FOLD_T[n]; fold.setAttribute('aria-label', FOLD_T[n]);
    };
    setFold(hubFold[sec.dataset.hub] || 0);
    fold.addEventListener('click', () => {
      const n = ((hubFold[sec.dataset.hub] || 0) + 1) % 3; hubFold[sec.dataset.hub] = n;
      hubAnimate(() => { setFold(n); packHub(); }, sec); saveHubLayout();
    });
    head.append(drag, title, fold); old.replaceWith(head);
    sec.classList.remove('folded', 'wide');
    drag.addEventListener('pointerdown', e => startHubDrag(e, sec));
  });
  applyHubLayout();
  $('hubLayoutReset').addEventListener('click', () => { hubOrder = HUB_DEFAULT.slice(); saveHubLayout(); hubAnimate(applyHubLayout); flash('Anordnung zurückgesetzt'); });
  function startHubDrag(e, sec) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const grid = $('hubGrid');
    sec.classList.add('dragging'); document.body.classList.add('hub-dragging');
    let busy = 0;
    const move = ev => {
      ev.preventDefault();
      const sc = $('app').querySelector('main') || document.scrollingElement;
      if (ev.clientY < 70) sc.scrollBy(0, -14); else if (ev.clientY > innerHeight - 50) sc.scrollBy(0, 14);
      if (Date.now() - busy < 260) return;   // während eine Animation läuft, nicht erneut tauschen
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const tgt = under && under.closest('.hub-sec');
      if (!tgt || tgt === sec || tgt.parentElement !== grid) return;
      const r = tgt.getBoundingClientRect();
      const before = ev.clientY < r.top + r.height / 2;
      const ref = before ? tgt : tgt.nextSibling;
      if (ref === sec || ref === sec.nextSibling) return;
      busy = Date.now();
      hubAnimate(() => { grid.insertBefore(sec, ref); packHub(); });
    };
    const up = () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      sec.classList.remove('dragging'); document.body.classList.remove('hub-dragging');
      hubOrder = hubSecs().map(x => x.dataset.hub); saveHubLayout();
    };
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }
  function openHubSection(k, target) {
    if (currentPage !== 'home') showPage('home');
    const sec = document.querySelector(`.hub-sec[data-hub="${k}"]`);
    if (target && target.classList) target.classList.remove('folded');
    setTimeout(() => (target || sec).scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
  function renderHub() {
    setAvatar($('homeAvatar'), profile.name, profile.photo);
    const h = $('homeHello'); h.innerHTML = ''; h.append('Hallo ', el('strong', null, profile.name), '!');
    const ids = bandIdsOf(profile);
    const list = $('hubBandList'); list.innerHTML = '';
    if (!ids.length) list.append(el('div', 'mnote', 'Du bist noch in keiner Band. Tritt einer Band bei oder gründe eine.'));
    const sorted = [...ids].sort((a, c) => (a === profile.lastBand ? -1 : c === profile.lastBand ? 1 : (bands[a].name || '').localeCompare(bands[c].name || '', 'de')));
    sorted.forEach(id => list.append(bandCard(id)));
    loadHubAgenda();
  }
  function hubAddBandMode(m) {
    if (!profile) return;
    if (!isProfileDirty()) prepareForm();
    setBandMode(m); setMsg($('bandAddMsg'), '');
    $('bandAddModal').classList.remove('hidden');
    setTimeout(() => { const f = m === 'create' ? $('fBandName') : $('fCode'); if (f) f.focus(); }, 80);
  }
  const bandAddClose = () => { $('bandAddModal').classList.add('hidden'); setBandMode('none'); };
  $('bandAddX').addEventListener('click', bandAddClose);
  $('bandAddCancel').addEventListener('click', bandAddClose);
  $('bandAddModal').addEventListener('click', e => { if (e.target === $('bandAddModal')) bandAddClose(); });
  $('bandAddGo').addEventListener('click', () => { if (newBandMode === 'none') return; submitProfile(); });
  $('hubAddBand').addEventListener('click', () => hubAddBandMode('create'));
  $('hubJoinBand').addEventListener('click', () => hubAddBandMode('join'));
  // Band suchen (Name oder Tag) – Sichtbarkeit der Band gilt auch hier
  let allBandsCache = null, searchT = null;
  $('hubSearchBtn').addEventListener('click', () => {
    const box = $('hubSearch'), open = box.classList.toggle('hidden') === false;
    if (open) { $('hubSearchInput').focus(); runBandSearch(); }
  });
  $('hubSearchInput').addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(runBandSearch, 200); });
  async function runBandSearch() {
    const res = $('hubSearchRes'), q = $('hubSearchInput').value.trim().toLowerCase();
    if (!allBandsCache) {
      res.innerHTML = ''; res.append(el('div', 'mnote', 'Bands werden geladen …'));
      try { const s = await db.collection('bands').get(); allBandsCache = s.docs.map(d => ({ id: d.id, ...d.data() })); }
      catch (e) { res.innerHTML = ''; res.append(el('div', 'mnote', 'Die Bandliste konnte nicht geladen werden.')); return; }
    }
    res.innerHTML = '';
    const mine = new Set(bandIdsOf(profile));
    const list = allBandsCache.filter(b => {
      const sh = showOf(b);
      const hay = [(sh.name ? b.name : ''), (sh.tag ? b.tag : '')].join(' ').toLowerCase();
      return hay.trim() && (!q || hay.includes(q));
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de')).slice(0, 30);
    if (!list.length) { res.append(el('div', 'mnote', q ? 'Keine Band gefunden.' : 'Noch keine sichtbaren Bands.')); return; }
    list.forEach(b => {
      const sh = showOf(b), row = el('div', 'hs-row');
      const nm = el('span', 'hs-name'); if (sh.name) nm.append(b.name); else nm.append('Band'); if (sh.tag && b.tag) nm.append(tagChip(b.tag));
      row.append(nm, el('span', 'hs-state', mine.has(b.id) ? '✓ deine Band' : 'Code beim Admin anfragen'));
      if (mine.has(b.id)) { row.classList.add('mine'); row.addEventListener('click', () => enterApp(b.id)); }
      res.append(row);
    });
  }

  // ---- Persönliche Übersicht: Schnell erstellen (Band wählen, dann das passende Fenster öffnen)
  const QUICK = { gig: { page: 'page3', btn: 'gigAdd', label: 'Gig-Seite' }, event: { page: 'page2', btn: 'calAdd', label: 'Terminseite' }, checklist: { page: 'page4', btn: 'clpAdd', label: 'Checklisten-Seite' }, setlist: { page: 'page6', btn: 'slNew', label: 'Setlist-Seite' } };
  function quickGo(kind, bandId) {
    const q = QUICK[kind]; $('quickModal').classList.add('hidden');
    currentPage = q.page; enterApp(bandId);
  }
  document.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
    const kind = b.dataset.quick;
    const ids = bandIdsOf(profile);
    if (!ids.length) return flash('Tritt zuerst einer Band bei oder gründe eine.', true);
    if (ids.length === 1) return quickGo(kind, ids[0]);
    $('quickTitle').textContent = 'Springe zu ' + QUICK[kind].label + ': welche Band?';
    const box = $('quickBands'); box.innerHTML = '';
    ids.forEach(id => {
      const bd = bands[id]; if (!bd) return;
      const o = el('button', 'quick-band'); o.type = 'button';
      const nm = el('span'); nm.append(bd.name); if (bd.tag && showOf(bd).tag) nm.append(tagChip(bd.tag));
      o.append(nm, el('span', 'qb-go', '›'));
      o.addEventListener('click', () => quickGo(kind, id));
      box.append(o);
    });
    $('quickModal').classList.remove('hidden');
  }));
  $('quickClose').addEventListener('click', () => $('quickModal').classList.add('hidden'));
  $('quickModal').addEventListener('click', e => { if (e.target === $('quickModal')) $('quickModal').classList.add('hidden'); });

  // ---- Persönliche Übersicht: dein nächster Gig (aus allen Bands, bis 1 Jahr voraus)
  function renderNextGig(x, bandLabel) {
    const box = $('hubNextGigBody'); box.innerHTML = '';
    if (!x) { box.append(el('div', 'mnote', 'Kein Gig im nächsten Jahr eingetragen.')); return; }
    const c = ovCfg(), ev = x.ev, today = dOnly(new Date());
    const days = Math.round((dOnly(x.date) - today) / 864e5);
    const card = el('div', 'ng-card');
    const top = el('div', 'ng-top');
    top.append(el('span', 'ng-count' + (days <= 7 ? ' soon' : ''), days === 0 ? 'Heute' : days === 1 ? 'Morgen' : `in ${days} Tagen`), bandLabel(x.band));
    const title = el('div', 'ng-title', ev.title || 'Gig');
    const when = el('div', 'ng-line', '🗓 ' + fmtDateOv(x.date, c.date) + (ev.allDay ? ' · ganztägig' : ' · ' + fmtHHMM(ev.start, c.time) + (ev.end ? '–' + fmtHHMM(ev.end, c.time) : '')));
    card.append(top, title, when);
    if (ev.location) card.append(el('div', 'ng-line', '📍 ' + ev.location + (ev.address ? ' · ' + ev.address : '')));
    const sch = ev.schedule || {};
    const plan = [['Get In', sch.getin], ['Soundcheck', sch.soundcheck], ['Linecheck', sch.linecheck]].filter(([, t]) => t);
    if (plan.length) card.append(el('div', 'ng-line ng-plan', '⏱ ' + plan.map(([n, t]) => `${n} ${fmtHHMM(t, c.time)}`).join(' · ')));
    const btn = el('button', 'btn small', 'Gig öffnen'); btn.type = 'button';
    btn.addEventListener('click', () => { currentPage = 'page3'; gigsOpen.add(ev.id + '|' + dKey(x.date)); enterApp(x.band); setTimeout(() => scrollToCard('gigList', ev.id + '|' + dKey(x.date)), 300); });
    const act = el('div', 'ng-act'); act.append(btn); card.append(act);
    box.append(card);
  }

  // ---- Mein Kalender (Startbildschirm): eigene Termine, zugeteilte Checklisten-Punkte, optional Band-Termine
  // Eigene Termine: private/<uid>/events/<id> { title, date, start, end, note }
  let hubEvPast = false;
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('#hubEvUp, #hubEvPast'); if (!t) return; hubEvPast = t.id === 'hubEvPast'; hubEvRender(); });
  function hubEvRender() {
    const box = $('hubEvList'); if (!box) return;
    box.innerHTML = ''; const today = dOnly(new Date()), c = ovCfg(), list = [];
    Object.entries(hubRaw).forEach(([bid, evs]) => evs.forEach(ev => {
      if (!ev.date || ev.kind === 'checklist' || ev.category !== 'auftritt') return;
      (hubEvPast ? occurrences(ev, addDays(today, -730), addDays(today, -1)) : occurrences(ev, today, addDays(today, 730))).forEach(dt => list.push({ band: bid, ev, date: dt }));
    }));
    list.sort((a, b) => (hubEvPast ? b.date - a.date : a.date - b.date) || (a.ev.start || '').localeCompare(b.ev.start || ''));
    $('hubEvUp').classList.toggle('ghost', hubEvPast); $('hubEvPast').classList.toggle('ghost', !hubEvPast);
    if (!list.length) box.append(el('div', 'mnote', hubEvPast ? 'Keine vergangenen Veranstaltungen.' : 'Keine kommenden Veranstaltungen.'));
    list.slice(0, 30).forEach(x => {
      const row = el('button', 'ag-row'); row.type = 'button';
      const b = bands[x.band], wrap = el('span', 'ag-band'); wrap.append(b ? b.name : 'Band');
      const t = el('span', 'ag-what'); t.append(el('b', null, '🎤 ' + (x.ev.title || 'Gig'))); if (x.ev.location) t.append(el('small', null, ' · ' + x.ev.location));
      row.append(el('span', 'ag-when', fmtDateOv(x.date, c.date) + (x.ev.allDay || !x.ev.start ? '' : ' · ' + fmtHHMM(x.ev.start, c.time))), t, wrap);
      row.addEventListener('click', () => { currentPage = 'page3'; gigsOpen.add(x.ev.id + '|' + dKey(x.date)); enterApp(x.band); setTimeout(() => scrollToCard('gigList', x.ev.id + '|' + dKey(x.date)), 300); });
      box.append(row);
    });
  }
  let hubRaw = {}, hubPers = [], hubCalM = null, hubCalSel = null;
  const hubCalOpt = k => { try { return ls.get('hubCal_' + k) === '1'; } catch (e) { return false; } };
  const hubCalSet = (k, v) => { try { ls.set('hubCal_' + k, v ? '1' : '0'); } catch (e) {} };
  async function hubCalLoad() {
    try { const q = await db.collection(`private/${uid}/events`).get(); hubPers = q.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { hubPers = []; }
    renderHubCal();
  }
  function hubCalItems(from, to) {
    const out = {}, add = (k, it) => { (out[k] = out[k] || []).push(it); }, inR = d => d >= from && d <= to;
    if (hubCalOpt('pers') || !ls.get('hubCal_pers')) hubPers.forEach(x => { if (x.date && inR(parseKey(x.date))) add(x.date, { kind: 'pers', ev: x, title: x.title || 'Termin', time: x.start || '' }); });
    if (hubCalOpt('tasks') || !ls.get('hubCal_tasks')) Object.entries(hubRaw).forEach(([bid, evs]) => evs.forEach(ev => Object.entries(ev.checklists || {}).forEach(([dk, list]) => {
      const when = dk === '_' ? (ev.kind === 'checklist' && ev.date ? parseKey(ev.date) : null) : parseKey(dk);
      if (!when || !inR(when)) return;
      (list || []).forEach(r => {
        const items = r.items || [];
        items.forEach(i => { if (!i.done && (i.members || []).includes(uid)) add(dKey(when), { kind: 'task', band: bid, title: i.title, sub: [r.title, ev.title].filter(Boolean).join(' · ') }); });
        if (!items.length && !r.done && (r.members || []).includes(uid)) add(dKey(when), { kind: 'task', band: bid, title: r.title, sub: ev.title || '' });
      });
    })));
    if (hubCalOpt('mine') || !ls.get('hubCal_mine')) Object.entries(hubRaw).forEach(([bid, evs]) => evs.forEach(ev => { if (ev.date && ev.kind !== 'checklist' && Array.isArray(ev.attendees) && ev.attendees.includes(uid)) occurrences(ev, from, to).forEach(dt => add(dKey(dt), { kind: 'band', band: bid, ev, title: ev.title || 'Termin', time: ev.allDay ? '' : (ev.start || ''), gig: ev.category === 'auftritt', mine: true })); }));
    if (hubCalOpt('band')) Object.entries(hubRaw).forEach(([bid, evs]) => evs.forEach(ev => { if (ev.date && ev.kind !== 'checklist') occurrences(ev, from, to).forEach(dt => { if (hubCalOpt('mine') || !ls.get('hubCal_mine')) { if (Array.isArray(ev.attendees) && ev.attendees.includes(uid)) return; } add(dKey(dt), { kind: 'band', band: bid, ev, title: ev.title || 'Termin', time: ev.allDay ? '' : (ev.start || ''), gig: ev.category === 'auftritt' }); }); }));
    return out;
  }
  function hubPersEdit(x, dateKey) {
    const bg = el('div', 'modal-bg'), md = el('div', 'modal'); md.setAttribute('role', 'dialog');
    const f = (lbl, type, val) => { const w = el('div', 'field'), i = el('input'); i.type = type; i.value = val || ''; w.append(el('label', null, lbl), i); md.append(w); return i; };
    md.append(el('h3', null, x ? 'Eigenen Termin bearbeiten' : 'Eigener Termin'));
    const t = f('Titel', 'text', x && x.title), d = f('Datum', 'date', (x && x.date) || dateKey), a = f('Beginn (optional)', 'time', x && x.start), b = f('Ende (optional)', 'time', x && x.end), n = f('Notiz (optional)', 'text', x && x.note);
    t.maxLength = 80; n.maxLength = 300;
    // Verknüpfung mit Band und Band-Termin (optional)
    const sel = (lbl) => { const w = el('div', 'field'), i = el('select'); w.append(el('label', null, lbl), i); md.append(w); return i; };
    const sb = sel('Mit Band verknüpfen (optional)'), se = sel('Mit Termin der Band verknüpfen (optional)');
    sb.append(new Option('– keine –', '')); Object.keys(bands).forEach(id => sb.append(new Option(bands[id].name || 'Band', id)));
    const fillEv = () => {
      se.innerHTML = ''; se.append(new Option('– keiner –', '')); const bid = sb.value; se.disabled = !bid;
      (hubRaw[bid] || []).filter(e => e.date && e.kind !== 'checklist').sort((p, q) => (q.date || '').localeCompare(p.date || '')).slice(0, 60)
        .forEach(e => se.append(new Option(`${e.date.split('-').reverse().join('.')} · ${e.title || 'Termin'}${e.category === 'auftritt' ? ' (Gig)' : ''}`, e.id)));
    };
    sb.value = x && bands[x.bandId] ? x.bandId : ''; fillEv(); se.value = x && x.evId ? x.evId : ''; sb.addEventListener('change', fillEv);
    const msg = el('div', 'msg'), row = el('div', 'modal-actions'), ok = el('button', 'btn', 'Speichern'), no = el('button', 'btn ghost', 'Abbrechen'), del = el('button', 'btn ghost', 'Löschen'); ok.type = no.type = del.type = 'button';
    row.append(ok, no); if (x) row.append(del); md.append(msg, row); bg.append(md); document.body.appendChild(bg); t.focus();
    no.addEventListener('click', () => bg.remove());
    ok.addEventListener('click', async () => {
      if (!t.value.trim() || !d.value) { msg.textContent = 'Titel und Datum sind nötig.'; msg.className = 'msg error'; return; }
      const data = { title: t.value.trim(), date: d.value, start: a.value || '', end: b.value || '', note: n.value.trim(), bandId: sb.value || '', evId: sb.value ? (se.value || '') : '', updatedAt: new Date().toISOString() };
      try {
        const ref = x ? db.collection(`private/${uid}/events`).doc(x.id) : db.collection(`private/${uid}/events`).doc();
        await ref.set(data);
        if (x) Object.assign(x, data); else hubPers.push({ id: ref.id, ...data });
        hubCalSel = d.value; hubCalM = new Date(parseKey(d.value).getFullYear(), parseKey(d.value).getMonth(), 1);
        bg.remove(); renderHubCal(); flash('Gespeichert ✓');
      } catch (e) { msg.textContent = 'Speichern fehlgeschlagen. Sind die Firestore-Regeln aktuell (private/…/events)?'; msg.className = 'msg error'; }
    });
    del.addEventListener('click', async () => {
      if (!confirm('Termin löschen?')) return;
      try { await db.collection(`private/${uid}/events`).doc(x.id).delete(); hubPers = hubPers.filter(y => y.id !== x.id); bg.remove(); renderHubCal(); flash('Gelöscht'); } catch (e) { flash('Löschen fehlgeschlagen', true); }
    });
  }
  function renderHubCal() {
    const box = $('hubCalBox'); if (!box || !profile) return; box.innerHTML = '';
    const now = dOnly(new Date()); if (!hubCalM) hubCalM = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!hubCalSel) hubCalSel = dKey(now);
    const y = hubCalM.getFullYear(), m = hubCalM.getMonth(), first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    const items = hubCalItems(first, last), c = ovCfg();
    const opts = el('div', 'hc-opts');
    [['pers', 'Eigene Termine'], ['mine', 'Mir zugeteilt'], ['tasks', 'Meine Punkte'], ['band', 'Alle Band-Termine']].forEach(([k, lbl]) => {
      const lb = el('label', 'hc-opt'), cb = el('input'); cb.type = 'checkbox'; cb.checked = k === 'band' ? hubCalOpt(k) : (ls.get('hubCal_' + k) == null ? true : hubCalOpt(k));
      cb.addEventListener('change', () => { hubCalSet(k, cb.checked); renderHubCal(); }); lb.append(cb, lbl); opts.append(lb);
    });
    const head = el('div', 'hc-head'), pv = el('button', 'btn small ghost', '◀'), nx = el('button', 'btn small ghost', '▶'), ad = el('button', 'btn small', '+ Termin'); pv.type = nx.type = ad.type = 'button';
    pv.addEventListener('click', () => { hubCalM = new Date(y, m - 1, 1); renderHubCal(); }); nx.addEventListener('click', () => { hubCalM = new Date(y, m + 1, 1); renderHubCal(); });
    ad.addEventListener('click', () => hubPersEdit(null, hubCalSel));
    head.append(pv, el('b', null, first.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' })), nx, ad);
    const grid = el('div', 'hc-grid'); ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach((w, i) => grid.append(el('div', 'hc-w' + (i === 6 ? ' holy' : ''), w)));
    for (let i = 0; i < (first.getDay() + 6) % 7; i++) grid.append(el('div', 'hc-e'));
    for (let d = 1; d <= last.getDate(); d++) {
      const dd = new Date(y, m, d), hn = holidayName(dd), k = dKey(dd), n = (items[k] || []).length, b = el('button', 'hc-d' + (k === dKey(now) ? ' today' : '') + (k === hubCalSel ? ' sel' : '') + (n ? ' has' : '') + (hn || dd.getDay() === 0 ? ' holy' : '')); b.type = 'button';
      if (hn) b.title = hn;
      b.append(String(d)); if (n) b.append(el('i', null, String(n)));
      b.addEventListener('click', () => { hubCalSel = k; renderHubCal(); }); grid.append(b);
    }
    const list = el('div', 'hc-list'), day = (items[hubCalSel] || []).slice().sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    if (hubCalSel && parseKey(hubCalSel).getMonth() === m) {
      list.append(el('div', 'hc-day', fmtDateOv(parseKey(hubCalSel), c.date)));
      if (!day.length) list.append(el('div', 'mnote', 'Nichts an diesem Tag.'));
      day.forEach(it => {
        const r = el('button', 'ag-row'); r.type = 'button';
        const w = el('span', 'ag-what'); w.append(el('b', null, (it.kind === 'pers' ? '👤 ' : it.kind === 'task' ? '☑️ ' : it.gig ? '🎤 ' : '📅 ') + it.title)); if (it.sub) w.append(el('small', null, ' · ' + it.sub));
        r.append(el('span', 'ag-when', it.time ? fmtHHMM(it.time, c.time) : 'ganztägig'), w);
        if (it.band && bands[it.band]) { const bl = el('span', 'ag-band'); bl.append(bands[it.band].name); r.append(bl); }
        if (it.kind === 'pers' && it.ev && it.ev.bandId && bands[it.ev.bandId]) {
          const lev = it.ev.evId && (hubRaw[it.ev.bandId] || []).find(e => e.id === it.ev.evId);
          const lk = el('span', 'ag-band', '↗ ' + bands[it.ev.bandId].name + (lev ? ': ' + (lev.title || 'Termin') : '')); lk.title = lev ? 'Zum verknüpften Termin' : 'Zur Band';
          lk.addEventListener('click', e => { e.stopPropagation(); currentPage = lev && lev.category === 'auftritt' ? 'page3' : (lev ? 'page2' : 'overview'); if (lev && lev.category === 'auftritt') gigsOpen.add(lev.id + '|' + lev.date); enterApp(it.ev.bandId); });
          r.append(lk);
        }
        r.addEventListener('click', () => {
          if (it.kind === 'pers') return hubPersEdit(it.ev);
          if (it.kind === 'task') { currentPage = 'page4'; return enterApp(it.band); }
          currentPage = it.gig ? 'page3' : 'page2'; if (it.gig) gigsOpen.add(it.ev.id + '|' + hubCalSel); enterApp(it.band);
        });
        list.append(r);
      });
    }
    box.append(opts, head, grid, list);
  }
  // ---- Persönliche Übersicht: Termine und Checklisten-Punkte aus allen Bands
  async function loadHubAgenda() {
    const ids = bandIdsOf(profile), today = dOnly(new Date()), until = addDays(today, 60);
    const ag = $('hubAgendaList'), tk = $('hubTaskList');
    ag.innerHTML = ''; tk.innerHTML = ''; ag.append(el('div', 'mnote', 'Wird geladen …')); hubRaw = {};
    const events = [], tasks = [], gigs = [], gigUntil = addDays(today, 366);
    await Promise.all(ids.map(async id => {
      try {
        const snap = await db.collection(`calendar/${id}/events`).get();
        snap.docs.forEach(d => {
          const ev = { id: d.id, ...d.data() };
          (hubRaw[id] = hubRaw[id] || []).push(ev);
          if (ev.date && ev.kind !== 'checklist') occurrences(ev, today, until).forEach(dt => events.push({ band: id, ev, date: dt }));
          if (ev.date && ev.kind !== 'checklist' && ev.category === 'auftritt') occurrences(ev, today, gigUntil).forEach(dt => gigs.push({ band: id, ev, date: dt }));
          // eigene, offene Checklisten-Punkte
          Object.entries(ev.checklists || {}).forEach(([dk, list]) => {
            const when = dk === '_' ? (ev.kind === 'checklist' && ev.date ? parseKey(ev.date) : null) : parseKey(dk);
            if (when && when < today) return;
            (list || []).forEach(r => {
              const items = r.items || [];
              items.forEach(i => { if (!i.done && (i.members || []).includes(uid)) tasks.push({ band: id, ev, when, title: i.title, reiter: r.title }); });
              const rDone = items.length ? items.every(i => i.done) : !!r.done;
              if (!rDone && (r.members || []).includes(uid) && !items.some(i => (i.members || []).includes(uid) && !i.done)) tasks.push({ band: id, ev, when, title: r.title, reiter: '' });
            });
          });
        });
      } catch (e) {}
    }));
    hubCalLoad(); hubEvRender();
    const c = ovCfg();
    const bandLabel = id => { const b = bands[id], wrap = el('span', 'ag-band'); wrap.append(b ? b.name : 'Band'); if (b && b.tag && showOf(b).tag) wrap.append(tagChip(b.tag)); return wrap; };
    { const now = Date.now(), p2 = n => String(n).padStart(2, '0');
      const gone = x => { if (x.ev.allDay) return false; const e = x.ev.end || x.ev.start; if (!e) return false; const d = x.date; return new Date(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${e}:00`).getTime() < now; };
      for (let i = events.length - 1; i >= 0; i--) if (gone(events[i])) events.splice(i, 1);
      for (let i = gigs.length - 1; i >= 0; i--) if (gone(gigs[i])) gigs.splice(i, 1); }
    events.sort((a, b) => a.date - b.date || (a.ev.start || '').localeCompare(b.ev.start || ''));
    gigs.sort((a, b) => a.date - b.date || (a.ev.start || '').localeCompare(b.ev.start || ''));
    renderNextGig(gigs[0], bandLabel);
    ag.innerHTML = '';
    if (!events.length) ag.append(el('div', 'mnote', 'Keine anstehenden Termine.'));
    events.slice(0, 3).forEach(x => {
      const row = el('button', 'ag-row'); row.type = 'button';
      const isGig = x.ev.category === 'auftritt';
      row.append(el('span', 'ag-when', fmtDateOv(x.date, c.date) + (x.ev.allDay ? '' : ' · ' + fmtHHMM(x.ev.start, c.time))),
        (() => { const t = el('span', 'ag-what'); t.append(el('b', null, (isGig ? '🎤 ' : '📅 ') + (x.ev.title || 'Termin'))); if (x.ev.location) t.append(el('small', null, ' · ' + x.ev.location)); return t; })(),
        bandLabel(x.band));
      row.addEventListener('click', () => { currentPage = isGig ? 'page3' : 'page2'; if (isGig) { gigsOpen.add(x.ev.id + '|' + dKey(x.date)); } enterApp(x.band); if (isGig) setTimeout(() => scrollToCard('gigList', x.ev.id + '|' + dKey(x.date)), 300); });
      ag.append(row);
    });
    tasks.sort((a, b) => (a.when ? a.when.getTime() : 8.64e15) - (b.when ? b.when.getTime() : 8.64e15));
    if (!tasks.length) tk.append(el('div', 'mnote', 'Keine offenen Punkte – oder du hast noch keine übernommen.'));
    tasks.slice(0, 40).forEach(x => {
      const row = el('button', 'ag-row'); row.type = 'button';
      row.append(el('span', 'ag-when', x.when ? fmtDateOv(x.when, c.date) : 'ohne Datum'),
        (() => { const t = el('span', 'ag-what'); t.append(el('b', null, '☑️ ' + x.title)); t.append(el('small', null, ' · ' + [x.reiter, x.ev.title].filter(Boolean).join(' · '))); return t; })(),
        bandLabel(x.band));
      row.addEventListener('click', () => { currentPage = 'page4'; enterApp(x.band); });
      tk.append(row);
    });
  }
  function renderSideUser() {
    if (!$('appAvatar')) return;   // Profil liegt seit v0.3.1 nur noch auf der persönlichen Übersicht
    setAvatar($('appAvatar'), profile.name, profile.photo, { zoom: false });
    const an = $('appName'); an.innerHTML = ''; an.append(profile.name);
    bandIdsOf(profile).forEach(id => { const b = bands[id]; if (b && b.tag && showOf(b).tag) an.append(tagChip(b.tag)); });
    $('appRole').textContent = 'Profil und Bands';
  }
  function enterHub() {
    { const am = document.getElementById('alphaModal'); if (am) am.classList.add('hidden'); }
    if (typeof showTipsHint === 'function') showTipsHint();
    hideBandsOverview();
    inHub = true;
    const ids = bandIdsOf(profile);
    if (!ids.includes(currentBand)) currentBand = ids[0] || null;
    ls.sset('bandLoggedIn', '1'); ls.sset('smView', 'hub');
    $('auth').classList.add('hidden');
    $('app').classList.remove('hidden'); $('app').classList.add('hub-mode');
    const bn = $('brandName'); bn.innerHTML = ''; bn.append('StageMate');
    $('brandSub').textContent = 'Startbildschirm';
    const lg = $('brandLogo'); lg.innerHTML = ''; lg.className = 'brand-logo'; lg.onclick = null; lg.appendChild(defaultLogo());
    { const hl = $('hubLogo'); hl.innerHTML = ''; hl.appendChild(defaultLogo()); }
    renderSideUser();
    applyNavOrder();
    ensurePuid();
    showPage('home');
    tickSideClock(); startPresence(); syncSidebar();
  }
  $('hubTips').addEventListener('click', () => $('tipsBtn').click());
  $('hubSupport').addEventListener('click', () => $('supportBtn').click());
  $('homeBtn').addEventListener('click', () => enterHub());
  $('onlineBtn').addEventListener('click', () => { if (inHub) return; showPage('overview'); setTimeout(() => $('ovMembers').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); });

  // ----- Registerkarten in der Seitenleiste auf- und zuklappen -----
  const applyNavFold = () => { const f = ls.get('navFolded') === '1'; $('nav').classList.toggle('folded', f); $('navFold').classList.toggle('folded', f); $('navFold').setAttribute('aria-expanded', String(!f)); };
  $('navFold').addEventListener('click', () => { ls.set('navFolded', ls.get('navFolded') === '1' ? '0' : '1'); applyNavFold(); });
  applyNavFold();

  // ================= Uhr und Datum oben links =================
  function tickSideClock() {
    if (!profile || $('app').classList.contains('hidden')) return;
    const c = ovCfg(), now = new Date(), t = $('scTime');
    if (c.face === 'analog') { t.classList.add('analog'); t.innerHTML = analogSvg(now); }
    else { t.classList.remove('analog'); t.textContent = fmtTimeOv(now, c.time, true); }
    $('scDate').textContent = fmtDateOv(now, c.date);
    if (inHub) { $('hubTime').textContent = fmtTimeOv(now, c.time, true); $('hubDate').textContent = fmtDateOv(now, c.date); }
  }
  setInterval(tickSideClock, 1000);

  // ================= Online-Status =================
  // presence/<uid> { online, since, lastSeen } – alle 60 s aktualisiert, solange StageMate offen ist
  const PRES_TTL = 400000, PRES_EVERY = 180000;
  let presSince = Date.now(), presTimer = null, lastBeat = 0;
  const presCache = {}, bandMembersCache = {};
  async function loadBandMembers(bid, force) {
    if (force || !bandMembersCache[bid]) {
      try {
        const q = await db.collection('members').where('bandIds', 'array-contains', bid).get();
        bandMembersCache[bid] = q.docs.map(d => ({ uid: d.id, ...d.data() })).filter(m => isActiveIn(m, bid, bands[bid].cfg));
      } catch (e) {}
    }
    return bandMembersCache[bid] || [];
  }
  // Eigener Status: auto (Übersicht = Privat, Bandseite = Online) | online | private | offline
  let myStatus = ls.get('myStatus') || 'auto', offSince = Date.now();
  const effStatus = () => myStatus === 'auto' ? (inHub ? 'private' : 'online') : myStatus;
  async function beat(state = 'online') {
    if (!db || !uid || readOnly || !profile) return;
    lastBeat = Date.now();
    const eff = state === 'online' ? effStatus() : 'offline';
    // "Offline" (selbst gewählt): kein Lebenszeichen, "zuletzt online" bleibt beim Zeitpunkt des Wechsels
    const seen = eff === 'offline' && state === 'online' ? offSince : Date.now();
    try { await db.doc('presence/' + uid).set({ online: eff !== 'offline', private: eff === 'private', since: presSince, lastSeen: seen }); } catch (e) {}
    renderStatusBtn();
  }
  const ST_TXT = { online: 'Online', private: 'Privat', offline: 'Offline' };
  function renderStatusBtn() {
    const b = $('statusBtn'); if (!b) return;
    const eff = effStatus();
    b.classList.remove('on', 'priv', 'off'); b.classList.add(eff === 'online' ? 'on' : eff === 'private' ? 'priv' : 'off');
    $('statusTxt').textContent = ST_TXT[eff] + (myStatus === 'auto' ? ' · auto' : '');
    b.title = 'Dein Status: ' + ST_TXT[eff] + (myStatus === 'auto' ? ' (automatisch)' : '') + ' – klicken zum Ändern';
    document.querySelectorAll('#statusMenu [data-st]').forEach(x => x.classList.toggle('on', x.dataset.st === myStatus));
  }
  $('statusBtn').addEventListener('click', e => { e.stopPropagation(); const m = $('statusMenu'), open = m.classList.toggle('hidden') === false; $('statusBtn').setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', e => { if (!e.target.closest('.st-wrap')) { $('statusMenu').classList.add('hidden'); $('statusBtn').setAttribute('aria-expanded', 'false'); } });
  document.querySelectorAll('#statusMenu [data-st]').forEach(x => x.addEventListener('click', () => {
    const was = effStatus();
    myStatus = x.dataset.st; ls.set('myStatus', myStatus);
    if (effStatus() === 'offline' && was !== 'offline') offSince = Date.now();
    if (was === 'offline' && effStatus() !== 'offline') presSince = Date.now();
    $('statusMenu').classList.add('hidden');
    beat(); refreshOnline();
    flash('Dein Status: ' + ST_TXT[effStatus()]);
  }));
  function startPresence() {
    if (!presTimer) { presSince = Date.now(); beat(); presTimer = setInterval(() => { if (!document.hidden) { beat(); refreshOnline(); } }, PRES_EVERY); }
    else beat();   // Wechsel Startbildschirm <-> Band sofort melden (Privat / Online)
    refreshOnline();
  }
  function stopPresence() { if (presTimer) { clearInterval(presTimer); presTimer = null; beat('offline'); } }
  document.addEventListener('visibilitychange', () => {
    if (!presTimer) return;
    if (document.hidden) beat('away');
    else { if (Date.now() - lastBeat > PRES_TTL) presSince = Date.now(); beat(); refreshOnline(); }
  });
  window.addEventListener('pagehide', () => { if (presTimer) beat('offline'); });
  const isOnline = p => !!p && p.online && Date.now() - (p.lastSeen || 0) < PRES_TTL;
  const isPrivate = p => isOnline(p) && !!p.private;   // online, aber auf dem persönlichen Startbildschirm
  async function refreshOnline(force) {
    if (!currentBand || inHub || !bands[currentBand]) return renderOnline();
    const bid = currentBand;
    try {
      await loadBandMembers(bid, force);
      await Promise.all(bandMembersCache[bid].map(async m => {
        if (m.uid === uid) { const eff = effStatus(); presCache[uid] = { online: eff !== 'offline', private: eff === 'private', since: presSince, lastSeen: eff === 'offline' ? offSince : Date.now() }; return; }
        try { const s = await db.doc('presence/' + m.uid).get(); presCache[m.uid] = s.exists ? s.data() : null; } catch (e) {}
      }));
    } catch (e) {}
    renderOnline();
  }
  function renderOnline() {
    const ob = $('onlineBtn');
    ob.classList.toggle('is-private', inHub);
    if (inHub) { $('onlineTxt').textContent = 'Privat'; ob.title = 'Du bist auf deinem persönlichen Startbildschirm – deine Bands sehen dich als „Privat“.'; ob.classList.remove('has-on'); return; }
    ob.title = 'Mitglieder online – zur Übersicht';
    const ms = (currentBand && bandMembersCache[currentBand]) || [];
    const on = ms.filter(m => isOnline(presCache[m.uid]) && !isPrivate(presCache[m.uid])).length;
    $('onlineTxt').textContent = ms.length ? `${on} / ${ms.length} online` : '– online';
    $('onlineBtn').classList.toggle('has-on', on > 0);
    if (currentPage === 'overview') renderOvMembers();
  }
  // Übersicht: Mitglieder mit Online-Status, sortierbar
  let ovmSort = ls.get('ovmSort') || 'name', ovmDir = ls.get('ovmDir') || 'asc';
  const roleRank = m => isFounder(currentBand, m.uid) ? 0 : (r => r.includes('Organisation') ? 1 : r.includes(CL_ROLE) ? 2 : 3)(memberRoles(m, currentBand));
  function whenText(ms) {
    if (!ms) return '';
    const d = new Date(ms), c = ovCfg(), t = fmtTimeOv(d, c.time, false), today = dOnly(new Date());
    if (sameDay(d, today)) return 'heute ' + t;
    if (sameDay(d, addDays(today, -1))) return 'gestern ' + t;
    return fmtDateOv(d, c.date) + ' ' + t;
  }
  function renderOvMembers() {
    const box = $('ovmList'); if (!box) return; box.innerHTML = '';
    document.querySelectorAll('#ovmSort [data-ms]').forEach(b => b.classList.toggle('on', b.dataset.ms === ovmSort));
    $('ovmDir').textContent = ovmDir === 'asc' ? '↑ aufsteigend' : '↓ absteigend';
    const ms = (bandMembersCache[currentBand] || []).slice();
    if (!ms.length) { box.append(el('div', 'mnote', 'Mitglieder werden geladen …')); return; }
    const dir = ovmDir === 'asc' ? 1 : -1;
    const tOf = m => { const p = presCache[m.uid]; return p ? (isOnline(p) ? (p.since || 0) : (p.lastSeen || 0)) : 0; };
    const cmp = (a, b) => {
      let r = 0;
      if (ovmSort === 'role') r = roleRank(a) - roleRank(b);
      else if (ovmSort === 'time') r = tOf(a) - tOf(b);
      return (r || (a.name || '').localeCompare(b.name || '', 'de', { sensitivity: 'base' })) * dir;
    };
    const pOf = m => presCache[m.uid];
    const groups = [['Online', ms.filter(m => isOnline(pOf(m)) && !isPrivate(pOf(m)))], ['Privat', ms.filter(m => isPrivate(pOf(m)))], ['Offline', ms.filter(m => !isOnline(pOf(m)))]];
    groups.forEach(([title, list]) => {
      if (title === 'Privat' && !list.length) return;
      box.append(el('div', 'ovm-group' + (title === 'Online' ? ' on' : title === 'Privat' ? ' priv' : ''), `${title} · ${list.length}`));
      if (!list.length) box.append(el('div', 'mnote', title === 'Online' ? 'Gerade ist niemand online.' : 'Alle sind online.'));
      list.sort(cmp).forEach(m => {
        const row = el('div', 'ovm-row');
        const av = el('div', 'avatar');
        setAvatar(av, m.name, typeof m.photo === 'string' ? m.photo : null, { locked: photoLocked(m) });
        const tx = el('div', 'ovm-tx');
        const nm = el('div', 'ovm-name', m.name || 'Unbekannt');
        if (isFounder(currentBand, m.uid)) nm.append(el('span', 'admin-badge', 'Admin'));
        if (m.uid === uid) nm.append(el('span', 'ovm-me', 'Du'));
        const roles = memberRoles(m, currentBand);
        tx.append(nm, el('div', 'ovm-roles', roles.length ? roles.join(' · ') : 'Keine Rolle'));
        const p = presCache[m.uid], on = isOnline(p), pv = isPrivate(p);
        const st = el('div', 'ovm-st' + (pv ? ' priv' : on ? ' on' : ''), pv ? `● Privat seit ${whenText(p.since)}` : on ? `● online seit ${whenText(p.since)}` : (p && p.lastSeen ? `zuletzt online: ${whenText(p.lastSeen)}` : 'noch nie online'));
        row.append(av, tx, st); box.append(row);
      });
    });
  }
  document.querySelectorAll('#ovmSort [data-ms]').forEach(b => b.addEventListener('click', () => {
    if (ovmSort === b.dataset.ms) ovmDir = ovmDir === 'asc' ? 'desc' : 'asc'; else ovmSort = b.dataset.ms;
    ls.set('ovmSort', ovmSort); ls.set('ovmDir', ovmDir); renderOvMembers();
  }));
  $('ovmDir').addEventListener('click', () => { ovmDir = ovmDir === 'asc' ? 'desc' : 'asc'; ls.set('ovmDir', ovmDir); renderOvMembers(); });

  let suppressNavClick = false;
  let lastNavDrag = 0;
  document.querySelectorAll('.sidebar [data-page]').forEach(btn => btn.addEventListener('click', () => {
    if (suppressNavClick) { suppressNavClick = false; return; }
    if (inHub && (btn.dataset.page === 'profile' || btn.dataset.page === 'settings')) return openHubSection(btn.dataset.page);
    if (inHub && btn.closest('#nav')) {
      const ids = bandIdsOf(profile);
      if (!ids.length) return flash('Tritt zuerst einer Band bei oder gründe eine.', true);
      currentPage = btn.dataset.page; enterApp(ids.includes(profile.lastBand) ? profile.lastBand : ids[0]); return;
    }
    showPage(btn.dataset.page);
  }));

  // ================= Registerkarten verschieben (Drag & Drop, auch per Touch) =================
  const nav = $('nav');
  function applyNavOrder() {
    const order = (profile && Array.isArray(profile.navOrder)) ? profile.navOrder : [];
    const items = [...nav.querySelectorAll(':scope > .nav-item[data-page]')];
    const rank = id => { const i = order.indexOf(id); return i < 0 ? 1000 + items.findIndex(x => x.dataset.page === id) : i; };
    items.sort((a, b) => rank(a.dataset.page) - rank(b.dataset.page)).forEach(x => nav.appendChild(x));
  }
  async function saveNavOrder() {
    if (!profile || readOnly) return;
    const order = [...nav.querySelectorAll(':scope > .nav-item[data-page]')].map(x => x.dataset.page);
    if (JSON.stringify(order) === JSON.stringify(profile.navOrder || [])) return;
    profile.navOrder = order;
    try { await db.doc('members/' + uid).set(clone(profile)); } catch (e) { flash('Reihenfolge konnte nicht gespeichert werden', true); }
  }
  let drag = null;
  nav.addEventListener('pointerdown', e => {
    const item = e.target.closest('.nav-item[data-page]');
    if (!item || e.button > 0) return;
    drag = { item, startY: e.clientY, offset: 0, active: false, id: e.pointerId };
  });
  nav.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) < 6) return;
      drag.active = true;
      drag.item.classList.add('dragging');
      nav.classList.add('sorting');
      try { drag.item.setPointerCapture(e.pointerId); } catch (err) {}
    }
    e.preventDefault();
    let y = dy - drag.offset;
    // Nachbarn tauschen, sobald die Mitte überschritten ist
    const visible = el => el && !el.classList.contains('hidden');
    let prev = drag.item.previousElementSibling; while (prev && !visible(prev)) prev = prev.previousElementSibling;
    let next = drag.item.nextElementSibling; while (next && !visible(next)) next = next.nextElementSibling;
    if (prev && y < -prev.offsetHeight / 2) { nav.insertBefore(drag.item, prev); drag.offset -= prev.offsetHeight + 2; y = dy - drag.offset; }
    else if (next && y > next.offsetHeight / 2) { nav.insertBefore(next, drag.item); drag.offset += next.offsetHeight + 2; y = dy - drag.offset; }
    drag.item.style.transform = `translateY(${y}px)`;
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (drag.active) {
      drag.item.style.transform = '';
      drag.item.classList.remove('dragging');
      nav.classList.remove('sorting');
      suppressNavClick = true;
      lastNavDrag = Date.now();
      setTimeout(() => { suppressNavClick = false; }, 0);
      saveNavOrder();
    }
    drag = null;
  }
  nav.addEventListener('pointerup', endDrag);
  nav.addEventListener('pointercancel', endDrag);

  // ================= Einstellungen: Hell / Dunkel =================
  const darkMq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  let themePref = ls.get('bandTheme') || 'system';
  let setDraft = null;   // offene, noch nicht gespeicherte Einstellungen
  // ----- Mauszeiger (pro Browser) -----
  const CURSORS = [
    { id: 'middle', label: 'Mittelfinger', emoji: '🖕', hot: [16, 3] },
    { id: 'index', label: 'Zeigefinger', emoji: '👆', hot: [12, 3] },
    { id: 'rock', label: 'Rockhand', emoji: '🤘', hot: [10, 3] },
    { id: 'crosshair', label: 'Fadenkreuz', emoji: '✛' },
    { id: 'default', label: 'Mauszeiger', emoji: '➚' },
  ];
  let cursorPref = 'default';   // Standard: normaler Mauszeiger, bis etwas anderes gewählt und gespeichert wird
  try { const c = ls.get('bandCursor'); if (CURSORS.some(x => x.id === c)) cursorPref = c; } catch (e) {}
  const cursorCache = {};
  // Hände: Emoji zeichnen, dann weiss einfärben (Schattierung bleibt) und dunkel umranden
  // Hände als eigene Zeichnung: weiss mit dunklen Konturlinien zwischen den Fingern
  const HAND_SVG = {
    '🖕': '<rect x="22" y="15.5" width="4" height="6.5" rx="2"/><rect x="8.5" y="13.5" width="5.4" height="8" rx="2.7"/><rect x="18.1" y="13.5" width="5.4" height="8" rx="2.7"/><path d="M8.5 18h18v5a6 6 0 0 1-6 6h-6.5a5.5 5.5 0 0 1-5.5-5.5z"/><rect x="13.4" y="2.5" width="5.2" height="17" rx="2.6"/><path class="ln" d="M8.8 21.6c3.2-.2 6.4.2 8.6 1.3"/><path class="ln" d="M14.6 5.6h2.8"/>',
    '👆': '<rect x="22.6" y="15.5" width="3.8" height="6.5" rx="1.9"/><rect x="19" y="14" width="4.4" height="7.5" rx="2.2"/><rect x="15" y="13" width="4.6" height="8" rx="2.3"/><path d="M9 18h17.4v5a6 6 0 0 1-6 6h-5.6A5.8 5.8 0 0 1 9 23.2z"/><path d="M10 20.2c-2.6-.4-4.8.7-4.8 2.6 0 1.6 1.6 2.6 3.8 2.7"/><rect x="10" y="2.5" width="5.2" height="17" rx="2.6"/><path class="ln" d="M11.2 5.6h2.8"/>',
    '🤘': '<rect x="12.5" y="14" width="4.4" height="7" rx="2.2"/><rect x="16.3" y="14" width="4.4" height="7" rx="2.2"/><path d="M7.8 18h17.2v5a6 6 0 0 1-6 6h-5.4a5.8 5.8 0 0 1-5.8-5.8z"/><rect x="8" y="3" width="4.8" height="16.5" rx="2.4"/><rect x="20.4" y="5.5" width="4.4" height="14" rx="2.2"/><path class="ln" d="M9.2 22.6c2.6-1.4 6.2-1.7 9.4-.6"/><path class="ln" d="M9.2 6h2.4M21.4 8.4h2.4"/>',
  };
  function emojiCursorUrl(emoji) {
    if (cursorCache[emoji]) return cursorCache[emoji];
    const body = HAND_SVG[emoji]; if (!body) return null;
    // Linienstil wie die Symbole der Registerkarten: dünne, runde Linien; weisser Saum, damit er auf jedem Hintergrund sichtbar ist
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${body}</g><g fill="#fff" stroke="#15161c" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${body}</g><style>.ln{fill:none}</style></svg>`;
    return (cursorCache[emoji] = 'data:image/svg+xml;base64,' + btoa(svg));
  }
  // Fadenkreuz: Kreis mit Kreuz, weiss mit dunklem Rand
  function crosshairUrl() {
    if (cursorCache.__cross) return cursorCache.__cross;
    const body = '<circle cx="16" cy="16" r="9"/><path d="M16 3v8M16 21v8M3 16h8M21 16h8"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round">${body}</g><g fill="none" stroke="#15161c" stroke-width="1.6" stroke-linecap="round">${body}</g><circle cx="16" cy="16" r="1.5" fill="#15161c"/></svg>`;
    return (cursorCache.__cross = 'data:image/svg+xml;base64,' + btoa(svg));
  }
  const CURSOR_ICONS = {
    crosshair: '<svg viewBox="0 0 32 32" class="co-svg"><circle cx="16" cy="16" r="9"/><path d="M16 3v8M16 21v8M3 16h8M21 16h8"/><circle cx="16" cy="16" r="1.3" class="dot"/></svg>',
    default: '<svg viewBox="0 0 32 32" class="co-svg"><path d="M9 4v19l5-4.6 3.4 7.8 3-1.3-3.4-7.7h6.8z"/></svg>',
  };
  const handIcon = emoji => `<svg viewBox="0 0 32 32" class="co-svg hand">${HAND_SVG[emoji]}</svg>`;
  function applyCursor() {
    const pref = (setDraft && setDraft.cursor) || cursorPref;
    let st = document.getElementById('cursorStyle');
    if (!st) { st = document.createElement('style'); st.id = 'cursorStyle'; document.head.appendChild(st); }
    const keepText = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea, [contenteditable="true"] { cursor: text !important; }';
    if (pref === 'default') { st.textContent = `html, html * { cursor: default !important; } ${keepText}`; return; }
    if (pref === 'crosshair') { const u = crosshairUrl(); st.textContent = u ? `html, html * { cursor: url("${u}") 16 16, crosshair !important; } ${keepText}` : `html, html * { cursor: crosshair !important; } ${keepText}`; return; }
    const c = CURSORS.find(x => x.id === pref); const url = c && emojiCursorUrl(c.emoji);
    st.textContent = url ? `html, html * { cursor: url("${url}") ${c.hot[0]} ${c.hot[1]}, auto !important; } ${keepText}` : '';
  }
  applyCursor();
  function renderCursorOptions() {
    const box = $('cursorOptions'); if (!box) return;
    box.innerHTML = '';
    const cur = (setDraft && setDraft.cursor) || cursorPref;
    CURSORS.forEach(o => {
      const b = el('button', 'cursor-opt' + (cur === o.id ? ' on' : '')); b.type = 'button';
      const ic = el('span', 'co-ic');
      ic.innerHTML = CURSOR_ICONS[o.id] || handIcon(o.emoji);
      b.append(ic, el('span', 'co-t', o.label));
      b.addEventListener('click', () => { settingsDraft().cursor = o.id; applyCursor(); renderCursorOptions(); updateDirty(); });
      box.appendChild(b);
    });
  }
  // Vorschau: eine noch nicht gespeicherte Wahl wird schon angezeigt
  const effTheme = () => setDraft ? setDraft.theme : themePref;
  function applyTheme() {
    const pref = effTheme();
    const dark = pref === 'dark' || (pref === 'system' && darkMq && darkMq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('on', b.dataset.themeOpt === pref));
  }
  document.querySelectorAll('.theme-opt').forEach(b => b.addEventListener('click', () => {
    settingsDraft().theme = b.dataset.themeOpt; applyTheme(); updateDirty();
  }));
  if (darkMq) { const h = () => { if (effTheme() === 'system') applyTheme(); }; darkMq.addEventListener ? darkMq.addEventListener('change', h) : darkMq.addListener(h); }
  applyTheme();

  // ================= Verwaltung =================
  let draft = null;        // Arbeitskopie der Band-Einstellungen (nur Admins)
  let draftBand = null;    // zu welcher Band die Arbeitskopie gehört
  let draftName = '', draftGenre = '';
  let savedSnap = '';
  let members = [];
  let addRolesSet = new Set();

  // ----- Ansicht aus Sicht eines Mitglieds -----
  let vaCandidates = [];
  function buildCandidates() {
    const b = bands[currentBand];
    vaCandidates = members
      .filter(m => m.uid !== uid && !isAdminUid(currentBand, m.uid) && isActiveIn(m, currentBand, b.cfg))
      .sort((x, y) => (x.name || '').localeCompare(y.name || ''))
      .map(m => ({ key: 'm:' + m.uid, uid: m.uid, name: m.name || 'Unbekannt', roles: memberRoles(m, currentBand, b.cfg) }));
    // Noch nicht registrierte Personen: für sie gelten die Standard-Berechtigungen
    const claimed = new Set(members.map(m => m.memberships && m.memberships[currentBand] && m.memberships[currentBand].entry).filter(Boolean));
    Object.entries(b.cfg.extra || {})
      .filter(([id]) => !claimed.has(id))
      .sort((x, y) => (x[1].name || '').localeCompare(y[1].name || ''))
      .forEach(([id, e]) => vaCandidates.push({
        key: 'e:' + id, uid: null, pending: true, name: e.name || 'Unbekannt',
        roles: (e.roles || []).filter(r => b.cfg.roles.includes(r)),
      }));
    vaCandidates.push({ key: 'new', uid: null, name: 'Neues Mitglied (Standard)', roles: [] });
  }
  function fillSelect(sel, value) {
    sel.innerHTML = '';
    vaCandidates.forEach((c, i) => {
      const o = el('option', null, c.name + (c.pending ? ' (nicht registriert)' : '') + (c.roles.length ? ' – ' + c.roles.join(', ') : ''));
      o.value = String(i); sel.appendChild(o);
    });
    const idx = vaCandidates.findIndex(c => value && c.key === value.key);
    sel.value = String(idx >= 0 ? idx : 0);
  }
  function renderViewAs() {
    const on = !!viewAs;
    $('viewAsBar').classList.toggle('hidden', !on);
    if (!on) $('previewWarn').classList.add('hidden');
    if (on) { $('vaRole').textContent = viewAs.name + (viewAs.pending ? ' (noch nicht registriert)' : ''); fillSelect($('vaSwitch'), viewAs); }
    if (currentBand && bands[currentBand]) fillSelect($('vaPick'), null);
  }
  function startViewAs(idx) {
    const c = vaCandidates[Number(idx)];
    if (!realIsAdmin(currentBand) || !c) return;
    viewAs = c;
    renderViewAs();
    renderAppHeader();
    showPage(currentPage === 'team' ? 'overview' : currentPage);
  }
  function stopViewAs() {
    viewAs = null;
    renderViewAs();
    renderAppHeader();
    showPage('team');
  }
  $('vaStart').addEventListener('click', () => startViewAs($('vaPick').value));
  $('vaSwitch').addEventListener('change', e => startViewAs(e.target.value));
  $('vaStop').addEventListener('click', stopViewAs);

  let draftTag = '', draftShow = { ...SHOW_DEFAULT };
  const snapOf = (cfg, name) => JSON.stringify({ r: cfg.roles, a: cfg.access, s: cfg.assignments, x: cfg.extra, ad: cfg.admins, rm: cfg.removed, c: cfg.categories, lg: cfg.logo || null, n: name, tg: draftTag, sh: draftShow, gn: draftGenre });
  const isDirty = () => !viewAs && !!draft && draftBand === currentBand && canRoles(currentBand) && snapOf(draft, draftName) !== savedSnap;
  function updateDirty() {
    const t = isDirty(), p = isProfileDirty(), st = isSettingsDirty();
    $('unsavedBar').classList.toggle('hidden', !(t || p || st));
    const names = [t && '„Verwaltung“', p && '„Profil & Bands“', st && '„Einstellungen“'].filter(Boolean);
    $('ubWhere').textContent = names.length > 1 ? names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1] : (names[0] || '');
    const target = t && currentPage !== 'team' ? 'team' : p && currentPage !== 'profile' ? 'profile' : st && currentPage !== 'settings' ? 'settings' : null;
    $('ubOpen').classList.toggle('hidden', !target);
    $('ubOpen').dataset.target = target || '';
  }
  function resetDraft() {
    const band = bands[currentBand];
    draft = normCfg(band.cfg);
    draft.admins = [...band.cfg.admins];
    draftBand = currentBand;
    draftName = band.name;
    draftTag = band.tag || ''; draftShow = showOf(band); draftGenre = band.genre || '';
    savedSnap = snapOf(draft, draftName);
  }
  function discardDraft() { draft = null; draftBand = null; updateDirty(); }

  async function openTeam() {
    const band = bands[currentBand];
    const admin = isAdmin(currentBand);
    const rolesMgr = canRoles(currentBand);
    const hasOpenChanges = !!draft && draftBand === currentBand && snapOf(draft, draftName) !== savedSnap;
    if (!hasOpenChanges) resetDraft();
    const preview = !!viewAs;
    document.querySelectorAll('#teamAdminOnly .admin-actions').forEach(x => x.classList.toggle('hidden', preview));
    $('aNewRole').readOnly = preview;
    $('aNewRole').classList.toggle('pv-locked-input', preview);
    $('aAddRole').classList.toggle('pv-locked', preview);
    $('previewNote').classList.toggle('hidden', !(preview && canRoles(currentBand)));
    $('teamAdminOnly').classList.toggle('hidden', !rolesMgr);
    $('dissolvePanel').classList.add('hidden');
    $('bandNamePanel').classList.toggle('hidden', !admin);
    $('viewAsPanel').classList.toggle('hidden', !admin);
    $('teamAddPanel').classList.toggle('hidden', !admin);
    $('slWordsPanel').classList.toggle('hidden', !admin);
    if (admin) { if (slCfg[currentBand]) renderSlWords(); else slLoadCfg(currentBand).then(renderSlWords); }
    $('tHint').textContent = !admin
      ? (rolesMgr ? 'Mit der Rolle „Organisation“ kannst du festlegen, wer welche Rollen hat, und die verfügbaren Rollen bearbeiten.' : 'Hier siehst du, wer in der Band welche Rolle hat.')
      : isFounder(currentBand)
        ? 'Lege fest, wer welche Rollen hat und was jedes Mitglied in den Registern darf (sehen, lesen, bearbeiten).'
        : 'Lege fest, wer welche Rollen hat und was jedes Mitglied in den Registern darf.';
    if (rolesMgr) { setMsg($('aMsg'), ''); renderRoleEditor(); renderCatEditor(); }
    renderLogoPanel();
    if (admin) {
      $('aBandName').value = draftName; $('aGenre').value = draftGenre; genreHint();
      mountTagEditor($('aTagEditor'), { getName: () => draftName, getTag: () => draftTag, setTag: v => { draftTag = v; updateDirty(); }, bandId: () => currentBand });
      { const left = tagCooldownLeft(band); $('aTagEditor')._note(left > 0 ? `Der Tag kann in ${Math.ceil(left / 60000)} Min. wieder geändert werden.` : ''); }
      [['aShowLogo', 'logo'], ['aShowName', 'name'], ['aShowTag', 'tag']].forEach(([id, k]) => { $(id).checked = draftShow[k] !== false; });
      addBulb($('aShowLogo').closest('.field').querySelector('.flabel'), 'brand', 'Sichtbarkeit der Band');
      addBulb($('aTagEditor').closest('.field').querySelector('.flabel'), 'tag', 'Band-Tag');
      renderAddForm();
    }
    renderMembers(true);
    try { members = await loadMembers(currentBand); } catch (e) { members = []; }
    if (currentPage !== 'team') return;
    if (admin) { buildCandidates(); renderViewAs(); }
    renderMembers(false);
    updateDirty();
    $('dzConfirm').classList.add('hidden'); setMsg($('dzMsg'), '');
    if (rolesMgr) { try { await loadDissolve(); } catch (e) { dzBand = currentBand; } }
    if (currentPage === 'team') renderDissolve();
  }

  const draftIsAdmin = who => who === bands[currentBand].createdBy || draft.admins.includes(who);
  function sortedMembers() {
    const f = bands[currentBand].createdBy;
    return members.filter(m => isActiveIn(m, currentBand, draft)).sort((a, b) =>
      (b.uid === f) - (a.uid === f) || draftIsAdmin(b.uid) - draftIsAdmin(a.uid) || (a.name || '').localeCompare(b.name || ''));
  }
  // Vom Admin hinzugefügte Personen, die sich noch nicht registriert haben
  function openEntries() {
    const claimed = new Set(members.map(m => m.memberships && m.memberships[currentBand] && m.memberships[currentBand].entry).filter(Boolean));
    return Object.entries(draft.extra).filter(([id]) => !claimed.has(id)).map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  function roleChipEditor(selected, onChange, locked, readonly) {
    const set = new Set(selected);
    const chips = el('div', 'chips');
    draft.roles.forEach(r => {
      const b = el('button', 'chip' + (set.has(r) ? ' on' : ''), r);
      b.type = 'button';
      if (readonly && !(locked && locked.includes(r))) { b.classList.add('pv-locked'); b.addEventListener('click', previewBlocked); chips.appendChild(b); return; }
      if (locked && locked.includes(r) && readonly) { b.classList.add('locked'); b.addEventListener('click', previewBlocked); chips.appendChild(b); return; }
      if (locked && locked.includes(r)) { b.disabled = true; b.classList.add('locked'); b.title = 'Kann nur von einem anderen berechtigten Mitglied entfernt werden'; chips.appendChild(b); return; }
      b.addEventListener('click', () => {
        set.has(r) ? set.delete(r) : set.add(r);
        b.classList.toggle('on');
        onChange(draft.roles.filter(x => set.has(x)));
      });
      chips.appendChild(b);
    });
    return chips;
  }

  // Aufgeklappte Einträge (bleiben beim Neuzeichnen erhalten)
  const expanded = new Set();
  function toggleCard(key, card) {
    if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
    card.classList.toggle('open', expanded.has(key));
    card.querySelector('.mcard-head').setAttribute('aria-expanded', expanded.has(key));
  }

  function makeCard(key, opts) {
    const card = el('div', 'mcard' + (opts.pending ? ' pending' : '') + (opts.isDefault ? ' is-default' : '') + (expanded.has(key) ? ' open' : ''));
    const head = el('button', 'mcard-head'); head.type = 'button';
    head.setAttribute('aria-expanded', expanded.has(key));
    const av = el('div', 'mavatar' + (opts.isDefault ? ' def' : ''), opts.isDefault ? '★' : initials(opts.name));
    if (opts.photo || opts.locked) setAvatar(av, opts.name, opts.photo, { locked: opts.locked });
    const info = el('div', 'minfo');
    const nm = el('div', 'mname', opts.name);
    (opts.badges || []).forEach(b => nm.appendChild(b));
    info.append(nm, el('div', 'msum', opts.summary || ''));
    const chev = el('span', 'mchev'); chev.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
    head.append(av, info, chev);
    head.addEventListener('click', () => toggleCard(key, card));
    const body = el('div', 'mcard-body');
    card.append(head, body);
    return { card, body };
  }
  function section(title, content) {
    const s = el('div', 'msec');
    s.append(el('div', 'msec-title', title));
    if (content) s.appendChild(content);
    return s;
  }
  function permGrid(getCur, defaultFor, onSet, allowDefault) {
    const g = el('div', 'perm-grid');
    REGISTERS.forEach(r => {
      const row = el('label', 'perm-row');
      row.append(el('span', null, r.title));
      row.appendChild(levelSelect(getCur(r.id), allowDefault, defaultFor(r.id), v => onSet(r.id, v)));
      g.appendChild(row);
    });
    return g;
  }
  function permSummary(m) {
    const parts = [];
    REGISTERS.forEach(r => {
      const o = draft.access.members[m.uid] && draft.access.members[m.uid][r.id];
      if (o) parts.push(`${r.title}: ${LEVELS[o]}`);
    });
    return parts.join(' · ');
  }

  // ----- Hinweis Pre-Alpha: erscheint jedes Mal, wenn der Anmeldebildschirm angezeigt wird -----
  const openAlpha = () => $('alphaModal').classList.remove('hidden');
  const closeAlpha = () => $('alphaModal').classList.add('hidden');
  $('alphaBadge').addEventListener('click', openAlpha);
  $('alphaOk').addEventListener('click', closeAlpha);
  $('alphaModal').addEventListener('click', e => { if (e.target === $('alphaModal')) closeAlpha(); });
  const authShown = () => !$('auth').classList.contains('hidden') && $('app').classList.contains('hidden');
  setTimeout(() => { if (authShown()) openAlpha(); }, 700);
  // auch nach Abmelden oder Auflösen der letzten Band
  new MutationObserver(() => { if (authShown() && $('alphaModal').classList.contains('hidden')) setTimeout(() => { if (authShown()) openAlpha(); }, 200); })
    .observe($('auth'), { attributes: true, attributeFilter: ['class'] });

  // ----- Beim Ankommen in der App: Hinweis auf die Tipps unten links (Knopf blinkt 3-mal) -----
  let tipsHintDone = false;
  function showTipsHint() {
    if (tipsHintDone) return; tipsHintDone = true;
    setTimeout(() => {
      if ($('app').classList.contains('hidden')) return;
      const btn = $('tipsBtn');
      const hint = el('div', 'tips-hint');
      hint.append(el('span', 'th-ic', '💡'), el('span', null, 'Tipps zu jeder Seite findest du unten links unter „Tipps“.'));
      const x = el('button', 'th-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Schliessen');
      hint.appendChild(x);
      document.body.appendChild(hint);
      const r = btn.getBoundingClientRect();
      const visible = r.width > 0 && r.right > 0 && r.left < window.innerWidth;
      if (visible) { hint.style.left = (r.right + 12) + 'px'; hint.style.top = (r.top + r.height / 2) + 'px'; hint.classList.add('arrow'); }
      else hint.classList.add('corner');
      btn.classList.remove('tips-blink'); void btn.offsetWidth; btn.classList.add('tips-blink');
      const close = () => { hint.classList.add('out'); setTimeout(() => hint.remove(), 250); btn.classList.remove('tips-blink'); };
      x.addEventListener('click', close);
      btn.addEventListener('click', close, { once: true });
      setTimeout(close, 6000);
    }, 600);
  }

  // ================= Übersicht: Fenster (Widgets) =================
  const OV_WIDGETS = [
    { id: 'band', title: 'Band' },
    { id: 'roles', title: 'Deine Rollen' },
    { id: 'clock', title: 'Uhr & Datum' },
    { id: 'gig', title: 'Dein nächster Gig' },
    { id: 'event', title: 'Dein nächster Termin' },
    { id: 'task', title: 'Dein nächster Checklisten-Punkt' },
    { id: 'timetable', title: 'Timetable des nächsten Gigs' },
  ];
  const DATE_FMTS = [
    { id: 'dmy', label: 'tt.mm.jj' },
    { id: 'mdy', label: 'mm.tt.jj' },
    { id: 'ymd', label: 'jj.mm.tt' },
  ];
  const ovDefaults = () => ({ show: { band: true, roles: true, clock: true, gig: true, event: true, task: true, timetable: true }, time: '24', face: 'digital', date: 'dmy', order: OV_WIDGETS.map(w => w.id) });
  // Einstellungen pro Person im Profil (overview); fehlende Werte mit Standard ergänzen
  function ovCfg() {
    const d = ovDefaults(), o = (profile && profile.overview) || {};
    const ord = Array.isArray(o.order) ? o.order.filter(id => OV_WIDGETS.some(w => w.id === id)) : [];
    OV_WIDGETS.forEach(w => { if (!ord.includes(w.id)) { const i = d.order.indexOf(w.id); ord.splice(Math.min(i, ord.length), 0, w.id); } });
    return { order: ord, show: { ...d.show, ...(o.show || {}) }, time: o.time === '12' ? '12' : '24', face: o.face === 'analog' ? 'analog' : 'digital', date: DATE_FMTS.some(x => x.id === o.date) ? o.date : 'dmy' };
  }
  async function ovSet(fn) {
    if (!profile) return;
    const c = ovCfg(); fn(c);
    profile.overview = c;
    renderOverview(); renderOvMenu();
    if (!readOnly) { try { await db.doc('members/' + uid).set(clone(profile)); } catch (e) { flash('Einstellung konnte nicht gespeichert werden', true); } }
  }
  const tzName = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unbekannt'; } catch (e) { return 'Unbekannt'; } };
  const tzOffset = (d = new Date()) => { const m = -d.getTimezoneOffset(); const sgn = m >= 0 ? '+' : '−'; const a = Math.abs(m); return `UTC${sgn}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`; };
  function fmtDateOv(d, f) {
    const dd = pad2(d.getDate()), mm = pad2(d.getMonth() + 1), yy = String(d.getFullYear()).slice(-2);
    if (f === 'mdy') return `${mm}.${dd}.${yy}`;
    if (f === 'ymd') return `${yy}.${mm}.${dd}`;
    return `${dd}.${mm}.${yy}`;
  }
  function fmtTimeOv(d, f, sec) {
    let h = d.getHours(); const m = pad2(d.getMinutes()), s2 = pad2(d.getSeconds());
    if (f === '12') { const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return `${h}:${m}${sec ? ':' + s2 : ''} ${ap}`; }
    return `${pad2(h)}:${m}${sec ? ':' + s2 : ''}`;
  }
  const fmtHHMM = (t, f) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return fmtTimeOv(d, f, false); };
  // Standort – nur wenn die Person die Berechtigung erteilt hat
  let ovLoc = null, ovLocState = 'unknown';   // unknown | granted | denied | prompt | unsupported
  async function ovCheckLocation(ask) {
    if (!navigator.geolocation) { ovLocState = 'unsupported'; return; }
    try {
      if (!ask && navigator.permissions) {
        const st = await navigator.permissions.query({ name: 'geolocation' });
        ovLocState = st.state;
        if (st.state !== 'granted') { renderOvMenu(); return; }
      }
    } catch (e) { if (!ask) { ovLocState = 'prompt'; return; } }
    navigator.geolocation.getCurrentPosition(pos => {
      ovLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy };
      ovLocState = 'granted'; renderOverview(); renderOvMenu();
    }, err => { ovLocState = err && err.code === 1 ? 'denied' : 'unavailable'; renderOvMenu(); if (ask) flash(ovLocState === 'denied' ? 'Standort nicht freigegeben' : 'Standort nicht verfügbar', true); }, { timeout: 10000, maximumAge: 600000 });
  }
  const locText = () => ovLoc ? `${Math.abs(ovLoc.lat).toFixed(3)}° ${ovLoc.lat >= 0 ? 'N' : 'S'}, ${Math.abs(ovLoc.lon).toFixed(3)}° ${ovLoc.lon >= 0 ? 'O' : 'W'}` : '';

  // nächste Einträge
  function ovNext(filter) {
    const now = new Date(), today = dOnly(now);
    const list = [];
    calEvents.filter(ev => ev.kind !== 'checklist' && filter(ev)).forEach(ev => occurrences(ev, today, addDays(today, 730)).forEach(d => {
      const start = new Date(d); if (!ev.allDay && ev.start) { const [h, m] = ev.start.split(':').map(Number); start.setHours(h, m); } else start.setHours(23, 59);
      if (start >= now || (ev.allDay && sameDay(d, today))) list.push({ ev, date: d, at: start });
    }));
    return list.sort((a, b) => a.at - b.at)[0] || null;
  }
  function ovNextTask() {
    const me = actorUid(); if (!me) return null;
    const today = dOnly(new Date());
    const out = [];
    clpItems().forEach(({ ev, date }) => {
      if (date && date < today) return;
      const list = (ev.checklists && ev.checklists[clDk(ev, date)]) || [];
      list.forEach(r => {
        const items = r.items || [];
        items.forEach(i => { if (!i.done && (i.members || []).includes(me)) out.push({ ev, date, title: i.title, reiter: r.title }); });
        const rDone = items.length ? items.every(i => i.done) : !!r.done;
        if (!rDone && (r.members || []).includes(me) && !items.some(i => (i.members || []).includes(me) && !i.done)) out.push({ ev, date, title: r.title, reiter: '' });
      });
    });
    return out.sort((a, b) => (a.date ? a.date.getTime() : 8.64e15) - (b.date ? b.date.getTime() : 8.64e15))[0] || null;
  }

  let ovTimer = null;
  function analogSvg(d) {
    const h = d.getHours() % 12, m = d.getMinutes(), sec = d.getSeconds();
    const hand = (deg, len, w, cls) => { const r = (deg - 90) * Math.PI / 180; return `<line class="${cls}" x1="50" y1="50" x2="${50 + len * Math.cos(r)}" y2="${50 + len * Math.sin(r)}" stroke-width="${w}" stroke-linecap="round"/>`; };
    let ticks = '';
    for (let i = 0; i < 12; i++) { const r = (i * 30 - 90) * Math.PI / 180; ticks += `<line class="an-tick" x1="${50 + 40 * Math.cos(r)}" y1="${50 + 40 * Math.sin(r)}" x2="${50 + (i % 3 ? 44 : 46) * Math.cos(r)}" y2="${50 + (i % 3 ? 44 : 46) * Math.sin(r)}" stroke-width="${i % 3 ? 1.5 : 2.5}"/>`; }
    return `<svg viewBox="0 0 100 100" class="an-clock"><circle cx="50" cy="50" r="48" class="an-face"/>${ticks}${hand(h * 30 + m / 2, 24, 4, 'an-h')}${hand(m * 6 + sec / 10, 34, 3, 'an-m')}${hand(sec * 6, 38, 1.2, 'an-s')}<circle cx="50" cy="50" r="2.5" class="an-c"/></svg>`;
  }
  function tickClock() {
    const box = $('ovClock'); if (!box) return;
    const c = ovCfg(), now = new Date();
    if (c.face === 'analog') { box.querySelector('.ov-face').innerHTML = analogSvg(now); box.querySelector('.ov-digi-small').textContent = fmtTimeOv(now, c.time, false); }
    else box.querySelector('.ov-face').textContent = fmtTimeOv(now, c.time, true);
    box.querySelector('.ov-date').textContent = fmtDateOv(now, c.date);
  }
  function ovCard(id, title, icon) {
    const card = el('div', 'ov-card ov-' + id);
    card.dataset.wid = id;
    const ic = el('span', 'ov-ic'); if (icon === 'stage') { ic.classList.add('svg'); ic.innerHTML = STAGE_SVG; } else ic.textContent = icon;
    const h = el('div', 'ov-card-h'); h.append(ic, el('span', null, title), el('span', 'ov-grip', '⠿'));
    card.appendChild(h);
    return card;
  }
  function renderOverview() {
    let box = $('ovWidgets'); if (!box || !profile || !currentBand) return;
    box.innerHTML = '';
    const c = ovCfg();
    const lv = r => levelFor(currentBand, r) !== 'hidden';
    const cards = {};
    const realBox = box;
    box = { appendChild: card => { cards[card.dataset.wid] = card; } };   // erst sammeln, dann in eigener Reihenfolge einsetzen
    if (c.show.band) {
      const card = ovCard('band', 'Band', '🎸');
      card.append(el('div', 'ov-title', bands[currentBand].name));
      card.append(el('div', 'ov-sub', 'Code ' + bands[currentBand].code));
      if (gigMembersBand !== currentBand) ensureGigMembers();
      const n = gigMembersBand === currentBand ? gigMembers.length : null;
      if (n) card.append(el('div', 'ov-sub', n === 1 ? '1 Mitglied' : n + ' Mitglieder'));
      box.appendChild(card);
    }
    if (c.show.roles) {
      const card = ovCard('roles', 'Deine Rollen', '🎭');
      const roles = viewAs ? viewAs.roles : rolesOf(profile, currentBand);
      const chips = el('div', 'ov-roles');
      (roles.length ? roles : ['–']).forEach(r => chips.appendChild(el('span', 'ov-role', r)));
      card.append(chips);
      box.appendChild(card);
    }
    if (c.show.clock) {
      const card = ovCard('clock', 'Uhr & Datum', '🕒'); card.id = 'ovClock';
      if (c.face === 'analog') card.classList.add('is-analog');
      card.append(el('div', 'ov-face' + (c.face === 'analog' ? ' analog' : '')));
      if (c.face === 'analog') card.append(el('div', 'ov-digi-small'));
      card.append(el('div', 'ov-date'));
      card.append(el('div', 'ov-meta', `Zeitzone: ${tzName()} (${tzOffset()})` + (ovLoc ? ` · Standort: ${locText()}` : '')));
      box.appendChild(card);
    }
    if (c.show.gig && lv('page3')) {
      const card = ovCard('gig', 'Dein nächster Gig', 'stage');
      const n = ovNext(ev => ev.category === 'auftritt');
      if (!n) card.append(el('div', 'ov-empty', 'Kein Gig geplant.'));
      else {
        card.append(el('div', 'ov-title', n.ev.title || 'Gig'),
          el('div', 'ov-when', `${fmtDateOv(n.date, c.date)}${n.ev.allDay ? '' : ' · ' + fmtHHMM(n.ev.start, c.time)}`),
          el('div', 'ov-sub', [relDays(n.date), n.ev.location].filter(Boolean).join(' · ')));
        const sc = n.ev.schedule || {};
        if (sc.getin) card.append(el('div', 'ov-sub', 'Get In ' + fmtHHMM(sc.getin, c.time)));
        const b = el('button', 'btn small ghost', 'Zum Gig →'); b.type = 'button';
        b.addEventListener('click', () => jumpToGig(n.ev.id + '|' + dKey(n.date), n.date));
        card.append(b);
      }
      box.appendChild(card);
    }
    if (c.show.event && lv('page2')) {
      const card = ovCard('event', 'Dein nächster Termin', '📅');
      const n = ovNext(ev => ev.category !== 'auftritt');
      if (!n) card.append(el('div', 'ov-empty', 'Kein Termin geplant.'));
      else {
        const cat = catOf(n.ev.category);
        const t = el('div', 'ov-title', n.ev.title || 'Termin');
        const tag = el('span', 'clp-cat', cat.name); tag.style.setProperty('--c', cat.color);
        card.append(t, el('div', 'ov-when', `${fmtDateOv(n.date, c.date)}${n.ev.allDay ? ' · ganztägig' : ' · ' + fmtHHMM(n.ev.start, c.time)}`));
        const sub = el('div', 'ov-sub'); sub.append(tag, ' ' + [relDays(n.date), n.ev.location].filter(Boolean).join(' · ')); card.append(sub);
        const b = el('button', 'btn small ghost', 'Im Kalender →'); b.type = 'button';
        b.addEventListener('click', () => { calSel = dOnly(n.date); calDate = dOnly(n.date); calView = 'day'; showPage('page2'); });
        card.append(b);
      }
      box.appendChild(card);
    }
    if (c.show.task && lv('page4')) {
      const card = ovCard('task', 'Dein nächster Checklisten-Punkt', '☑️');
      const n = ovNextTask();
      if (!n) card.append(el('div', 'ov-empty', 'Keine offenen Punkte, die du übernommen hast.'));
      else {
        card.append(el('div', 'ov-title', n.title || 'Punkt'),
          el('div', 'ov-sub', (n.reiter ? n.reiter + ' · ' : '') + (n.ev.title || 'Checkliste')),
          el('div', 'ov-when', n.date ? `${n.ev.kind === 'checklist' ? 'Deadline ' : ''}${fmtDateOv(n.date, c.date)} · ${relDays(n.date)}` : 'ohne Deadline'));
        const b = el('button', 'btn small ghost', 'Zur Checkliste →'); b.type = 'button';
        b.addEventListener('click', () => jumpToChecklist(n.ev.id + '|' + clDk(n.ev, n.date), n.date));
        card.append(b);
      }
      box.appendChild(card);
    }
    if (c.show.timetable && lv('page8')) {
      ttSub();
      const card = ovCard('timetable', 'Timetable nächster Gig', '⏱️');
      const todayK = dKey(dOnly(new Date()));
      const g = slGigs().find(e => e.date >= todayK && (ttMap[e.id] || { entries: [] }).entries.length);
      if (!g) card.append(el('div', 'ov-empty', 'Keine Timetable für kommende Gigs.'));
      else {
        card.append(el('div', 'ov-title', g.title || 'Gig'), el('div', 'ov-when', fmtDateOv(parseKey(g.date), c.date)));
        const ul = el('div', 'tt-ov');
        ttEntries(g.id).slice(0, 5).forEach(x => ul.append(el('div', 'tt-ov-row', fmtHHMM(x.time, c.time) + '  ' + ttName(x))));
        card.append(ul);
        const b = el('button', 'btn small ghost', 'Zur Timetable →'); b.type = 'button';
        b.addEventListener('click', () => { ttSel = g.id; showPage('page8'); });
        card.append(b);
      }
      box.appendChild(card);
    }
    box = realBox;
    c.order.forEach(id => { if (cards[id]) { box.appendChild(cards[id]); ovMakeDraggable(cards[id], box); } });
    if (!box.childNodes.length) box.appendChild(el('div', 'empty small', 'Alle Fenster sind ausgeblendet. Über „⚙ Anpassen“ schaltest du sie wieder ein.'));
    clearInterval(ovTimer);
    if (c.show.clock) { tickClock(); ovTimer = setInterval(() => { if (currentPage !== 'overview') { clearInterval(ovTimer); return; } tickClock(); }, 1000); }
  }
  // Fenster packen und verschieben (wie die Registerkarten); Reihenfolge im Profil speichern
  function ovMakeDraggable(card, grid) {
    let st = null;
    const NO = 'button, a, input, select, textarea, label';
    const cardsNow = () => [...grid.children].filter(x => x.classList.contains('ov-card'));
    const flipAll = fn => {
      const others = cardsNow().filter(x => x !== card);
      const r0 = new Map(others.map(x => [x, x.getBoundingClientRect()]));
      fn();
      others.forEach(x => { const a = r0.get(x), b = x.getBoundingClientRect(); const dx = a.left - b.left, dy = a.top - b.top; if (!dx && !dy) return;
        x.style.transition = 'none'; x.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => requestAnimationFrame(() => { x.style.transition = 'transform .2s ease'; x.style.transform = ''; })); });
    };
    const activate = () => {
      if (viewAs) { previewBlocked(); cleanup(); return; }
      st.active = true; st.before = cardsNow().map(x => x.dataset.wid).join();
      const g = grid.getBoundingClientRect(); st.home = { x: g.left + card.offsetLeft, y: g.top + card.offsetTop };
      card.classList.add('ov-lifted'); document.body.classList.add('cl-grabbing');
      if (st.touch && navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
    };
    const move = e => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x0, dy = e.clientY - st.y0;
      if (!st.active) {
        if (st.touch) { if (Math.hypot(dx, dy) > 8) cleanup(); return; }
        if (Math.hypot(dx, dy) < 6) return;
        activate(); if (!st) return;
      }
      e.preventDefault();
      // Karte unter dem Zeiger finden und davor/danach einsetzen
      // Trefferprüfung mit den Layout-Positionen (ohne laufende Animationen), sonst springen die Karten hin und her
      const g = grid.getBoundingClientRect(), px = e.clientX - g.left, py = e.clientY - g.top;
      const over = cardsNow().find(x => x !== card && px >= x.offsetLeft && px <= x.offsetLeft + x.offsetWidth && py >= x.offsetTop && py <= x.offsetTop + x.offsetHeight);
      if (over) {
        const list = cardsNow(), iOver = list.indexOf(over), iMe = list.indexOf(card);
        flipAll(() => { if (iOver < iMe) grid.insertBefore(card, over); else over.after(card); });
      }
      const g2 = grid.getBoundingClientRect();
      const baseX = g2.left + card.offsetLeft, baseY = g2.top + card.offsetTop;   // Lage ohne Verschiebung
      card.style.transform = `translate(${st.home.x + dx - baseX}px, ${st.home.y + dy - baseY}px) scale(1.02)`;
    };
    const blockTouch = e => { if (st && st.active) e.preventDefault(); };
    const cleanup = () => {
      if (!st) return; clearTimeout(st.timer);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', blockTouch); st = null;
    };
    const up = e => {
      if (!st || (e && e.pointerId !== st.id)) return;
      const was = st.active, before = st.before; cleanup();
      if (!was) return;
      card.style.transition = 'transform .18s ease'; card.style.transform = '';
      setTimeout(() => { card.style.transition = ''; card.classList.remove('ov-lifted'); }, 190);
      document.body.classList.remove('cl-grabbing');
      const stop = ev => { ev.preventDefault(); ev.stopPropagation(); };
      card.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => card.removeEventListener('click', stop, { capture: true }), 0);
      const ids = cardsNow().map(x => x.dataset.wid);
      if (ids.join() !== before) {
        const c0 = ovCfg(); const rest = c0.order.filter(id => !ids.includes(id));
        // ausgeblendete Fenster behalten ihren Platz relativ am Ende
        profile.overview = { ...c0, order: [...ids, ...rest] };
        flash('Anordnung gespeichert');
        if (!readOnly) db.doc('members/' + uid).set(clone(profile)).catch(() => flash('Anordnung konnte nicht gespeichert werden', true));
      }
    };
    card.addEventListener('pointerdown', e => {
      if (e.button > 0 || st || e.target.closest(NO)) return;
      st = { id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, touch: e.pointerType === 'touch' };
      window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      window.addEventListener('touchmove', blockTouch, { passive: false });
      if (st.touch) st.timer = setTimeout(() => { if (st && !st.active) activate(); }, 350);
    });
    card.title = 'Packen und ziehen zum Verschieben';
  }
  function renderOvMenu() {
    const m = $('ovMenu'); if (!m || m.classList.contains('hidden')) return;
    m.innerHTML = '';
    const c = ovCfg();
    m.appendChild(el('div', 'csm-head', 'Fenster'));
    OV_WIDGETS.forEach(w => {
      const row = el('label', 'ovm-row');
      const sw = el('span', 'switch'); const inp = el('input'); inp.type = 'checkbox'; inp.checked = !!c.show[w.id];
      inp.addEventListener('change', () => ovSet(x => { x.show[w.id] = inp.checked; }));
      sw.append(inp, el('span')); row.append(sw, el('span', null, w.title)); m.appendChild(row);
    });
    const lk = el('button', 'linkish-btn ovm-link', 'Zeitformat, Uhr und Datum → Einstellungen'); lk.type = 'button';
    lk.addEventListener('click', e => { e.stopPropagation(); m.classList.add('hidden'); showPage('settings'); });
    m.appendChild(lk);
    m.appendChild(el('div', 'csm-head', 'Info'));
    const info = el('div', 'ovm-info');
    info.append(el('div', null, `Zeitzone: ${tzName()} (${tzOffset()})`));
    if (ovLoc) info.append(el('div', null, `Standort: ${locText()} (± ${Math.round(ovLoc.acc)} m)`));
    else if (ovLocState === 'denied') info.append(el('div', 'ovm-muted', 'Standort: nicht freigegeben (in den Browser-Einstellungen änderbar)'));
    else if (ovLocState === 'unsupported' || ovLocState === 'unavailable') info.append(el('div', 'ovm-muted', 'Standort: in diesem Browser nicht verfügbar'));
    else {
      const b = el('button', 'linkish-btn', '📍 Standort freigeben'); b.type = 'button';
      b.addEventListener('click', e => { e.stopPropagation(); ovCheckLocation(true); });
      info.append(b);
    }
    m.appendChild(info);
  }
  $('ovCustomize').addEventListener('click', e => {
    e.stopPropagation();
    const m = $('ovMenu');
    if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
    m.classList.remove('hidden'); renderOvMenu();
  });
  $('ovMenu').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => $('ovMenu').classList.add('hidden'));
  ovCheckLocation(false);

  // ----- Profil & Bands: Bereiche auf- und zuklappen (nur in der App, nicht bei der Registrierung) -----
  (() => {
    let folded = {};
    try { folded = JSON.parse(ls.get('bandFolded') || '{}') || {}; } catch (e) {}
    const save = () => { try { ls.set('bandFolded', JSON.stringify(folded)); } catch (e) {} };
    const blocks = () => [...document.querySelectorAll('#profileForm .pf-fold, #accountCard.pf-fold')];
    blocks().forEach(b => {
      const key = b.dataset.foldKey, h = b.querySelector(':scope > .section-title');
      if (!h) return;
      if (folded[key]) b.classList.add('folded');
      h.classList.add('pf-head'); h.title = 'Auf- und zuklappen';
      h.addEventListener('click', () => {
        if (!$('profileForm').closest('#page-profile, #page-home')) return;
        b.classList.toggle('folded'); folded[key] = b.classList.contains('folded'); save();
      });
    });
    document.querySelectorAll('[data-pf-all]').forEach(btn => btn.addEventListener('click', () => {
      const close = btn.dataset.pfAll === 'close';
      blocks().forEach(b => { b.classList.toggle('folded', close); folded[b.dataset.foldKey] = close; });
      document.querySelectorAll('#accountCard details').forEach(d => { d.open = !close; });
      save();
    }));
  })();

  // ----- Fenster in Verwaltung und Einstellungen auf- und zuklappen (Zustand pro Browser gemerkt) -----
  (() => {
    let folded = {};
    try { folded = JSON.parse(ls.get('bandFolded') || '{}') || {}; } catch (e) {}
    document.querySelectorAll('#page-team .panel, #page-settings .panel').forEach(p => {
      const h = p.querySelector(':scope > h3'); if (!h) return;
      const key = (p.closest('#page-team') ? 'team:' : 'set:') + (p.id || h.textContent.trim());
      p.classList.add('foldable');
      if (folded[key]) p.classList.add('folded');
      h.setAttribute('role', 'button'); h.tabIndex = 0; h.title = 'Auf- und zuklappen';
      p.dataset.foldKey = key;
      const toggle = () => { p.classList.toggle('folded'); folded[key] = p.classList.contains('folded'); try { ls.set('bandFolded', JSON.stringify(folded)); } catch (e) {} };
      h.addEventListener('click', toggle);
      h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
    // „Alle aufklappen“ / „Alle zuklappen“
    document.querySelectorAll('.fold-tools [data-fold-all]').forEach(b => b.addEventListener('click', () => {
      const page = b.closest('[id^="page-"]');
      const close = b.dataset.foldAll === 'close';
      page.querySelectorAll('.panel.foldable').forEach(p => { p.classList.toggle('folded', close); folded[p.dataset.foldKey] = close; });
      try { ls.set('bandFolded', JSON.stringify(folded)); } catch (e) {}
    }));
  })();

  // ================= Setlist (Seite 6) und Songs (Seite 7) =================
  // Setlists: setlists/<Band>/lists/<id> { name, gigId, start, targetMin, dupAck, items:[{id,type,title,artist,relType,album,year,genre,dur,key,bpm,note}] }
  // Songs: songs/<Band>/items/<id> { title, artist, relType, album, year, genre, dur, key, bpm, note }
  const SL_TYPES = {
    song: { label: 'Song', icon: '🎵', dur: 240 }, intro: { label: 'Intro', icon: '▶️', dur: 60 }, outro: { label: 'Outro', icon: '⏹️', dur: 60 },
    zwischen: { label: 'Zwischenteil', icon: '〰️', dur: 60 }, pause: { label: 'Pause', icon: '☕', dur: 900 }, ansage: { label: 'Ansage', icon: '🎤', dur: 30 },
  };
  const SL_REL = { album: 'Album', ep: 'EP', single: 'Single' };
  const SL_GENRES = ['Rock', 'Pop', 'Punk', 'Metal', 'Blues', 'Jazz', 'Folk', 'Funk', 'Soul', 'Reggae', 'Country', 'Hip-Hop', 'Electronic', 'Schlager', 'Klassik'];
  let slJump = null, slPend = null, slLists = [], slSongs = [], slBand = null, slUnsubL = null, slUnsubS = null, slSel = null, slView = 'list', slCtx = null, slSaveT = null;
  let slFolderSel = '*';
  let slSort = { by: 'name', dir: 1 }, songSort = { by: 'title', dir: 1 };
  try { const v = JSON.parse(ls.get('slSort') || 'null'); if (v && v.by) slSort = v; const w = JSON.parse(ls.get('songSort') || 'null'); if (w && w.by) songSort = w; } catch (e) {}
  const slCan = () => levelFor(currentBand, 'page6') === 'edit' && !viewAs;
  const songCan = () => levelFor(currentBand, 'page7') === 'edit' && !viewAs;
  const slDeny = () => previewBlocked(null, viewAs ? undefined : 'Keine Berechtigung: Du hast für die Setlist nur Leserechte. Bitte den Admin, dir das Recht „Bearbeiten“ zu geben.');
  const songDeny = () => previewBlocked(null, viewAs ? undefined : 'Keine Berechtigung: Du hast für die Songs nur Leserechte. Bitte den Admin, dir das Recht „Bearbeiten“ zu geben.');
  const slId = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const slFmt = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + pad2(m) : m) + ':' + pad2(x); };
  const slParse = t => { t = String(t || '').trim().replace(',', '.'); if (!t) return 0; if (t.includes(':')) { const p = t.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : (p[0] || 0) * 60 + (p[1] || 0); } return Math.round((parseFloat(t) || 0) * 60); };
  const slClock = (startMin, sec) => { const t = Math.round(startMin + sec / 60) % 1440; return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60); };
  const slCur = () => slLists.find(l => l.id === slSel) || null;
  const slGigs = () => calEvents.filter(e => e.category === 'auftritt' && e.kind !== 'checklist' && e.date).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const slGenresOfBand = () => [...new Set([...slSongs.map(x => x.genre), ...slLists.flatMap(l => (l.items || []).map(i => i.genre))].map(x => (x || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const slRelText = x => x.album ? (SL_REL[x.relType] || 'Album') + ': ' + x.album : '';
  const slSongSub = x => [x.artist, slRelText(x), x.year || '', x.genre, x.key, x.bpm ? x.bpm + ' BPM' : ''].filter(Boolean).join(' · ');
  // Verbindung zu den Daten der aktuellen Band (nur deren Setlists und Songs)
  function slSub() {
    if (slBand === currentBand) return;
    slBand = currentBand; slLists = []; slSongs = []; slView = 'list';
    if (!slCfg[currentBand]) slLoadCfg(currentBand);
    [slUnsubL, slUnsubS].forEach(u => { try { u && u(); } catch (e) {} }); slUnsubL = slUnsubS = null;
    try { slSel = ls.get('slSel_' + currentBand) || null; } catch (e) { slSel = null; }
    const cL = db.collection(`setlists/${currentBand}/lists`), cS = db.collection(`songs/${currentBand}/items`);
    const bandAtStart = currentBand;
    const aL = snap => { if (slBand !== bandAtStart) return; const keep = slPend && slLists.find(x => x.id === slPend); slLists = snap.docs.map(d => (keep && d.id === slPend ? keep : { id: d.id, ...d.data() })); slLists.forEach(l => { if (!Array.isArray(l.items)) l.items = []; }); if (currentPage === 'page6' && !slBusy()) renderSetlist(); else if (currentPage === 'page3') renderGigs(); };
    const aS = snap => { if (slBand !== bandAtStart) return; slSongs = snap.docs.map(d => ({ id: d.id, ...d.data() })); if (currentPage === 'page7') renderSongs(); if (!$('slLibModal').classList.contains('hidden')) renderSlLib(); };
    try { slUnsubL = cL.onSnapshot ? cL.onSnapshot(aL) : null; } catch (e) { slUnsubL = null; }
    if (!slUnsubL) cL.get().then(aL).catch(() => {});
    try { slUnsubS = cS.onSnapshot ? cS.onSnapshot(aS) : null; } catch (e) { slUnsubS = null; }
    if (!slUnsubS) cS.get().then(aS).catch(() => {});
  }
  function openSetlist() { slSub(); if (slJump) { slSel = slJump; slView = 'edit'; slJump = null; } else slView = 'list'; renderSetlist(); }
  function openSongs() { slSub(); renderSongs(); }
  const slBusy = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#slEditor') && /INPUT|TEXTAREA|SELECT/.test(a.tagName)); };
  function slSave(L) {
    clearTimeout(slSaveT); slPend = L.id; L.updatedAt = new Date().toISOString();
    slSaveT = setTimeout(() => {
      const d = clone(L); delete d.id;
      db.collection(`setlists/${slBand}/lists`).doc(L.id).set(d).catch(() => flash('Setlist konnte nicht gespeichert werden', true));
      setTimeout(() => { if (slPend === L.id) slPend = null; }, 1500);
    }, 400);
  }
  function slTimes(L) {
    const [h, m] = String(L.start || '').split(':').map(Number); const hasStart = L.start && !isNaN(h);
    const base = hasStart ? h * 60 + (m || 0) : 0; let t = 0, n = 0;
    return { hasStart, rows: (L.items || []).map(it => { const r = { it, at: t, num: it.type === 'song' ? ++n : 0, clock: hasStart ? slClock(base, t) : '' }; t += it.dur || 0; return r; }), total: t, base };
  }
  // Titel, die in einer Setlist mehrfach vorkommen dürfen (pro Band einstellbar, Standard)
  const SL_DUP_DEFAULT = ['intro', 'interlude', 'break', 'outro'];
  const slCfg = {};   // Band -> Wörter
  const slWords = () => slCfg[currentBand] || SL_DUP_DEFAULT;
  async function slLoadCfg(band) {
    try { const d = await db.doc(`setlists/${band}/settings/config`).get(); slCfg[band] = d.exists && Array.isArray(d.data().dupOk) ? d.data().dupOk : SL_DUP_DEFAULT.slice(); } catch (e) { slCfg[band] = SL_DUP_DEFAULT.slice(); }
    if (band === currentBand && currentPage === 'page6') renderSetlist();
  }
  async function slSaveWords(list) {
    slCfg[currentBand] = list; renderSlWords();
    try { await db.doc(`setlists/${currentBand}/settings/config`).set({ dupOk: list, updatedAt: new Date().toISOString() }); } catch (e) { flash('Wörter konnten nicht gespeichert werden', true); }
  }
  function renderSlWords() {
    const box = $('slWords'); if (!box) return; box.innerHTML = '';
    const list = slWords();
    if (!list.length) box.appendChild(el('div', 'mnote', 'Keine Wörter – jeder doppelte Titel löst eine Warnung aus.'));
    list.forEach(w => {
      const c = el('span', 'chip on sl-word'); c.append(w + ' ');
      const x = el('button', 'sl-wx', '×'); x.type = 'button'; x.title = 'Entfernen'; x.setAttribute('aria-label', w + ' entfernen');
      x.addEventListener('click', () => slSaveWords(slWords().filter(y => y !== w)));
      c.appendChild(x); box.appendChild(c);
    });
  }
  $('slWordAdd').addEventListener('click', () => {
    const w = $('slWordNew').value.trim().toLowerCase(); if (!w) return;
    if (!slWords().includes(w)) slSaveWords([...slWords(), w]);
    $('slWordNew').value = '';
  });
  $('slWordNew').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('slWordAdd').click(); } });
  $('slWordReset').addEventListener('click', () => slSaveWords(SL_DUP_DEFAULT.slice()));
  // Doppelte Titel: ids, Titel und eine Signatur (damit eine bestätigte Warnung bei neuen Doppelten wieder auslöst)
  function slDupInfo(L) {
    const seen = new Map(), ids = new Set(), titles = new Set();
    (L.items || []).forEach(it => {
      if (it.type !== 'song') return;
      const t = (it.title || '').trim().toLowerCase(); if (!t) return;
      if (slWords().some(w => t.split(/[^a-zäöü0-9]+/).includes(w.toLowerCase()))) return;
      if (seen.has(t)) { ids.add(seen.get(t)); ids.add(it.id); titles.add(it.title.trim()); } else seen.set(t, it.id);
    });
    const sig = [...titles].map(x => x.toLowerCase()).sort().join('|');
    return { ids, titles: [...titles], sig, active: ids.size > 0 && sig !== (L.dupAck || '') };
  }
  function renderSetlist() {
    const L = slCur();
    if (slView === 'edit' && !L) slView = 'list';
    $('slListView').classList.toggle('hidden', slView !== 'list'); $('slEditView').classList.toggle('hidden', slView !== 'edit');
    if (slView === 'list') renderSlList(); else renderSlEdit(L);
  }
  const slTot = L => { let t = 0, n = 0; (L.items || []).forEach(i => { t += i.dur || 0; if (i.type === 'song') n++; }); return { t, n }; };
  function renderSlList() {
    const can = slCan(), gigs = slGigs();
    $('slNew').classList.toggle('pv-locked', !can);
    $('slSortBy').value = slSort.by; $('slSortDir').textContent = slSort.dir > 0 ? '↑ aufsteigend' : '↓ absteigend';
    const gd = L => { const g = gigs.find(e => e.id === L.gigId); return g ? g.date : ''; };
    const key = { name: L => (L.name || '').toLowerCase(), gig: L => gd(L) || '￿', dur: L => slTot(L).t, songs: L => slTot(L).n, upd: L => L.updatedAt || '' }[slSort.by];
    const folders = [...new Set(slLists.map(L => (L.folder || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    const ff = $('slFolderFilter'), fcur = slFolderSel;
    ff.innerHTML = ''; ff.appendChild(new Option('Alle Setlists', '*')); folders.forEach(f => ff.appendChild(new Option('📁 ' + f, 'f:' + f)));
    if (slLists.some(L => !(L.folder || '').trim() && folders.length)) ff.appendChild(new Option('Ohne Ordner', '-'));
    if (slLists.some(L => L.tpl)) ff.appendChild(new Option('📋 Nur Vorlagen', 'tpl'));
    ff.value = [...ff.options].some(o => o.value === fcur) ? fcur : '*'; slFolderSel = ff.value;
    $('slFolderBar').classList.toggle('hidden', !(folders.length || slLists.some(L => L.tpl)));
    const tpls = slLists.filter(L => L.tpl), ft = $('slFromTpl');
    ft.innerHTML = ''; ft.appendChild(new Option('+ Aus Vorlage …', '')); tpls.forEach(L => ft.appendChild(new Option(L.name || 'Vorlage', L.id))); ft.classList.toggle('hidden', !tpls.length);
    const inFilter = L => slFolderSel === '*' || (slFolderSel === '-' ? !(L.folder || '').trim() : slFolderSel === 'tpl' ? !!L.tpl : (L.folder || '').trim() === slFolderSel.slice(2));
    const list = slLists.filter(inFilter).sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * slSort.dir || (a.name || '').localeCompare(b.name || '', 'de'); });
    $('slEmpty').classList.toggle('hidden', !!slLists.length); $('slSortBar').classList.toggle('hidden', !slLists.length);
    const box = $('slCards'); box.innerHTML = '';
    let lastFolder = null;
    list.forEach(L => {
      const fo = (L.folder || '').trim();
      if (slFolderSel === '*' && folders.length && fo !== lastFolder) { lastFolder = fo; const hd = el('div', 'sl-folder-h', fo ? '📁 ' + fo : 'Ohne Ordner'); box.appendChild(hd); }
      const c = el('button', 'sl-card'); c.type = 'button';
      const g = gigs.find(e => e.id === L.gigId), T = slTot(L), di = slDupInfo(L);
      c.append(el('div', 'slc-name', L.name || 'Ohne Namen'),
        el('div', 'slc-gig', g ? `🎤 ${g.title || 'Gig'} · ${fmtDateOv(parseKey(g.date), ovCfg().date)}` : 'Kein Gig zugewiesen'),
        el('div', 'slc-meta', `${T.n} ${T.n === 1 ? 'Song' : 'Songs'} · Gesamt ${slFmt(T.t)}${L.targetMin ? ' · Soll ' + L.targetMin + ' Min.' : ''}`));
      c.append(el('div', 'slc-vis ' + (L.vis === 'public' ? 'pub' : 'int'), L.vis === 'public' ? '🌐 Öffentlich' : '🔒 Intern'));
      if (L.tpl) c.append(el('div', 'slc-vis', '📋 Vorlage'));
      if (di.active) c.append(el('div', 'slc-warn', '⚠ Doppelte Titel'));
      c.addEventListener('click', () => { slSel = L.id; slView = 'edit'; try { ls.set('slSel_' + currentBand, slSel); } catch (e) {} renderSetlist(); window.scrollTo(0, 0); });
      box.appendChild(c);
    });
  }
  function renderSlEdit(L) {
    const can = slCan();
    ['slDup', 'slDel'].forEach(id => $(id).classList.toggle('pv-locked', !can));
    $('slName').value = L.name || ''; $('slStart').value = L.start || ''; $('slTarget').value = L.targetMin || '';
    $('slVis').value = L.vis === 'public' ? 'public' : 'intern';
    $('slFolder').value = L.folder || ''; $('slTpl').checked = !!L.tpl;
    { const dl = $('slFolderList'); dl.innerHTML = ''; [...new Set(slLists.map(x => (x.folder || '').trim()).filter(Boolean))].forEach(f => dl.appendChild(new Option(f))); }
    ['slName', 'slStart', 'slTarget', 'slGig', 'slVis', 'slFolder', 'slTpl'].forEach(id => { $(id).disabled = !can; });
    const g = $('slGig'); g.innerHTML = ''; g.appendChild(new Option('– kein Gig –', ''));
    slGigs().forEach(e => g.appendChild(new Option(`${fmtDateOv(parseKey(e.date), ovCfg().date)} · ${e.title || 'Gig'}`, e.id)));
    if (L.gigId && !slGigs().some(e => e.id === L.gigId)) g.appendChild(new Option('(Gig nicht mehr vorhanden)', L.gigId));
    g.value = L.gigId || '';
    const T = slTimes(L), di = slDupInfo(L);
    const sum = $('slSum'); sum.innerHTML = '';
    const nSongs = T.rows.filter(r => r.num).length;
    const stat = (k, v, cls) => { const d = el('div', 'sl-stat' + (cls ? ' ' + cls : '')); d.append(el('div', 'sk', k), el('div', 'sv', v)); sum.appendChild(d); };
    stat(nSongs === 1 ? 'Song' : 'Songs', String(nSongs)); stat('Elemente', String(L.items.length)); stat('Gesamt', slFmt(T.total));
    if (T.hasStart && L.items.length) stat('Ende', slClock(T.base, T.total));
    if (L.targetMin) { const diff = T.total - L.targetMin * 60, ok = Math.abs(diff) <= 30; stat('Soll ' + L.targetMin + ' Min.', ok ? 'passt' : diff > 0 ? slFmt(diff) + ' zu lang' : slFmt(-diff) + ' zu kurz', ok ? 'ok' : diff > 0 ? 'over' : 'under'); }
    const wb = el('button', 'sl-dupbtn ' + (di.active ? 'on' : 'off'), di.active ? '⚠ DOPPELT: ' + di.titles.join(', ') : 'KEINE WARNUNG'); wb.type = 'button';
    wb.title = di.active ? 'Klicken, um die Warnung auszuschalten – bei einem neuen doppelten Titel erscheint sie wieder' : 'Keine aktive Warnung';
    wb.addEventListener('click', () => { if (!di.active) return; if (!slCan()) return slDeny(); L.dupAck = di.sig; slSave(L); renderSetlist(); });
    sum.appendChild(wb);
    const bar = $('slAddBar'); bar.innerHTML = '';
    Object.entries(SL_TYPES).filter(([k]) => k !== 'song').forEach(([k, v]) => { const b = el('button', 'btn small ghost' + (can ? '' : ' pv-locked'), `${v.icon} ${v.label}`); b.type = 'button'; b.addEventListener('click', () => can ? slOpenItem(-1, k) : slDeny()); bar.appendChild(b); });
    const lb = el('button', 'btn small' + (can ? '' : ' pv-locked'), '🎵 Song hinzufügen oder erstellen'); lb.type = 'button'; lb.addEventListener('click', () => can ? openSlLib() : slDeny()); bar.prepend(lb);
    const box = $('slItems'); box.innerHTML = '';
    if (!L.items.length) box.appendChild(el('div', 'mnote', 'Noch leer. Füge oben Songs, Intro, Pausen oder Ansagen hinzu.'));
    T.rows.forEach((r, i) => {
      const it = r.it, ty = SL_TYPES[it.type] || SL_TYPES.song, dup = di.active && di.ids.has(it.id);
      const row = el('div', 'sl-row sl-t-' + it.type + (dup ? ' sl-dup' : '')); row.dataset.cid = it.id;
      const grip = el('span', 'sl-grip', '⠿'); grip.title = 'Ziehen zum Verschieben';
      const main = el('div', 'sl-main'); main.append(el('div', 'sl-title', (dup ? '⚠ ' : '') + (it.title || ty.label)));
      const sub = [slSongSub(it), it.note].filter(Boolean).join(' · '); if (sub) main.append(el('div', 'sl-sub', sub));
      row.append(grip, el('span', 'sl-num', r.num ? String(r.num) : ty.icon), el('span', 'sl-clock', r.clock || slFmt(r.at)), main, el('span', 'sl-dur', slFmt(it.dur)));
      row.addEventListener('click', e => { if (e.target.closest('.sl-grip')) return; can ? slOpenItem(i) : slDeny(); });
      if (can) slDrag(row, grip, box);
      box.appendChild(row);
    });
  }
  function slDrag(row, grip, box) {
    grip.addEventListener('pointerdown', e => {
      if (e.button > 0) return; e.preventDefault();
      row.classList.add('sl-lifted'); document.body.classList.add('cl-grabbing');
      const move = ev => {
        ev.preventDefault();
        const under = document.elementFromPoint(ev.clientX, ev.clientY), tgt = under && under.closest('.sl-row');
        if (!tgt || tgt === row || tgt.parentElement !== box) return;
        const r = tgt.getBoundingClientRect(); box.insertBefore(row, ev.clientY < r.top + r.height / 2 ? tgt : tgt.nextSibling);
      };
      const up = () => {
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        row.classList.remove('sl-lifted'); document.body.classList.remove('cl-grabbing');
        const L = slCur(); if (!L) return;
        const ids = [...box.querySelectorAll('.sl-row')].map(x => x.dataset.cid);
        if (ids.join() !== L.items.map(x => x.id).join()) { L.items = ids.map(id => L.items.find(x => x.id === id)); slSave(L); }
        renderSetlist();
      };
      document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    });
  }
  async function slNewList(copyFrom, fromTpl) {
    if (!slCan()) return slDeny();
    const ref = db.collection(`setlists/${currentBand}/lists`).doc();
    const base = copyFrom ? clone(copyFrom) : { name: 'Neue Setlist', gigId: '', start: '', targetMin: 0, vis: 'intern', items: [] };
    delete base.id; if (copyFrom) { base.name = fromTpl ? (copyFrom.name || 'Setlist').replace(/\s*\(?Vorlage\)?\s*$/i, '').trim() || 'Neue Setlist' : (copyFrom.name || 'Setlist') + ' (Kopie)'; base.tpl = false; base.gigId = ''; base.dupAck = ''; base.items = base.items.map(x => ({ ...x, id: slId() })); }
    base.createdBy = uid; base.updatedAt = new Date().toISOString();
    slLists.push({ id: ref.id, ...base }); slSel = ref.id; slView = 'edit'; try { ls.set('slSel_' + currentBand, slSel); } catch (e) {}
    renderSetlist(); if (!copyFrom) { $('slName').focus(); $('slName').select(); }
    try { await ref.set(base); } catch (e) { flash('Setlist konnte nicht gespeichert werden', true); }
  }
  $('slNew').addEventListener('click', () => slNewList());
  $('slDup').addEventListener('click', () => { const L = slCur(); if (L) slNewList(L); });
  $('slToList').addEventListener('click', () => { slView = 'list'; renderSetlist(); });
  $('slDel').addEventListener('click', async () => {
    const L = slCur(); if (!L) return; if (!slCan()) return slDeny();
    if (!confirm(`Setlist „${L.name || 'Ohne Namen'}“ wirklich löschen?`)) return;
    slLists = slLists.filter(x => x.id !== L.id); slSel = null; slView = 'list'; renderSetlist();
    try { await db.collection(`setlists/${currentBand}/lists`).doc(L.id).delete(); flash('Setlist gelöscht'); } catch (e) { flash('Löschen fehlgeschlagen', true); }
  });
  $('slSortBy').addEventListener('change', () => { slSort.by = $('slSortBy').value; try { ls.set('slSort', JSON.stringify(slSort)); } catch (e) {} renderSetlist(); });
  $('slSortDir').addEventListener('click', () => { slSort.dir = -slSort.dir; try { ls.set('slSort', JSON.stringify(slSort)); } catch (e) {} renderSetlist(); });
  const slField = (id, fn) => $(id).addEventListener('input', () => { const L = slCur(); if (!L || !slCan()) return; fn(L, $(id).value); slSave(L); if (id !== 'slName') renderSetlistKeep(); });
  const renderSetlistKeep = () => { const a = document.activeElement, id = a && a.id; renderSetlist(); if (id && $(id)) { $(id).focus(); } };
  slField('slName', (L, v) => { L.name = v; });
  slField('slStart', (L, v) => { L.start = v; });
  slField('slTarget', (L, v) => { L.targetMin = Math.max(0, parseInt(v, 10) || 0); });
  $('slFolder').addEventListener('change', () => { const L = slCur(); if (!L || !slCan()) return; L.folder = $('slFolder').value.trim().slice(0, 40); slSave(L); renderSetlist(); });
  $('slTpl').addEventListener('change', () => { const L = slCur(); if (!L || !slCan()) return; L.tpl = $('slTpl').checked; slSave(L); renderSetlist(); flash(L.tpl ? 'Als Vorlage markiert' : 'Vorlage aufgehoben'); });
  $('slFolderFilter').addEventListener('change', () => { slFolderSel = $('slFolderFilter').value; renderSlList(); });
  $('slFromTpl').addEventListener('change', () => { const t = slLists.find(x => x.id === $('slFromTpl').value); $('slFromTpl').value = ''; if (t) slNewList(t, true); });
  $('slVis').addEventListener('change', () => { const L = slCur(); if (!L || !slCan()) return; L.vis = $('slVis').value === 'public' ? 'public' : 'intern'; slSave(L); renderSetlist(); });
  $('slGig').addEventListener('change', () => { const L = slCur(); if (!L || !slCan()) return; L.gigId = $('slGig').value; const e = calEvents.find(x => x.id === L.gigId); if (e && !L.start && e.start) L.start = e.start; slSave(L); renderSetlist(); });
  // Element bearbeiten / hinzufügen (Setlist) oder Song bearbeiten (Seite Songs)
  function slOpenItem(idx, type, lib, opts) {
    const L = slCur(); const isLib = !!lib; const picker = !!(opts && opts.picker);
    const it = isLib ? (lib.id ? slSongs.find(s => s.id === lib.id) : null) : (idx >= 0 ? L.items[idx] : null);
    const ty = it ? (it.type || 'song') : (type || 'song');
    slCtx = { idx, lib: isLib ? (lib.id || '') : null, isNew: !it, picker };
    const sel = $('slType'); sel.innerHTML = ''; Object.entries(SL_TYPES).forEach(([k, v]) => sel.appendChild(new Option(v.label, k))); sel.value = ty;
    $('slTypeField').classList.toggle('hidden', isLib);
    $('slItemH').textContent = isLib ? (it ? 'Song bearbeiten' : 'Neuer Song') : (it ? 'Element bearbeiten' : SL_TYPES[ty].label + (ty === 'song' ? ' erstellen' : ' hinzufügen'));
    $('slTitle').value = it ? (it.title || '') : (ty === 'song' ? '' : SL_TYPES[ty].label);
    $('slArtist').value = it ? (it.artist || '') : ''; $('slRelType').value = it && it.relType ? it.relType : 'album'; $('slAlbum').value = it ? (it.album || '') : '';
    $('slYear').value = it && it.year ? it.year : ''; $('slGenre').value = it ? (it.genre || '') : (ty === 'song' && bands[currentBand] && bands[currentBand].genre) || ''; $('slDur').value = slFmt(it ? it.dur : SL_TYPES[ty].dur);
    $('slKey').value = it ? (it.key || '') : ''; $('slBpm').value = it && it.bpm ? it.bpm : ''; $('slNote').value = it ? (it.note || '') : '';
    slRelHint();
    const song = isLib || ty === 'song';
    const isNewSong = !it && song && (isLib || picker), draftEdit = isLib && !!it && !!it.draft, draftable = (isNewSong || draftEdit) && songCan();
    slCtx.draftable = draftable; slCtx.newSong = isNewSong;
    $('slItemDraft').classList.toggle('hidden', !draftable);
    $('slItemSave').textContent = draftable ? 'In Bibliothek aufnehmen' : (isLib ? 'Speichern' : 'Übernehmen');
    $('slItemCancel').textContent = isNewSong ? 'Verwerfen' : 'Abbrechen';
    $('slItemDel').classList.toggle('hidden', !it); $('slItemMsg').textContent = '';
    $('slArtistField').classList.toggle('hidden', !song); $('slAlbumField').classList.toggle('hidden', !song);
    if (picker) $('slLibModal').classList.add('hidden');
    $('slItemModal').classList.remove('hidden'); setTimeout(() => $('slTitle').focus(), 30);
  }
  function slRelHint() { const t = $('slRelType').value; $('slAlbum').placeholder = 'Name ' + ({ album: 'des Albums', ep: 'der EP', single: 'der Single' }[t]); }
  $('slRelType').addEventListener('change', slRelHint);
  $('slType').addEventListener('change', () => {
    const t = $('slType').value; $('slArtistField').classList.toggle('hidden', t !== 'song'); $('slAlbumField').classList.toggle('hidden', t !== 'song');
    if (slCtx && slCtx.isNew) { const olds = Object.values(SL_TYPES).map(x => x.label); if (!$('slTitle').value || olds.includes($('slTitle').value)) $('slTitle').value = t === 'song' ? '' : SL_TYPES[t].label; $('slDur').value = slFmt(SL_TYPES[t].dur); }
  });
  const closeSlItem = (back) => { const ctx = slCtx; $('slItemModal').classList.add('hidden'); slCtx = null; if (back && ctx && ctx.picker) { $('slLibModal').classList.remove('hidden'); renderSlLib(); } };
  ['slItemClose', 'slItemCancel'].forEach(id => $(id).addEventListener('click', () => closeSlItem(true)));
  $('slItemModal').addEventListener('click', e => { if (e.target === $('slItemModal') && !(slCtx && slCtx.newSong)) closeSlItem(true); });
  async function slSaveItem(asDraft) {
    if (!slCtx) return;
    const type = slCtx.lib !== null ? 'song' : $('slType').value;
    const data = { title: $('slTitle').value.trim(), artist: type === 'song' ? $('slArtist').value.trim() : '', relType: type === 'song' ? $('slRelType').value : '', album: type === 'song' ? $('slAlbum').value.trim() : '', year: type === 'song' ? (parseInt($('slYear').value, 10) || 0) : 0, genre: type === 'song' ? $('slGenre').value.trim() : '', dur: slParse($('slDur').value), key: $('slKey').value.trim(), bpm: Math.max(0, parseInt($('slBpm').value, 10) || 0), note: $('slNote').value.trim() };
    if (!asDraft) {
      if (!data.title && type === 'song') { $('slItemMsg').textContent = 'Bitte einen Titel eingeben.'; return; }
      if (type === 'song' && !data.album) { $('slItemMsg').textContent = 'Bitte ' + ({ album: 'den Namen des Albums', ep: 'den Namen der EP', single: 'den Namen der Single' }[data.relType]) + ' eingeben.'; $('slAlbum').focus(); return; }
      if (!data.title) data.title = SL_TYPES[type].label;
    } else if (!data.title) data.title = 'Ohne Titel';
    const toLib = slCtx.lib !== null || (slCtx.picker && slCtx.newSong);
    let libId = slCtx.lib || '';
    if (toLib && songCan()) {
      const col = db.collection(`songs/${slBand}/items`), ref = libId ? col.doc(libId) : col.doc();
      const doc = { ...data, draft: !!asDraft, updatedAt: new Date().toISOString() };
      try { await ref.set(doc); } catch (e) { $('slItemMsg').textContent = 'Speichern fehlgeschlagen.'; return; }
      const ex = slSongs.find(x => x.id === ref.id); if (ex) Object.assign(ex, doc); else slSongs.push({ id: ref.id, ...doc });
    } else if (slCtx.lib !== null) return songDeny();
    if (slCtx.lib !== null) { closeSlItem(); renderSongs(); flash(asDraft ? 'Als Entwurf gespeichert' : 'Song gespeichert'); return; }
    if (asDraft) { closeSlItem(true); flash('Als Entwurf in den Songs gespeichert – noch nicht in der Setlist'); return; }
    const L = slCur(); if (!L) return;
    if (slCtx.idx >= 0) L.items[slCtx.idx] = { ...L.items[slCtx.idx], type, ...data }; else L.items.push({ id: slId(), type, ...data });
    slSave(L); closeSlItem(); renderSetlist();
  }
  $('slItemSave').addEventListener('click', () => slSaveItem(false));
  $('slItemDraft').addEventListener('click', () => slSaveItem(true));
  // Genre-Auswahl in eigenem Fenster
  function openGenre() {
    const cur = $('slGenre').value.trim(), box = $('slGenreChips'); box.innerHTML = ''; $('slGenreNew').value = '';
    const list = slGenresOfBand();
    $('slGenreHint').textContent = list.length ? 'Genres, die diese Band schon verwendet. Oder gib ein neues ein.' : 'Diese Band hat noch kein Genre. Gib das erste ein.';
    list.forEach(g => { const c = el('button', 'chip' + (g === cur ? ' on' : ''), g); c.type = 'button'; c.addEventListener('click', () => pickGenre(g)); box.appendChild(c); });
    $('slItemModal').classList.add('hidden'); $('slGenreModal').classList.remove('hidden'); setTimeout(() => $('slGenreNew').focus(), 30);
  }
  function pickGenre(g) { $('slGenre').value = g; closeGenre(); }
  function closeGenre() { $('slGenreModal').classList.add('hidden'); if (slCtx) $('slItemModal').classList.remove('hidden'); }
  $('slGenreBtn').addEventListener('click', openGenre); $('slGenre').addEventListener('click', openGenre);
  $('slGenreAdd').addEventListener('click', () => { const v = $('slGenreNew').value.trim(); if (v) pickGenre(v); });
  $('slGenreNew').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('slGenreAdd').click(); } });
  $('slGenreNone').addEventListener('click', () => pickGenre(''));
  ['slGenreCancel', 'slGenreClose'].forEach(id => $(id).addEventListener('click', closeGenre));
  $('slItemDel').addEventListener('click', async () => {
    if (!slCtx) return;
    if (slCtx.lib) { await songDelete(slCtx.lib); closeSlItem(); return; }
    const L = slCur(); if (!L || slCtx.idx < 0) return; L.items.splice(slCtx.idx, 1); slSave(L); closeSlItem(); renderSetlist();
  });
  // Songs: Sortierung und Liste (für die Seite „Songs“ und die Auswahl in der Setlist)
  const SONG_SORTS = { title: x => x.title, artist: x => x.artist, album: x => x.album, year: x => x.year || 0, genre: x => x.genre, dur: x => x.dur || 0 };
  function songsSorted(q, sort) {
    const f = SONG_SORTS[sort.by] || SONG_SORTS.title;
    return slSongs.filter(s => !q || ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.album || '') + ' ' + (s.genre || '')).toLowerCase().includes(q))
      .sort((a, b) => { const x = f(a), y = f(b), c = typeof x === 'number' ? x - y : String(x || '').localeCompare(String(y || ''), 'de'); return (c * sort.dir) || (a.title || '').localeCompare(b.title || '', 'de'); });
  }
  async function songDelete(id) {
    const s = slSongs.find(x => x.id === id); if (!songCan()) return songDeny();
    if (!confirm('„' + ((s && s.title) || 'Song') + '“ aus den Songs löschen? Setlists behalten ihre Einträge.')) return;
    slSongs = slSongs.filter(x => x.id !== id); renderSongs(); renderSlLib();
    try { await db.collection(`songs/${slBand}/items`).doc(id).delete(); } catch (e) { flash('Löschen fehlgeschlagen', true); }
  }
  function songRow(s, mode) {
    const r = el('div', 'sl-librow'), m = el('div', 'sl-main');
    const tt = el('div', 'sl-title', s.title || 'Ohne Titel'); if (s.draft) tt.append(' ', el('span', 'sl-draft', 'Entwurf'));
    m.append(tt, el('div', 'sl-sub', [slSongSub(s), slFmt(s.dur)].filter(Boolean).join(' · ')));
    r.append(m);
    if (mode === 'pick') {
      const add = el('button', 'btn small' + (s.draft ? ' ghost' : ''), s.draft ? 'Entwurf' : '+ Hinzufügen'); add.type = 'button';
      if (s.draft) { add.disabled = true; add.title = 'Entwürfe können nicht in eine Setlist. Erst auf der Seite „Songs“ in die Bibliothek aufnehmen.'; }
      add.addEventListener('click', () => { if (!slCan()) return slDeny(); const L = slCur(); if (!L) return; L.items.push({ id: slId(), type: 'song', title: s.title, artist: s.artist || '', relType: s.relType || 'album', album: s.album || '', year: s.year || 0, genre: s.genre || '', dur: s.dur || 0, key: s.key || '', bpm: s.bpm || 0, note: s.note || '' }); slSave(L); renderSetlist(); flash('„' + (s.title || 'Song') + '“ hinzugefügt'); });
      r.append(add);
    } else {
      const ed = el('button', 'btn small ghost', '✎ Bearbeiten'); ed.type = 'button'; ed.addEventListener('click', () => songCan() ? slOpenItem(-1, 'song', { id: s.id }) : songDeny());
      const del = el('button', 'btn small ghost sl-del', '🗑 Löschen'); del.type = 'button'; del.addEventListener('click', () => songDelete(s.id));
      r.append(ed, del);
    }
    return r;
  }
  function renderSongs() {
    const box = $('songList'); if (!box) return; box.innerHTML = '';
    $('songNew').classList.toggle('pv-locked', !songCan());
    $('songSortBy').value = songSort.by; $('songSortDir').textContent = songSort.dir > 0 ? '↑ aufsteigend' : '↓ absteigend';
    const list = songsSorted($('songFilter').value.trim().toLowerCase(), songSort);
    const nd = slSongs.filter(x => x.draft).length;
    $('songCount').textContent = (slSongs.length === 1 ? '1 Song' : slSongs.length + ' Songs') + (nd ? ' · ' + (nd === 1 ? '1 Entwurf' : nd + ' Entwürfe') : '');
    if (!list.length) box.appendChild(el('div', 'mnote', slSongs.length ? 'Kein Treffer.' : 'Noch keine Songs. Mit „+ Neuer Song“ legst du den ersten an.'));
    list.forEach(s => box.appendChild(songRow(s, 'manage')));
  }
  $('songNew').addEventListener('click', () => songCan() ? slOpenItem(-1, 'song', {}) : songDeny());
  $('songFilter').addEventListener('input', renderSongs);
  $('songSortBy').addEventListener('change', () => { songSort.by = $('songSortBy').value; try { ls.set('songSort', JSON.stringify(songSort)); } catch (e) {} renderSongs(); });
  $('songSortDir').addEventListener('click', () => { songSort.dir = -songSort.dir; try { ls.set('songSort', JSON.stringify(songSort)); } catch (e) {} renderSongs(); });
  $('songsBack').addEventListener('click', () => { if (navPos > 0) navGo(-1); else showPage('overview'); });
  // Auswahl „Song hinzufügen oder erstellen“ in der Setlist
  function openSlLib() { $('slLibFilter').value = ''; $('slLibModal').classList.remove('hidden'); renderSlLib(); }
  function renderSlLib() {
    const box = $('slLibList'); if (!box) return; box.innerHTML = '';
    const list = songsSorted($('slLibFilter').value.trim().toLowerCase(), { by: 'title', dir: 1 });
    if (!list.length) box.appendChild(el('div', 'mnote', slSongs.length ? 'Kein Treffer.' : 'Noch keine Songs vorhanden. Mit „+ Neuer Song“ erstellst du einen.'));
    list.forEach(s => box.appendChild(songRow(s, 'pick')));
  }
  $('slLibNew').addEventListener('click', () => slCan() ? slOpenItem(-1, 'song', null, { picker: true }) : slDeny());
  $('slLibFilter').addEventListener('input', renderSlLib);
  $('slLibClose').addEventListener('click', () => $('slLibModal').classList.add('hidden'));
  $('slLibModal').addEventListener('click', e => { if (e.target === $('slLibModal')) $('slLibModal').classList.add('hidden'); });
  // Bühnenmodus: Vollbild, grosse Schrift, Weiterschalten mit Tippen, Pfeiltasten oder Wischen
  function slStage() {
    const L = slCur(); if (!L) return;
    const T = slTimes(L), rows = T.rows; if (!rows.length) return flash('Die Setlist ist leer', true);
    let i = 0, wl = null;
    // Uhr: Play startet, Pause hält an, Stopp setzt auf den ersten Eintrag und 0:00 zurück
    let run = false, setMs = 0, songMs = 0, t0 = 0, tick = null;
    const ov = el('div', 'stage-ov'), tag = el('div', 'stage-top'), main = el('div', 'stage-main'), nxt = el('div', 'stage-next'), bar = el('div', 'stage-bar');
    const clock = el('div', 'stage-clock'), cSong = el('div', 'stage-c'), cSet = el('div', 'stage-c'), prog = el('div', 'stage-prog'), progI = el('i');
    prog.appendChild(progI); clock.append(cSong, cSet);
    const prev = el('button', 'btn', '◀ Zurück'), next = el('button', 'btn', 'Weiter ▶'), close = el('button', 'btn ghost', '✕ Schliessen');
    const play = el('button', 'btn stage-play', '▶ Play'), stop = el('button', 'btn', '■ Stopp');
    const tr = el('div', 'stage-tr'); tr.append(play, stop);
    [prev, next, close, play, stop].forEach(b => b.type = 'button'); bar.append(prev, tr, close, next); ov.append(tag, clock, prog, main, nxt, bar); document.body.appendChild(ov);
    const name = r => (r.it.title || SL_TYPES[r.it.type].label) + (r.it.artist ? ' – ' + r.it.artist : '');
    const mmss = ms => { const t = Math.floor(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
    const now = () => performance.now();
    function times() {
      const d = run ? now() - t0 : 0, sm = songMs + d, st = setMs + d, dur = (rows[i].it.dur || 0) * 1000;
      cSong.textContent = 'Eintrag ' + mmss(sm) + (dur ? ' / ' + mmss(dur) : '');
      cSet.textContent = 'Set ' + mmss(st) + (T.total ? ' / ' + slFmt(T.total) : '');
      cSong.classList.toggle('over', !!dur && sm > dur);
      progI.style.width = dur ? Math.min(100, sm / dur * 100) + '%' : '0%';
      prog.classList.toggle('over', !!dur && sm > dur);
    }
    function setRun(on) {
      if (on === run) return;
      if (on) { t0 = now(); tick = setInterval(times, 250); }
      else { const d = now() - t0; songMs += d; setMs += d; clearInterval(tick); tick = null; }
      run = on; play.textContent = run ? '❚❚ Pause' : '▶ Play'; play.classList.toggle('on', run); ov.classList.toggle('running', run); times();
    }
    function draw() {
      const r = rows[i];
      tag.textContent = `${i + 1} / ${rows.length}${r.clock ? ' · ' + r.clock : ''} · ${L.name || 'Setlist'}`;
      main.innerHTML = ''; main.append(el('div', 'stage-t', (r.num ? r.num + '. ' : '') + (r.it.title || SL_TYPES[r.it.type].label)));
      const sub = [r.it.artist, r.it.key, r.it.bpm ? r.it.bpm + ' BPM' : '', slFmt(r.it.dur)].filter(Boolean).join(' · '); if (sub) main.append(el('div', 'stage-s', sub));
      if (r.it.note) main.append(el('div', 'stage-n', r.it.note));
      nxt.textContent = rows[i + 1] ? 'Als Nächstes: ' + name(rows[i + 1]) : 'Letzter Eintrag';
      prev.disabled = i === 0; next.disabled = i === rows.length - 1;
      times();
    }
    // Beim Weiterschalten beginnt die Eintragszeit neu, die Setzeit läuft weiter
    const go = d => { const j = Math.max(0, Math.min(rows.length - 1, i + d)); if (j === i) return; if (run) { setMs += now() - t0; t0 = now(); } songMs = 0; i = j; draw(); };
    function doStop() { if (run) setRun(false); setMs = 0; songMs = 0; i = 0; draw(); }
    function end() { document.removeEventListener('keydown', key, true); clearInterval(tick); try { wl && wl.release(); } catch (e) {} ov.remove(); }
    function key(e) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === ' ' || e.key === 'k' || e.key === 'K') { e.preventDefault(); setRun(!run); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); doStop(); }
      else if (e.key === 'Escape') end();
    }
    document.addEventListener('keydown', key, true);
    prev.addEventListener('click', e => { e.stopPropagation(); go(-1); }); next.addEventListener('click', e => { e.stopPropagation(); go(1); }); close.addEventListener('click', e => { e.stopPropagation(); end(); });
    play.addEventListener('click', e => { e.stopPropagation(); setRun(!run); }); stop.addEventListener('click', e => { e.stopPropagation(); doStop(); });
    let x0 = null; ov.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    ov.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); });
    main.addEventListener('click', () => go(1));
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { wl = l; }).catch(() => {}); } catch (e) {}
    draw();
  }
  $('slStage').addEventListener('click', slStage);
  // Import: JSON-Datei (Export aus StageMate) als neue Setlist
  $('slImport').addEventListener('click', () => slCan() ? $('slImportFile').click() : slDeny());
  $('slImportFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!o || !Array.isArray(o.items)) throw new Error('format');
      const items = o.items.filter(i => i && typeof i === 'object').slice(0, 300).map(i => ({ ...i, id: slId(), type: SL_TYPES[i.type] ? i.type : 'song', title: cleanText(i.title).slice(0, 120), artist: cleanText(i.artist).slice(0, 120), note: cleanText(i.note).slice(0, 300) }));
      const nm = String(o.name || 'Import').slice(0, 80);
      await slNewList({ name: nm, gigId: '', start: /^\d\d:\d\d$/.test(o.start || '') ? o.start : '', targetMin: +o.targetMin || 0, vis: 'intern', items });
      const L = slCur(); if (L) { L.name = nm + ' (Import)'; slSave(L); renderSetlist(); }
      flash('Setlist importiert ✓');
    } catch (err) { flash('Datei konnte nicht gelesen werden (kein StageMate-JSON)', true); }
  });
  // ==DOCX-PDF-START  Word- und PDF-Datei ohne Fremdbibliothek (Zip ohne Kompression, einfaches PDF)
  const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcT[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zipStore(files) {   // files: [{ name, data: string (UTF-8) }]
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    const u16 = v => [v & 255, v >> 8 & 255], u32 = v => [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255];
    files.forEach(f => {
      const nm = enc.encode(f.name), d = enc.encode(f.data), crc = crc32(d);
      const lh = Uint8Array.from([0x50, 0x4B, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), ...u16(0)]);
      parts.push(lh, nm, d);
      cen.push(Uint8Array.from([0x50, 0x4B, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += lh.length + nm.length + d.length;
    });
    const cLen = cen.reduce((a, b) => a + b.length, 0);
    const end = Uint8Array.from([0x50, 0x4B, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cLen), ...u32(off), ...u16(0)]);
    return new Blob([...parts, ...cen, end], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  const xmlEsc = v => String(v == null ? '' : v).normalize('NFC').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  // doc = { title, sub, rows: [{ num, clock, title, artist, dur, key, note, special }] }
  function buildDocx(doc) {
    const run = (t, o = {}) => `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${o.sz || 22}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r>`;
    const cell = (w, inner, bd) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${bd ? '<w:tcBorders><w:bottom w:val="single" w:sz="4" w:color="BBBBBB"/></w:tcBorders>' : ''}</w:tcPr><w:p>${inner}</w:p></w:tc>`;
    const W = [600, 800, 4200, 800, 1500, 2000];
    const head = ['Nr', 'Zeit', 'Titel', 'Länge', 'Tonart', 'Notiz'];
    const tr = (cells, bd) => `<w:tr>${cells.map((c, i) => cell(W[i], c, bd)).join('')}</w:tr>`;
    const rows = [tr(head.map(h => run(h, { b: 1, sz: 20 })), true)].concat(doc.rows.map(r => tr([
      run(r.num ? r.num + '.' : '', { b: 1, sz: 24 }), run(r.clock || '', { color: '666666', sz: 20 }),
      run(r.title, { b: !r.special, i: r.special }) + (r.artist ? run('  – ' + r.artist, { color: '666666', sz: 20 }) : ''),
      run(r.dur || '', { sz: 20 }), run(r.key || '', { sz: 20 }), run(r.note || '', { color: '666666', sz: 20 })], true)));
    const body = `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${run(doc.title, { b: 1, sz: 40 })}</w:p><w:p><w:pPr><w:spacing w:after="200"/></w:pPr>${run(doc.sub, { color: '666666', sz: 22 })}</w:p>` +
      `<w:tbl><w:tblPr><w:tblW w:w="${W.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${W.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>` +
      `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;
    return zipStore([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>` }]);
  }
  function buildPdf(doc) {
    const WIN = { '–': '\x96', '—': '\x97', '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '€': '\x80', '…': '\x85', '•': '\x95' };
    const enc = t => String(t == null ? '' : t).normalize('NFC').replace(/[\u0000-\u001F]/g, ' ').split('').map(ch => ch.charCodeAt(0) < 256 ? ch : (WIN[ch] || '?')).join('').replace(/([()\\])/g, '\\$1');
    const cut = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
    const pages = []; let cur = null, y = 0;
    const add = (font, size, x, text, gray) => { cur.push(`${gray ? '0.4 g' : '0 g'} BT /${font} ${size} Tf ${x} ${y} Td (${enc(text)}) Tj ET`); };
    const newPage = () => { cur = []; pages.push(cur); y = 800; };
    newPage(); add('F2', 20, 40, cut(doc.title, 60)); y -= 22; add('F1', 11, 40, cut(doc.sub, 100), true); y -= 28;
    const headRow = () => { add('F2', 10, 40, 'Nr'); add('F2', 10, 66, 'Zeit'); add('F2', 10, 112, 'Titel'); add('F2', 10, 440, 'Länge'); add('F2', 10, 490, 'Tonart'); y -= 6; cur.push(`0.7 G 40 ${y} m 555 ${y} l S`); y -= 16; };
    headRow();
    doc.rows.forEach(r => {
      const need = r.note ? 34 : 20;
      if (y - need < 50) { newPage(); headRow(); }
      if (r.num) add('F2', 13, 40, r.num + '.');
      add('F1', 10, 66, r.clock || '', true);
      add(r.special ? 'F3' : 'F2', 12, 112, cut(r.title + (r.artist ? ' – ' + r.artist : ''), 58));
      add('F1', 10, 440, r.dur || '', true); add('F1', 10, 490, cut(r.key || '', 12), true);
      if (r.note) { y -= 13; add('F1', 9, 112, cut(r.note, 90), true); }
      y -= 20;
    });
    const objs = [];   // 1 Catalog, 2 Pages, 3-5 Fonts, dann Seiten und Inhalte
    const fontObj = n => `<< /Type /Font /Subtype /Type1 /BaseFont /${n} /Encoding /WinAnsiEncoding >>`;
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[3] = fontObj('Helvetica'); objs[4] = fontObj('Helvetica-Bold'); objs[5] = fontObj('Helvetica-Oblique');
    const kids = [];
    pages.forEach((p, i) => {
      const pn = 6 + i * 2, cn = pn + 1, stream = p.join('\n');
      kids.push(pn + ' 0 R');
      objs[pn] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${cn} 0 R >>`;
      objs[cn] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });
    objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
    let out = '%PDF-1.4\n'; const offs = [];
    for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const xr = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
    const u8 = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u8[i] = out.charCodeAt(i) & 255;
    return new Blob([u8], { type: 'application/pdf' });
  }
  // ==DOCX-PDF-END
  // ================= Export (v0.6.2): ein Fenster für alle Seiten =================
  // Gleiche Dateinamen überall: Bereich_Name[_Datum].ext, z. B. Setlist_Bergfest-Interlaken_2026-12-08.pdf
  const xSlug = t => String(t || '').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  function xFile(area, name, date, ext) { return [area, xSlug(name), date ? xSlug(date) : ''].filter(Boolean).join('_') + '.' + ext; }
  async function xSave(filename, data, type) {
    const res = await Data.saveFile({ filename, data, type: type || (data instanceof Blob ? data.type : 'text/plain;charset=utf-8') });
    if (res === 'saved' || res === 'browser') flash('Exportiert: ' + filename);
    else flash(res === 'declined' ? 'Export abgebrochen' : 'Export ist hier nicht möglich', res !== 'declined');
  }
  const xCsv = (head, rows) => '\uFEFF' + [head].concat(rows).map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  // Einfache Tabelle als PDF (A4 hoch). cols: [{ h, w (Anteil), b (fett), g (grau), r (rechtsbündig) }], rows: Arrays oder { sec: 'Zwischentitel' }
  function tablePdf(doc) {
    const WIN = { '–': '\x96', '—': '\x97', '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '€': '\x80', '…': '\x85', '•': '\x95', '−': '-', '✓': 'x', '☐': ' ' };
    const enc = t => String(t == null ? '' : t).normalize('NFC').replace(/[\u0000-\u001F\u00A0\u202F]/g, ' ').split('').map(ch => ch.charCodeAt(0) < 256 ? ch : (WIN[ch] || '?')).join('').replace(/([()\\])/g, '\\$1');
    const cut = (t, n) => { t = String(t == null ? '' : t); return t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t; };
    const W = 515, tot = doc.cols.reduce((a, c) => a + (c.w || 1), 0); let x = 40;
    const cols = doc.cols.map(c => { const w = W * (c.w || 1) / tot, o = { ...c, x, w }; x += w; return o; });
    const pages = []; let cur = null, y = 0;
    const add = (font, size, xx, text, gray) => cur.push(`${gray ? '0.4 g' : '0 g'} BT /${font} ${size} Tf ${xx.toFixed(1)} ${y} Td (${enc(text)}) Tj ET`);
    const head = () => { cols.forEach(c => add('F2', 9, c.r ? c.x + c.w - 6 - String(c.h).length * 5 : c.x, c.h)); y -= 6; cur.push(`0.7 G 40 ${y} m 555 ${y} l S`); y -= 15; };
    const page = () => { cur = []; pages.push(cur); y = 800; };
    page(); add('F2', 18, 40, cut(doc.title, 60)); y -= 20; if (doc.sub) { add('F1', 10, 40, cut(doc.sub, 110), true); y -= 14; } y -= 12; head();
    doc.rows.forEach(r => {
      if (y < 60) { page(); head(); }
      if (r && r.sec) { y -= 4; if (y < 70) { page(); head(); } add('F2', 11, 40, cut(r.sec, 90)); y -= 5; cur.push(`0.85 G 40 ${y} m 555 ${y} l S`); y -= 13; return; }
      cols.forEach((c, i) => { const v = r[i], n = Math.floor(c.w / 5.1); const t = cut(v, n);
        add(c.b ? 'F2' : 'F1', 10, c.r ? c.x + c.w - 6 - t.length * 5 : c.x, t, c.g); });
      y -= 16;
    });
    const objs = [];
    const fontObj = n => `<< /Type /Font /Subtype /Type1 /BaseFont /${n} /Encoding /WinAnsiEncoding >>`;
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'; objs[3] = fontObj('Helvetica'); objs[4] = fontObj('Helvetica-Bold'); objs[5] = fontObj('Helvetica-Oblique');
    const kids = [];
    pages.forEach((pg, i) => { const pn = 6 + i * 2, cn = pn + 1, st = pg.concat([`0.5 g BT /F1 8 Tf 40 30 Td (${enc('StageMate · Seite ' + (i + 1) + ' von ' + pages.length)}) Tj ET`]).join('\n'); kids.push(pn + ' 0 R');
      objs[pn] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${cn} 0 R >>`;
      objs[cn] = `<< /Length ${st.length} >>\nstream\n${st}\nendstream`; });
    objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
    let out = '%PDF-1.4\n'; const offs = [];
    for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const xr = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
    const u8 = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u8[i] = out.charCodeAt(i) & 255;
    return new Blob([u8], { type: 'application/pdf' });
  }
  // Kalenderdatei (.ics) für Handy, Google, Outlook – Termine einzeln (Wiederholungen ausgeschrieben)
  function buildIcs(items, calName) {
    const esc = t => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    // Zeilen nach 75 Byte umbrechen (Umlaute und Emojis zählen mehrfach)
    const te = new TextEncoder(), fold = l => { const o = []; let cur = '', n = 0; for (const ch of l) { const b = te.encode(ch).length; if (n + b > 74) { o.push(cur); cur = ' '; n = 1; } cur += ch; n += b; } o.push(cur); return o.join('\r\n'); };
    const ymd = d => dKey(d).replace(/-/g, ''), hm = t => t.replace(':', '') + '00';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Housi//StageMate//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + esc(calName), 'X-WR-TIMEZONE:Europe/Zurich',
      'BEGIN:VTIMEZONE', 'TZID:Europe/Zurich', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
    items.forEach(({ ev, date }) => {
      L.push('BEGIN:VEVENT', 'UID:' + ev.id + '-' + ymd(date) + '@stagemate', 'DTSTAMP:' + stamp, 'SUMMARY:' + esc((ev.category === 'auftritt' ? '🎤 ' : '') + (ev.title || 'Termin')));
      if (ev.allDay || !ev.start) L.push('DTSTART;VALUE=DATE:' + ymd(date), 'DTEND;VALUE=DATE:' + ymd(addDays(date, 1)));
      else {
        L.push('DTSTART;TZID=Europe/Zurich:' + ymd(date) + 'T' + hm(ev.start));
        const e = ev.end && ev.end > ev.start ? ev.end : (() => { const m = Math.min(23 * 60 + 59, toMin(ev.start) + 60); return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); })();
        L.push('DTEND;TZID=Europe/Zurich:' + ymd(date) + 'T' + hm(e));
      }
      const loc = [ev.location, ev.address].filter(Boolean).join(', '); if (loc) L.push('LOCATION:' + esc(loc));
      const note = [catOf(ev.category).name, ev.notes].filter(Boolean).join('\n'); if (note) L.push('DESCRIPTION:' + esc(note));
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  // Termine im Zeitraum: 90 Tage zurück bis 1 Jahr voraus
  function xEvents(onlyGigs) {
    const t = dOnly(new Date()), out = [];
    calEvents.filter(ev => ev.date && ev.kind !== 'checklist' && (!onlyGigs || ev.category === 'auftritt')).forEach(ev => occurrences(ev, addDays(t, -90), addDays(t, 365)).forEach(date => out.push({ ev, date })));
    return out.sort((a, b) => a.date - b.date || (a.ev.start || '').localeCompare(b.ev.start || ''));
  }
  const xBand = () => (bands[currentBand] && bands[currentBand].name) || 'Band';
  const xEvRow = ({ ev, date }) => [fmtDateOv(date, ovCfg().date), ev.allDay ? 'ganztägig' : (ev.start || '') + (ev.end ? '–' + ev.end : ''), ev.title || 'Termin', catOf(ev.category).name, ev.location || ''];
  function evExport(kind, gigsOnly) {
    const list = xEvents(gigsOnly), area = gigsOnly ? 'Gigs' : 'Kalender';
    if (!list.length) return flash(gigsOnly ? 'Keine Gigs im Zeitraum' : 'Keine Termine im Zeitraum', true);
    if (kind === 'ics') return xSave(xFile(area, xBand(), '', 'ics'), buildIcs(list, xBand() + ' – ' + area), 'text/calendar;charset=utf-8');
    if (kind === 'csv') return xSave(xFile(area, xBand(), '', 'csv'), xCsv(['Datum', 'Zeit', 'Titel', 'Kategorie', 'Ort', 'Adresse', 'Notiz'], list.map(x => xEvRow(x).concat([x.ev.address || '', x.ev.notes || '']))), 'text/csv;charset=utf-8');
    xSave(xFile(area, xBand(), '', 'pdf'), tablePdf({ title: area + ' · ' + xBand(), sub: '90 Tage zurück bis 1 Jahr voraus · ' + list.length + ' Einträge',
      cols: [{ h: 'Datum', w: 1.5 }, { h: 'Zeit', w: 1.3 }, { h: 'Titel', w: 3.8, b: 1 }, { h: 'Kategorie', w: 1.6, g: 1 }, { h: 'Ort', w: 2.4, g: 1 }], rows: list.map(xEvRow) }));
  }
  // Checklisten: alle kommenden und ohne Datum, wie auf der Seite
  function clExport(kind) {
    const t = dOnly(new Date());
    const all = clpItems().filter(x => !x.date || x.date >= t).sort((a, b) => (a.date ? a.date - b.date : 1) || (a.ev.title || '').localeCompare(b.ev.title || ''));
    const blocks = all.map(({ ev, date }) => {
      const list = ev.checklists && Array.isArray(ev.checklists[clDk(ev, date)]) ? ev.checklists[clDk(ev, date)] : [];
      const rows = [];
      list.forEach(r => { const its = Array.isArray(r.items) ? r.items : [], who = m => (Array.isArray(m) ? m : []).map(clName).join(', ');
        if (!its.length) rows.push([r.done ? '✓' : '☐', r.title || '', '', who(r.members)]);
        its.forEach(i => rows.push([i.done ? '✓' : '☐', r.title || '', i.title || '', who(i.members)])); });
      return { name: (ev.title || 'Checkliste') + (date ? ' · ' + fmtDateOv(date, ovCfg().date) : ''), rows };
    }).filter(b => b.rows.length);
    if (!blocks.length) return flash('Keine offenen Checklisten mit Punkten', true);
    if (kind === 'csv') return xSave(xFile('Checklisten', xBand(), '', 'csv'), xCsv(['Checkliste', 'Erledigt', 'Reiter', 'Punkt', 'Übernommen von'], [].concat(...blocks.map(b => b.rows.map(r => [b.name, r[0] === '✓' ? 'ja' : 'nein', r[1], r[2], r[3]])))), 'text/csv;charset=utf-8');
    if (kind === 'txt') return xSave(xFile('Checklisten', xBand(), '', 'txt'), '\uFEFF' + blocks.map(b => b.name + '\r\n' + b.rows.map(r => `  [${r[0] === '✓' ? 'x' : ' '}] ${r[1]}${r[2] ? ' › ' + r[2] : ''}${r[3] ? '  (' + r[3] + ')' : ''}`).join('\r\n')).join('\r\n\r\n'), 'text/plain;charset=utf-8');
    xSave(xFile('Checklisten', xBand(), '', 'pdf'), tablePdf({ title: 'Checklisten · ' + xBand(), sub: blocks.length + ' Checklisten (kommend und ohne Datum)',
      cols: [{ h: '', w: 0.5 }, { h: 'Reiter', w: 2.6, b: 1 }, { h: 'Punkt', w: 4 }, { h: 'Übernommen von', w: 2.4, g: 1 }],
      rows: [].concat(...blocks.map(b => [{ sec: b.name }].concat(b.rows.map(r => [r[0] === '✓' ? '[x]' : '[  ]', r[1], r[2], r[3]])))) }));
  }
  function songExport(kind) {
    const list = songsSorted('', { by: 'title', dir: 1 });
    if (!list.length) return flash('Noch keine Songs', true);
    const row = x => [x.title || '', x.artist || '', x.album ? (SL_REL[x.relType] || 'Album') + ': ' + x.album : '', x.year || '', x.genre || '', slFmt(x.dur), x.key || '', x.bpm || ''];
    if (kind === 'csv') return xSave(xFile('Songs', xBand(), '', 'csv'), xCsv(['Titel', 'Interpret', 'Veröffentlichung', 'Jahr', 'Genre', 'Länge', 'Tonart', 'BPM', 'Notiz'], list.map(x => row(x).concat([x.note || '']))), 'text/csv;charset=utf-8');
    xSave(xFile('Songs', xBand(), '', 'pdf'), tablePdf({ title: 'Songs · ' + xBand(), sub: list.length + ' Songs',
      cols: [{ h: 'Titel', w: 3, b: 1 }, { h: 'Interpret', w: 2, g: 1 }, { h: 'Veröffentlichung', w: 2.6, g: 1 }, { h: 'Jahr', w: 0.8 }, { h: 'Länge', w: 0.9 }, { h: 'Tonart', w: 0.9 }, { h: 'BPM', w: 0.7 }],
      rows: list.map(x => { const r = row(x); return [r[0], r[1], r[2], r[3], r[5], r[6], r[7]]; }) }));
  }
  // Formate je Seite. lock: später für Bezahlfunktionen (Schloss wie beim Tutorial)
  const F = (id, ico, label, desc, run) => ({ id, ico, label, desc, run });
  const X_PAGES = {
    setlist: { title: 'Setlist', what: () => { const L = slCur(); return L ? '„' + (L.name || 'Setlist') + '“' : ''; }, ok: () => !!slCur(),
      formats: [F('pdffile', '📄', 'PDF', 'Zum Ausdrucken oder Weiterschicken, schlicht und gut lesbar.', () => slExport('pdffile')),
        F('pdf', '🖨️', 'Drucken (Bühne)', 'Öffnet eine Druckansicht mit grosser Schrift für den Bühnenboden.', () => slExport('pdf')),
        F('docx', '📝', 'Word', 'Zum Weiterbearbeiten in Word oder Google Docs.', () => slExport('docx')),
        F('txt', '🔤', 'Text', 'Einfache Liste zum Einfügen in Chats oder E-Mails.', () => slExport('txt')),
        F('csv', '📊', 'CSV', 'Tabelle für Excel mit allen Angaben pro Song.', () => slExport('csv')),
        F('json', '🗂️', 'JSON', 'Sicherung, die StageMate wieder importieren kann.', () => slExport('json'))] },
    timetable: { title: 'Timetable', what: () => { const g = calEvents.find(e => e.id === ttSel); return g ? '„' + (g.title || 'Gig') + '“' : ''; }, ok: () => !!ttSel && ttEntries(ttSel).length > 0,
      formats: [F('pdf', '📄', 'PDF', 'Ablauf zum Aushängen oder Weiterschicken.', () => ttExport('pdf')),
        F('txt', '🔤', 'Text', 'Einfache Liste zum Einfügen in Chats.', () => ttExport('txt')),
        F('csv', '📊', 'CSV', 'Tabelle für Excel.', () => ttExport('csv'))] },
    finance: { title: 'Finanzen', what: () => 'Jahr ' + finYear, ok: () => true,
      formats: [F('pdf', '📄', 'PDF', 'Übersicht mit Summen, zum Ablegen oder Weitergeben.', () => finExport('pdf')),
        F('csv', '📊', 'CSV', 'Alle Buchungen als Tabelle für Excel.', () => finExport('csv'))] },
    calendar: { title: 'Kalender', what: () => 'Alle Termine, 90 Tage zurück bis 1 Jahr voraus', ok: () => true,
      formats: [F('ics', '📅', 'Kalenderdatei (.ics)', 'Termine ins Handy, Google oder Outlook übernehmen.', () => evExport('ics')),
        F('pdf', '📄', 'PDF', 'Terminliste zum Ausdrucken.', () => evExport('pdf')),
        F('csv', '📊', 'CSV', 'Terminliste für Excel.', () => evExport('csv'))] },
    gigs: { title: 'Gigs', what: () => 'Alle Gigs, 90 Tage zurück bis 1 Jahr voraus', ok: () => true,
      formats: [F('ics', '📅', 'Kalenderdatei (.ics)', 'Gigs ins Handy, Google oder Outlook übernehmen.', () => evExport('ics', true)),
        F('pdf', '📄', 'PDF', 'Gigliste zum Ausdrucken.', () => evExport('pdf', true)),
        F('csv', '📊', 'CSV', 'Gigliste für Excel.', () => evExport('csv', true))] },
    checklist: { title: 'Checklisten', what: () => 'Kommende Checklisten und solche ohne Datum', ok: () => true,
      formats: [F('pdf', '📄', 'PDF', 'Zum Abhaken auf Papier.', () => clExport('pdf')),
        F('txt', '🔤', 'Text', 'Einfache Liste zum Einfügen in Chats.', () => clExport('txt')),
        F('csv', '📊', 'CSV', 'Tabelle für Excel.', () => clExport('csv'))] },
    songs: { title: 'Songs', what: () => 'Alle Songs der Band', ok: () => true,
      formats: [F('pdf', '📄', 'PDF', 'Songliste zum Ausdrucken.', () => songExport('pdf')),
        F('csv', '📊', 'CSV', 'Tabelle für Excel mit allen Angaben.', () => songExport('csv'))] }
  };
  function openExport(page) {
    const P = X_PAGES[page]; if (!P) return;
    if (!P.ok()) return flash('Hier gibt es noch nichts zu exportieren', true);
    $('xH').textContent = '⤓ Exportieren – ' + P.title; $('xWhat').textContent = P.what() || '';
    const g = $('xGrid'); g.innerHTML = '';
    P.formats.forEach(f => {
      const b = el('button', 'x-tile' + (f.lock ? ' pv-locked' : '')); b.type = 'button';
      b.append(el('span', 'x-ico', f.ico), el('span', 'x-l', f.label), el('span', 'x-d', f.desc));
      b.addEventListener('click', () => { if (f.lock) return flash('Diese Funktion ist gesperrt', true); closeExport(); try { f.run(); } catch (err) { console.error(err); flash('Export fehlgeschlagen', true); } });
      g.appendChild(b);
    });
    $('xModal').classList.remove('hidden');
  }
  const closeExport = () => $('xModal').classList.add('hidden');
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-export]'); if (b) openExport(b.dataset.export); });
  $('xClose').addEventListener('click', closeExport);
  $('xModal').addEventListener('click', e => { if (e.target === $('xModal')) closeExport(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('xModal').classList.contains('hidden')) closeExport(); });
  // Setlist-Export: Text, CSV, JSON, Word, PDF, Drucken (aufgerufen aus dem Export-Fenster)
  function slExport(kind) {
    const L = slCur(); if (!L) return; const T = slTimes(L);
    const slG = calEvents.find(e => e.id === L.gigId), slFn = ext => xFile('Setlist', L.name || 'Setlist', slG && slG.date, ext);
    if (kind === 'docx' || kind === 'pdffile') {
      const g = calEvents.find(e => e.id === L.gigId);
      const doc = { title: L.name || 'Setlist', sub: (g ? 'Gig: ' + (g.title || '') + (g.date ? ' (' + fmtDateOv(parseKey(g.date), ovCfg().date) + ')' : '') + ' · ' : '') + 'Gesamt ' + slFmt(T.total),
        rows: T.rows.map(r => ({ num: r.num || '', clock: r.clock || '', title: r.it.title || SL_TYPES[r.it.type].label, artist: r.it.artist || '', dur: slFmt(r.it.dur), key: [r.it.key, r.it.bpm ? r.it.bpm + ' BPM' : ''].filter(Boolean).join(' · '), note: r.it.note || '', special: !r.num })) };
      return xSave(slFn(kind === 'docx' ? 'docx' : 'pdf'), kind === 'docx' ? buildDocx(doc) : buildPdf(doc));
    }
    if (kind === 'pdf') {
      // Druckansicht: gross und gut lesbar auf der Bühne; „Als PDF speichern“ im Druckdialog
      const g = calEvents.find(e => e.id === L.gigId), esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const rows = T.rows.map(r => `<tr class="${r.num ? '' : 'x'}"><td class="n">${r.num || ''}</td><td class="t">${esc(r.clock)}</td><td>${esc(r.it.title || SL_TYPES[r.it.type].label)}${r.it.artist ? ' <small>– ' + esc(r.it.artist) + '</small>' : ''}${r.it.note ? '<div class="no">' + esc(r.it.note) + '</div>' : ''}</td><td class="k">${esc(r.it.key)}${r.it.bpm ? ' · ' + r.it.bpm + ' BPM' : ''}</td><td class="d">${slFmt(r.it.dur)}</td></tr>`).join('');
      const w = window.open('', '_blank');
      if (!w) return flash('Das Druckfenster wurde blockiert. Bitte Pop-ups erlauben.', true);
      w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(L.name || 'Setlist')}</title><style>body{font:16px system-ui,sans-serif;margin:24px;color:#111}h1{margin:0 0 4px}p{margin:0 0 14px;color:#555}table{width:100%;border-collapse:collapse}td{padding:7px 8px;border-bottom:1px solid #ccc;vertical-align:top}.n{width:34px;font-weight:700;font-size:20px}.t{width:60px;color:#555}.k,.d{white-space:nowrap;color:#555;text-align:right}.x td{color:#555;font-style:italic}small{color:#555}.no{font-size:13px;color:#555}@media print{body{margin:10mm}}</style><h1>${esc(L.name || 'Setlist')}</h1><p>${g ? 'Gig: ' + esc(g.title || '') + ' · ' : ''}Gesamt ${slFmt(T.total)}</p><table>${rows}</table>`);
      w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (e) {} }, 400);
      return;
    }
    const gig = calEvents.find(e => e.id === L.gigId), safe = (L.name || 'Setlist').replace(/[^\p{L}\p{N}_ -]+/gu, '').trim() || 'Setlist';
    let txt, mime;
    if (kind === 'json') { txt = JSON.stringify({ name: L.name, gig: gig ? gig.title : '', start: L.start || '', targetMin: L.targetMin || 0, items: L.items }, null, 2); mime = 'application/json'; }
    else if (kind === 'csv') {
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      txt = '﻿' + ['Nr', 'Uhrzeit', 'Art', 'Titel', 'Interpret', 'Veröffentlichung', 'Name', 'Jahr', 'Genre', 'Länge', 'Tonart', 'BPM', 'Notiz'].map(q).join(';') + '\r\n' +
        T.rows.map(r => [r.num || '', r.clock, SL_TYPES[r.it.type].label, r.it.title, r.it.artist, r.it.album ? (SL_REL[r.it.relType] || 'Album') : '', r.it.album, r.it.year || '', r.it.genre, slFmt(r.it.dur), r.it.key, r.it.bpm || '', r.it.note].map(q).join(';')).join('\r\n'); mime = 'text/csv';
    } else {
      txt = '\uFEFF' + [L.name || 'Setlist', gig ? `Gig: ${gig.title || ''}${gig.date ? ' (' + fmtDateOv(parseKey(gig.date), ovCfg().date) + ')' : ''}` : '', `Gesamt: ${slFmt(T.total)}`, ''].filter((x, i) => x || i === 3).join('\r\n') + '\r\n' +
        T.rows.map(r => `${r.num ? String(r.num).padStart(2) + '.' : ' · '} ${r.clock ? r.clock + '  ' : ''}${r.it.title || SL_TYPES[r.it.type].label}${r.it.artist ? ' – ' + r.it.artist : ''}  (${slFmt(r.it.dur)})${r.it.key ? '  [' + r.it.key + ']' : ''}${r.it.note ? '  ' + r.it.note : ''}`).join('\r\n'); mime = 'text/plain';
    }
    xSave(slFn(kind), txt, mime + ';charset=utf-8');
  }

  // Setlist -> Timetable des zugewiesenen Gigs (Start, Ende, Songzahl, Verknüpfung)
  $('slToTT').addEventListener('click', e => {
    const L = slCur(); if (!L) return;
    if (!ttCan()) return previewBlocked(e, viewAs ? undefined : 'Keine Berechtigung: Für die Timetable brauchst du das Recht „Bearbeiten“.');
    const gig = calEvents.find(x => x.id === L.gigId);
    if (!gig) return flash('Zuerst oben einen Gig zuweisen', true);
    const T = slTimes(L);
    if (!T.hasStart) return flash('Zuerst die Beginn-Uhrzeit der Setlist setzen', true);
    ttSub();
    const TL = ttList(gig.id), end = slClock(T.base, T.total), songs = T.rows.filter(r => r.num).length;
    let x = TL.entries.find(en => en.setlistId === L.id);
    const f = { time: L.start, band: (bands[currentBand] && bands[currentBand].name) || 'Band', end, dur: 0, songs, setlistId: L.id };
    if (x) Object.assign(x, f); else TL.entries.push({ id: slId(), note: '', ...f });
    ttSave(gig.id);
    flash(x ? 'Timetable aktualisiert' : 'In die Timetable eingetragen');
  });
  // ================= Timetable (Seite 8) =================
  // timetables/<Band>/lists/<gigId> { gigId, entries:[{id,time,title,note}] }
  let ttMap = {}, ttBand = null, ttUnsub = null, ttSel = null, ttPend = null, ttSaveT = null, ttEdit = null;
  const ttCan = () => levelFor(currentBand, 'page8') === 'edit' && !viewAs;
  const ttDeny = () => previewBlocked(null, viewAs ? undefined : 'Keine Berechtigung: Du hast für die Timetable nur Leserechte. Bitte den Admin, dir das Recht „Bearbeiten“ zu geben.');
  const ttCalOn = () => { try { return ls.get('ttCal') !== '0'; } catch (e) { return true; } };
  const ttName = x => (x.band || x.title || '').trim();
  const ttEnd = (x, nextT) => x.end && /^\d\d:\d\d$/.test(x.end) ? toMin(x.end) : (+x.dur > 0 ? toMin(x.time) + +x.dur : (nextT != null ? toMin(nextT) : toMin(x.time) + 30));
  const ttSetName = x => { const l = x.setlistId && slLists.find(y => y.id === x.setlistId); return l ? (l.name || 'Setlist') : ''; };
  const ttEntries = id => ((ttMap[id] || {}).entries || []).filter(x => /^\d\d:\d\d$/.test(x.time || '')).sort((a, b) => a.time.localeCompare(b.time));
  function ttSub() {
    if (ttBand === currentBand) return;
    ttBand = currentBand; ttMap = {}; try { ttUnsub && ttUnsub(); } catch (e) {} ttUnsub = null;
    const b0 = currentBand, c = db.collection(`timetables/${currentBand}/lists`);
    const a = snap => {
      if (ttBand !== b0) return;
      const keep = ttPend && ttMap[ttPend]; ttMap = {};
      snap.docs.forEach(d => { ttMap[d.id] = keep && d.id === ttPend ? keep : { id: d.id, ...d.data() }; });
      if (currentPage === 'page8') { if ($('ttModal').classList.contains('hidden')) renderTimetable(); }
      else if (currentPage === 'page3') renderGigs();
      else if (currentPage === 'page2' && calView === 'day' && ttCalOn()) renderCalendar(0);
      else if (currentPage === 'overview') renderOverview();
    };
    try { ttUnsub = c.onSnapshot ? c.onSnapshot(a) : null; } catch (e) { ttUnsub = null; }
    if (!ttUnsub) c.get().then(a).catch(() => {});
  }
  function ttSave(gid) {
    const L = ttMap[gid]; if (!L) return;
    clearTimeout(ttSaveT); ttPend = gid; L.updatedAt = new Date().toISOString();
    ttSaveT = setTimeout(() => {
      const d = clone(L); delete d.id;
      db.collection(`timetables/${currentBand}/lists`).doc(gid).set(d).catch(() => flash('Timetable konnte nicht gespeichert werden', true));
      setTimeout(() => { if (ttPend === gid) ttPend = null; }, 1500);
    }, 300);
  }
  function ttList(gid) { if (!ttMap[gid]) ttMap[gid] = { id: gid, gigId: gid, entries: [] }; return ttMap[gid]; }
  // Verknüpfung mit Checklisten-Punkt des Gigs (Eintrag speichert nur die Punkt-ID: clId)
  function ttGigItems(gid) {
    const ev = slGigs().find(e => e.id === gid); if (!ev || !ev.checklists) return [];
    const list = Array.isArray(ev.checklists[ev.date]) ? ev.checklists[ev.date] : (Object.values(ev.checklists).find(Array.isArray) || []);
    const out = [];
    list.forEach(r => (r.items || []).forEach(i => out.push({ id: i.id, title: i.title, reiter: r.title, done: !!i.done })));
    return out;
  }
  function openTimetable() {
    ttSub();
    const gigs = slGigs(), todayK = dKey(dOnly(new Date()));
    if (!ttSel || !gigs.some(g => g.id === ttSel)) { const n = gigs.find(g => g.date >= todayK) || gigs[gigs.length - 1]; ttSel = n ? n.id : null; }
    renderTimetable();
  }
  function renderTimetable() {
    const gigs = slGigs(), sel = $('ttGig'); sel.innerHTML = '';
    gigs.forEach(e => sel.appendChild(new Option(`${fmtDateOv(parseKey(e.date), ovCfg().date)} · ${e.title || 'Gig'}`, e.id)));
    if (ttSel) sel.value = ttSel;
    const has = !!ttSel, can = ttCan();
    $('ttGo').disabled = !has;
    ['ttAdd', 'ttImport', 'ttCopy'].forEach(i => { $(i).disabled = !has; $(i).classList.toggle('pv-locked', !can); });
    const box = $('ttItems'); box.innerHTML = '';
    $('ttEmpty').classList.toggle('hidden', has && ttEntries(ttSel).length > 0);
    $('ttEmpty').textContent = has ? 'Noch keine Einträge. Mit „+ Eintrag“ oder „Import“ legst du den Ablauf an.' : 'Es gibt noch keinen Gig. Lege zuerst im Kalender einen Auftritt an.';
    if (!has) return;
    const c = ovCfg();
    ttEntries(ttSel).forEach(x => {
      const row = el('button', 'tt-row'); row.type = 'button';
      const m = el('div', 'tt-main'); m.append(el('div', 'tt-title', ttName(x)));
      const sub = [x.end ? 'bis ' + fmtHHMM(x.end, c.time) : (+x.dur > 0 ? x.dur + ' Min.' : ''), +x.songs > 0 ? x.songs + ' Songs' : '', x.note].filter(Boolean).join(' · ');
      if (sub) m.append(el('div', 'tt-note', sub));
      const sn = ttSetName(x);
      if (sn) { const lk = el('span', 'tt-setlink', '🎼 ' + sn); lk.title = 'Zur Setlist'; lk.addEventListener('click', e => { e.stopPropagation(); slJump = x.setlistId; showPage('page6'); }); m.append(lk); }
      if (x.clId) { const ci = ttGigItems(ttSel).find(i => i.id === x.clId); if (ci) m.append(el('span', 'tt-setlink', (ci.done ? '✅ ' : '☐ ') + ci.title)); }
      if (x.bandId && x.bandId !== currentBand && bands[x.bandId]) { const bl = el('span', 'tt-setlink', '↗ ' + bands[x.bandId].name); bl.title = 'Zu dieser Band wechseln'; bl.addEventListener('click', e => { e.stopPropagation(); $('bandSwitch').value = x.bandId; $('bandSwitch').dispatchEvent(new Event('change')); }); m.append(bl); }
      row.append(el('div', 'tt-time', fmtHHMM(x.time, c.time)), m);
      row.addEventListener('click', () => ttOpen(x));
      box.appendChild(row);
    });
  }
  function ttOpen(x) {
    if (!ttCan()) return ttDeny();
    ttEdit = x || null;
    $('ttH').textContent = x ? 'Eintrag bearbeiten' : 'Neuer Eintrag';
    slSub();
    const ss = $('ttSet'); ss.innerHTML = ''; ss.appendChild(new Option('– keine –', ''));
    slLists.forEach(l => ss.appendChild(new Option(l.name || 'Setlist', l.id)));
    const bs = $('ttBand'); bs.innerHTML = ''; bs.appendChild(new Option('– keine –', ''));
    Object.keys(bands).filter(id => id !== currentBand).forEach(id => bs.appendChild(new Option(bands[id].name || 'Band', id)));
    bs.value = x && bands[x.bandId] && x.bandId !== currentBand ? x.bandId : ''; $('ttBandWrap').classList.toggle('hidden', bs.options.length < 2);
    const cs = $('ttCl'); cs.innerHTML = ''; cs.appendChild(new Option('– keine –', ''));
    ttGigItems(ttSel).forEach(i => cs.appendChild(new Option((i.reiter ? i.reiter + ': ' : '') + i.title, i.id)));
    cs.value = x ? (x.clId || '') : ''; $('ttClWrap').classList.toggle('hidden', cs.options.length < 2);
    $('ttTime').value = x ? x.time : ''; $('ttTitle').value = x ? ttName(x) : ''; $('ttNote').value = x ? (x.note || '') : '';
    $('ttEnd').value = x ? (x.end || '') : ''; $('ttDur').value = x && +x.dur > 0 ? x.dur : ''; $('ttSongs').value = x && +x.songs > 0 ? x.songs : ''; ss.value = x ? (x.setlistId || '') : '';
    $('ttDel').classList.toggle('hidden', !x); $('ttMsg').textContent = '';
    $('ttModal').classList.remove('hidden'); setTimeout(() => $('ttTitle').focus(), 60);
  }
  const ttClose = () => $('ttModal').classList.add('hidden');
  $('ttGig').addEventListener('change', () => { ttSel = $('ttGig').value; renderTimetable(); });
  $('ttAdd').addEventListener('click', () => ttOpen(null));
  $('ttBand').addEventListener('change', () => { const id = $('ttBand').value; if (id && !$('ttTitle').value.trim()) $('ttTitle').value = bands[id].name || ''; });
  $('ttGo').addEventListener('click', () => { const ev = slGigs().find(e => e.id === ttSel); if (ev) openEventModal({ ev, occ: parseKey(ev.date) }); });
  $('ttClose').addEventListener('click', ttClose); $('ttCancel').addEventListener('click', ttClose);
  $('ttSave').addEventListener('click', () => {
    const time = $('ttTime').value, band = $('ttTitle').value.trim();
    if (!band) { $('ttMsg').textContent = 'Bitte den Bandnamen angeben (Pflicht).'; return; }
    if (!/^\d\d:\d\d$/.test(time)) { $('ttMsg').textContent = 'Bitte die Startzeit angeben (Pflicht).'; return; }
    const end = $('ttEnd').value, dur = Math.max(0, parseInt($('ttDur').value, 10) || 0), songs = Math.max(0, parseInt($('ttSongs').value, 10) || 0);
    const f = { time, band, end: end || '', dur: end ? 0 : dur, songs, setlistId: $('ttSet').value || '', clId: $('ttCl').value || '', bandId: $('ttBand').value || '', note: $('ttNote').value.trim() };
    const L = ttList(ttSel);
    if (ttEdit) { const x = L.entries.find(e => e.id === ttEdit.id); if (x) { Object.assign(x, f); delete x.title; } }
    else L.entries.push({ id: slId(), ...f });
    ttSave(ttSel); ttClose(); renderTimetable();
  });
  $('ttDel').addEventListener('click', () => {
    if (!ttEdit || !confirm('Eintrag löschen?')) return;
    const L = ttList(ttSel); L.entries = L.entries.filter(e => e.id !== ttEdit.id); ttSave(ttSel); ttClose(); renderTimetable();
  });
  // Import: Text („19:00 - 19:45 Bandname“) oder CSV (Uhrzeit;Band;Ende;Dauer;Songs;Notiz)
  function csvSplit(line, sep) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out.map(x => x.trim());
  }
  const ttNorm = (h, m) => { h = +h; m = +m; return h > 23 || m > 59 ? null : pad2(h) + ':' + pad2(m); };
  function ttParse(text) {
    const res = []; let bad = 0;
    // CSV-Spalten: Uhrzeit;Band;Ende;Dauer (Min.);Songs;Notiz
    String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach(raw => {
      const line = raw.trim(); if (!line) return;
      let m = line.match(/^"?(\d{1,2})[:.](\d{2})"?\s*([;\t,])(.*)$/);
      if (m) {
        const t = ttNorm(m[1], m[2]), c = csvSplit(m[4], m[3]);
        const e = (c[1] || '').match(/^(\d{1,2})[:.](\d{2})$/);
        if (t && c[0]) return res.push({ time: t, band: c[0], end: e ? ttNorm(e[1], e[2]) || '' : '', dur: e ? 0 : (parseInt(c[2], 10) || 0), songs: parseInt(c[3], 10) || 0, note: (c[4] || '').trim() });
      }
      m = line.match(/^(\d{1,2})[:.](\d{2})(?:\s*[-–]\s*(\d{1,2})[:.](\d{2}))?\s*(?:Uhr)?\s*[-–:]?\s*(.+)$/);
      if (m) { const t = ttNorm(m[1], m[2]); if (t) return res.push({ time: t, band: m[5].trim(), end: m[3] ? ttNorm(m[3], m[4]) || '' : '', dur: 0, songs: 0, note: '' }); }
      if (res.length || !/uhrzeit|zeit|time/i.test(line)) bad++;   // Kopfzeile still überspringen
    });
    return { res, bad };
  }
  // Vorlage: Ablauf eines anderen Gigs übernehmen (ohne Setlist-Verknüpfung)
  $('ttCopy').addEventListener('click', () => {
    if (!ttCan()) return ttDeny(); if (!ttSel) return;
    const srcs = slGigs().filter(g => g.id !== ttSel && ttEntries(g.id).length);
    if (!srcs.length) return flash('Kein anderer Gig hat schon eine Timetable', true);
    const bg = el('div', 'modal-bg'), md = el('div', 'modal'); md.setAttribute('role', 'dialog');
    md.append(el('h3', null, 'Ablauf übernehmen von …'), el('p', 'hint', 'Die Einträge werden zu den bestehenden hinzugefügt. Setlist-Verknüpfungen werden nicht übernommen.'));
    const sel = el('select'); srcs.forEach(g => sel.appendChild(new Option(`${fmtDateOv(parseKey(g.date), ovCfg().date)} · ${g.title || 'Gig'} (${ttEntries(g.id).length} Einträge)`, g.id)));
    const row = el('div', 'modal-actions'), ok = el('button', 'btn', 'Übernehmen'), no = el('button', 'btn ghost', 'Abbrechen'); ok.type = no.type = 'button';
    row.append(no, ok); md.append(sel, row); bg.append(md); document.body.appendChild(bg);
    no.addEventListener('click', () => bg.remove());
    ok.addEventListener('click', () => {
      const TL = ttList(ttSel);
      ttEntries(sel.value).forEach(x => { const { setlistId, ...rest } = x; TL.entries.push({ ...clone(rest), id: slId() }); });
      ttSave(ttSel); bg.remove(); renderTimetable(); flash('Ablauf übernommen ✓');
    });
  });
  $('ttImport').addEventListener('click', () => { if (!ttCan()) return ttDeny(); $('ttImpText').value = ''; $('ttImpMsg').textContent = ''; $('ttImpFile').value = ''; $('ttImpModal').classList.remove('hidden'); });
  const ttImpClose = () => $('ttImpModal').classList.add('hidden');
  $('ttImpClose').addEventListener('click', ttImpClose); $('ttImpCancel').addEventListener('click', ttImpClose);
  $('ttImpFile').addEventListener('change', () => {
    const f = $('ttImpFile').files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { $('ttImpText').value = String(r.result || ''); }; r.readAsText(f, 'utf-8');
  });
  $('ttImpGo').addEventListener('click', () => {
    const { res, bad } = ttParse($('ttImpText').value);
    if (!res.length) { $('ttImpMsg').textContent = 'Keine Zeilen mit Uhrzeit gefunden. Beispiel: 16:00 Soundcheck'; return; }
    const L = ttList(ttSel);
    if ($('ttImpMode').value === 'replace') L.entries = [];
    res.forEach(x => L.entries.push({ id: slId(), setlistId: '', ...x, band: cleanText(x.band || x.title).slice(0, 80), note: cleanText(x.note).slice(0, 200) }));
    ttSave(ttSel); ttImpClose(); renderTimetable();
    flash(res.length + ' Einträge übernommen' + (bad ? `, ${bad} Zeilen übersprungen` : ''));
  });
  function ttExport(kind) {
    if (!ttSel) return; const g = calEvents.find(e => e.id === ttSel) || {}, list = ttEntries(ttSel);
    if (!list.length) return flash('Die Timetable ist leer', true);
    if (kind === 'pdf') return xSave(xFile('Timetable', g.title || 'Gig', g.date, 'pdf'), tablePdf({ title: 'Timetable · ' + (g.title || 'Gig'), sub: g.date ? fmtLong(parseKey(g.date)) : '',
      cols: [{ h: 'Zeit', w: 1.2 }, { h: 'Band / Programm', w: 4, b: 1 }, { h: 'Ende', w: 1 }, { h: 'Songs', w: 0.8 }, { h: 'Notiz', w: 3.5, g: 1 }],
      rows: list.map(x => [x.time, ttName(x), x.end || (+x.dur > 0 ? x.dur + ' Min.' : ''), +x.songs > 0 ? x.songs : '', x.note]) }));
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const txt = kind === 'csv' ? '\uFEFF' + ['Uhrzeit', 'Band', 'Ende', 'Dauer (Min.)', 'Songs', 'Notiz'].map(q).join(';') + '\r\n' + list.map(x => [x.time, ttName(x), x.end || '', x.dur || '', x.songs || '', x.note].map(q).join(';')).join('\r\n')
      : '\uFEFF' + list.map(x => `${x.time}${x.end ? ' - ' + x.end : ''} ${ttName(x)}${x.songs ? ' (' + x.songs + ' Songs)' : ''}${x.note ? ' – ' + x.note : ''}`).join('\r\n');
    xSave(xFile('Timetable', g.title || 'Gig', g.date, kind === 'csv' ? 'csv' : 'txt'), txt, (kind === 'csv' ? 'text/csv' : 'text/plain') + ';charset=utf-8');
  }
  // Kalender: Schalter in der Tagesansicht
  function ttCalBtn() { const b = $('calTT'); b.classList.toggle('on', ttCalOn()); b.textContent = '⏱ Timetable: ' + (ttCalOn() ? 'an' : 'aus'); }
  $('calTT').addEventListener('click', () => { try { ls.set('ttCal', ttCalOn() ? '0' : '1'); } catch (e) {} ttCalBtn(); renderCalendar(0); });
  ttCalBtn();

  // ================= Finanzen: befindet sich im Bau =================
  const FIN_LOCKED = false;   // seit v0.4.28 freigegeben (true = für alle gesperrt)
  const FIN_LOCK = 'Finanzen befinden sich im Bau – diese Funktion ist noch gesperrt.';
  $('buildOk').addEventListener('click', () => $('buildModal').classList.add('hidden'));
  $('buildModal').addEventListener('click', e => { if (e.target === $('buildModal')) $('buildModal').classList.add('hidden'); });
  if (FIN_LOCKED) $('page-finance').classList.add('fin-locked');
  if (FIN_LOCKED) $('page-finance').addEventListener('click', e => {
    const t = e.target.closest('button, select, input, a, .fin-row, label');
    if (!t) return;
    e.preventDefault(); e.stopPropagation(); previewBlocked(e, FIN_LOCK);
  }, true);
  if (FIN_LOCKED) ['mousedown', 'keydown', 'change', 'focusin'].forEach(ev => $('page-finance').addEventListener(ev, e => {
    if (e.target.closest('select, input')) { e.preventDefault(); if (ev === 'focusin') e.target.blur(); }
  }, true));

  // ================= Finanzen (Seite 5) =================
  // Gespeichert unter finance/<Band>/entries/<id>: { type: 'in'|'out', amount, date, title, cat, gigId, note, createdBy, ... }
  const FIN_CATS = {
    in: ['Gage', 'Merch', 'Ticketverkauf', 'Förderbeitrag', 'Spende', 'Sonstiges'],
    out: ['Proberaum', 'Material & Technik', 'Transport', 'Verpflegung', 'Werbung', 'Gebühren', 'Sonstiges'],
  };
  let finEntries = [], finBand = null, finUnsub = null, finYear = new Date().getFullYear(), finEdit = null, finTypeSel = 'in';
  const chf = n => 'CHF ' + (Math.round(n * 100) / 100).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const finCanEdit = () => levelFor(currentBand, 'page5') === 'edit';
  const FIN_DENIED = 'Keine Berechtigung: Du hast für die Finanzen nur Leserechte. Bitte den Admin, dir das Recht „Bearbeiten“ für Finanzen zu geben.';
  function openFinance() {
    if (finBand !== currentBand) {
      finBand = currentBand; finEntries = [];
      if (finUnsub) { try { finUnsub(); } catch (e) {} finUnsub = null; }
      const col = db.collection(`finance/${currentBand}/entries`);
      const apply = snap => { finEntries = snap.docs.map(d => ({ id: d.id, ...d.data() })); if (currentPage === 'page5') renderFinance(); };
      try { finUnsub = col.onSnapshot ? col.onSnapshot(apply) : null; } catch (e) { finUnsub = null; }
      if (!finUnsub) col.get().then(apply).catch(() => {});
    }
    renderFinance();
  }
  async function finReload() { try { const sn = await db.collection(`finance/${currentBand}/entries`).get(); finEntries = sn.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) {} renderFinance(); }
  function renderFinance() {
    const can = finCanEdit();
    ['finAddIn', 'finAddOut'].forEach(id => $(id).classList.toggle('pv-locked', !can || !!viewAs));
    // Jahre: alle mit Einträgen + aktuelles
    const years = [...new Set([new Date().getFullYear(), finYear, ...finEntries.map(e => parseInt((e.date || '').slice(0, 4), 10)).filter(Boolean)])].sort((a, b) => b - a);
    const ys = $('finYear'); ys.innerHTML = '';
    years.forEach(y => ys.appendChild(new Option(String(y), String(y))));
    ys.value = String(finYear);
    const list = finEntries.filter(e => (e.date || '').startsWith(String(finYear))).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const sumIn = list.filter(e => e.type === 'in').reduce((n, e) => n + (+e.amount || 0), 0);
    const sumOut = list.filter(e => e.type === 'out').reduce((n, e) => n + (+e.amount || 0), 0);
    const saldo = sumIn - sumOut;
    const box = $('finSum'); box.innerHTML = '';
    const card = (k, v, cls, sub) => { const c = el('div', 'fin-card ' + cls); c.append(el('div', 'fk', k), el('div', 'fv', chf(v))); if (sub) c.append(el('div', 'fs', sub)); box.appendChild(c); };
    const nIn = list.filter(e => e.type === 'in').length, nOut = list.filter(e => e.type === 'out').length;
    card('Einnahmen ' + finYear, sumIn, 'in', nIn === 1 ? '1 Eintrag' : nIn + ' Einträge');
    card('Ausgaben ' + finYear, sumOut, 'out', nOut === 1 ? '1 Eintrag' : nOut + ' Einträge');
    card('Saldo ' + finYear, saldo, saldo >= 0 ? 'pos' : 'neg', saldo >= 0 ? 'im Plus' : 'im Minus');
    // Aufteilung nach Kategorie
    const cats = $('finCats'); cats.innerHTML = '';
    ['in', 'out'].forEach(t => {
      const by = {};
      list.filter(e => e.type === t).forEach(e => { by[e.cat || 'Sonstiges'] = (by[e.cat || 'Sonstiges'] || 0) + (+e.amount || 0); });
      const tot = Object.values(by).reduce((a, b) => a + b, 0);
      if (!tot) return;
      const g = el('div', 'fin-catbox ' + t);
      g.appendChild(el('div', 'fin-cath', t === 'in' ? 'Einnahmen nach Kategorie' : 'Ausgaben nach Kategorie'));
      Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([c, v]) => {
        const r = el('div', 'fin-catrow');
        const bar = el('div', 'fin-bar'); const fill = el('span'); fill.style.width = Math.max(3, v / tot * 100) + '%'; bar.appendChild(fill);
        r.append(el('span', 'fin-catn', c), bar, el('span', 'fin-catv', chf(v)));
        g.appendChild(r);
      });
      cats.appendChild(g);
    });
    // Liste nach Monat
    const lb = $('finList'); lb.innerHTML = '';
    if (!list.length) lb.appendChild(el('div', 'empty small', `Noch keine Einträge für ${finYear}.` + (can ? ' Mit „+ Einnahme“ oder „− Ausgabe“ legst du einen an.' : '')));
    let lastM = '';
    list.forEach(e => {
      const d = e.date ? parseKey(e.date) : null;
      const m = d ? CAL_MONTHS[d.getMonth()] + ' ' + d.getFullYear() : 'Ohne Datum';
      if (m !== lastM) { lb.appendChild(el('div', 'gig-month', m)); lastM = m; }
      const row = el('button', 'fin-row ' + (e.type === 'in' ? 'in' : 'out')); row.type = 'button';
      const left = el('div', 'fin-rl');
      left.append(el('div', 'fin-rt', e.title || (e.type === 'in' ? 'Einnahme' : 'Ausgabe')));
      const sub = [d ? `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.` + (e.time ? ' ' + e.time + ' Uhr' : '') : '', e.cat || ''];
      const gig = e.gigId && calEvents.find(x => x.id === e.gigId);
      if (gig) sub.push('Gig: ' + (gig.title || 'Gig'));
      left.append(el('div', 'fin-rs', sub.filter(Boolean).join(' · ')));
      if (e.note) left.append(el('div', 'fin-rn', e.note));
      row.append(left, el('div', 'fin-ra', (e.type === 'in' ? '+ ' : '− ') + chf(+e.amount || 0)));
      row.addEventListener('click', () => openFinModal(e));
      lb.appendChild(row);
    });
  }
  function finSetType(t) {
    finTypeSel = t;
    document.querySelectorAll('#finType button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    const sel = $('finCat'); const cur = sel.value; sel.innerHTML = '';
    FIN_CATS[t].forEach(c => sel.appendChild(new Option(c, c)));
    if (FIN_CATS[t].includes(cur)) sel.value = cur;
  }
  function openFinModal(e, type) {
    if (FIN_LOCKED) return previewBlocked(null, FIN_LOCK);
    finEdit = e ? { ...e } : null;
    const can = finCanEdit() && !viewAs;
    $('finTitleH').textContent = e ? (can ? 'Eintrag bearbeiten' : 'Eintrag') : (type === 'out' ? 'Neue Ausgabe' : 'Neue Einnahme');
    finSetType(e ? e.type : (type || 'in'));
    $('finAmount').value = e ? e.amount : '';
    $('finDate').value = e ? (e.date || '') : dKey(new Date());
    $('finTime').value = e ? (e.time || '') : '';
    $('finTitle').value = e ? (e.title || '') : '';
    $('finCat').value = e && e.cat ? e.cat : FIN_CATS[finTypeSel][0];
    const gs = $('finGig'); gs.innerHTML = ''; gs.appendChild(new Option('– kein Gig –', ''));
    calEvents.filter(x => x.category === 'auftritt' && x.kind !== 'checklist').sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(x => gs.appendChild(new Option(evOptionLabel(x), x.id)));
    gs.value = e && e.gigId ? e.gigId : '';
    $('finNote').value = e ? (e.note || '') : '';
    ['finAmount', 'finDate', 'finTime', 'finTitle', 'finCat', 'finGig', 'finNote'].forEach(id => { $(id).disabled = !can; });
    document.querySelectorAll('#finType button').forEach(b => { b.disabled = !can; });
    $('finSave').classList.toggle('hidden', !can);
    $('finDel').classList.toggle('hidden', !e || !can); $('finDel').textContent = 'Löschen';
    $('finCancel').textContent = can ? 'Abbrechen' : 'Schliessen';
    setMsg($('finMsg'), can || viewAs ? '' : 'Du hast für die Finanzen nur Leserechte.');
    $('finModal').classList.remove('hidden');
    if (can && !e) setTimeout(() => $('finAmount').focus(), 30);
  }
  const closeFin = () => $('finModal').classList.add('hidden');
  $('finClose').addEventListener('click', closeFin);
  $('finCancel').addEventListener('click', closeFin);
  $('finModal').addEventListener('click', e => { if (e.target === $('finModal')) closeFin(); });
  document.querySelectorAll('#finType button').forEach(b => b.addEventListener('click', () => finSetType(b.dataset.t)));
  $('finYear').addEventListener('change', () => { finYear = parseInt($('finYear').value, 10); renderFinance(); });
  const finAdd = (e, t) => { if (!finCanEdit()) return previewBlocked(e, FIN_DENIED); if (viewAs) return previewBlocked(e); openFinModal(null, t); };
  $('finAddIn').addEventListener('click', e => finAdd(e, 'in'));
  $('finAddOut').addEventListener('click', e => finAdd(e, 'out'));
  $('finSave').addEventListener('click', async e => {
    if (!finCanEdit()) return previewBlocked(e, FIN_DENIED);
    if (viewAs) return previewBlocked(e);
    const amount = Math.round(parseFloat(String($('finAmount').value).replace(',', '.')) * 100) / 100;
    if (!(amount > 0)) { setMsg($('finMsg'), 'Bitte einen Betrag grösser als 0 eingeben.', 'error'); $('finAmount').focus(); return; }
    if (!$('finDate').value) { setMsg($('finMsg'), 'Bitte ein Datum wählen.', 'error'); return; }
    const now = new Date().toISOString();
    const data = { type: finTypeSel, amount, date: $('finDate').value, time: $('finTime').value || '', title: $('finTitle').value.trim(), cat: $('finCat').value, gigId: $('finGig').value || '', note: $('finNote').value.trim(), updatedBy: uid, updatedAt: now };
    const col = db.collection(`finance/${currentBand}/entries`);
    try {
      if (finEdit) { const ref = col.doc(finEdit.id); const sn = await ref.get(); await ref.set({ ...(sn.exists ? sn.data() : {}), ...data }); }
      else { const id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); await col.doc(id).set({ ...data, createdBy: uid, createdAt: now }); }
      finYear = parseInt(data.date.slice(0, 4), 10) || finYear;
      closeFin(); flash(finEdit ? 'Eintrag gespeichert ✓' : (data.type === 'in' ? 'Einnahme erfasst ✓' : 'Ausgabe erfasst ✓'));
      await finReload();
    } catch (err) { setMsg($('finMsg'), friendlyError(err), 'error'); }
  });
  $('finDel').addEventListener('click', async e => {
    if (!finEdit) return;
    if (!finCanEdit()) return previewBlocked(e, FIN_DENIED);
    if (!finEdit._armed) { finEdit._armed = true; $('finDel').textContent = 'Wirklich löschen?'; return; }
    try { await db.collection(`finance/${currentBand}/entries`).doc(finEdit.id).delete(); closeFin(); flash('Eintrag gelöscht'); await finReload(); }
    catch (err) { setMsg($('finMsg'), friendlyError(err), 'error'); }
  });
  // CSV-Export (Excel-tauglich); Dateiname enthält die Versionsnummer
  function finList() { return finEntries.filter(e => (e.date || '').startsWith(String(finYear))).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || '')); }
  function finExport(kind) {
    if (FIN_LOCKED) return previewBlocked(null, FIN_LOCK);
    const band = (bands[currentBand] && bands[currentBand].name) || 'Band';
    if (kind === 'pdf') {
      const L = finList(); let sIn = 0, sOut = 0;
      const rows = L.map(e => { const gig = e.gigId && calEvents.find(x => x.id === e.gigId), a = +e.amount || 0; if (e.type === 'in') sIn += a; else sOut += a;
        return [e.date ? fmtDateOv(parseKey(e.date), ovCfg().date) : '', e.title || '', e.cat || '', gig ? gig.title || '' : '', (e.type === 'in' ? '+' : '−') + a.toFixed(2)]; });
      return xSave(xFile('Finanzen', band, String(finYear), 'pdf'), tablePdf({ title: 'Finanzen ' + finYear + ' · ' + band,
        sub: `Einnahmen ${sIn.toFixed(2)} · Ausgaben ${sOut.toFixed(2)} · Saldo ${(sIn - sOut).toFixed(2)} CHF`,
        cols: [{ h: 'Datum', w: 1.4 }, { h: 'Bezeichnung', w: 3.6, b: 1 }, { h: 'Kategorie', w: 1.8, g: 1 }, { h: 'Gig', w: 2.2, g: 1 }, { h: 'CHF', w: 1.3, r: 1 }], rows }));
    }
    const list = finEntries.filter(e => (e.date || '').startsWith(String(finYear))).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Datum', 'Zeit', 'Typ', 'Bezeichnung', 'Kategorie', 'Gig', 'Betrag CHF', 'Notiz'].map(q).join(';')];
    list.forEach(e => {
      const gig = e.gigId && calEvents.find(x => x.id === e.gigId);
      const amt = ((e.type === 'in' ? 1 : -1) * (+e.amount || 0)).toFixed(2);
      rows.push([q(e.date), q(e.time || ''), q(e.type === 'in' ? 'Einnahme' : 'Ausgabe'), q(e.title), q(e.cat), q(gig ? gig.title : ''), amt, q(e.note)].join(';'));
    });
    const text = '﻿' + rows.join('\r\n');
    xSave(xFile('Finanzen', band, String(finYear), 'csv'), text, 'text/csv;charset=utf-8');
  }

  // ================= Band auflösen =================
  const dzPath = (who, bandId) => `bandadmin/${who}/dissolve/${bandId}`;
  let dzConsent = {};      // uid -> true
  let dzBand = null;
  const DZ_DENIED = 'Keine Berechtigung: Eine Band auflösen können nur der Admin und Mitglieder mit der Rolle „Organisation“.';
  // Wer muss zustimmen? Admin + alle aktiven Mitglieder mit „Organisation“
  function dzDeciders() {
    const b = bands[currentBand];
    const act = members.filter(m => isActiveIn(m, currentBand, b.cfg));
    const ids = [b.createdBy, ...(b.verwalter || []).filter(u => u !== b.createdBy)];
    return ids.map(u => {
      const m = act.find(x => x.uid === u);
      return { uid: u, name: m ? (m.name || 'Unbekannt') : (u === uid ? profile.name : 'Unbekannt'), admin: u === b.createdBy, here: !!m || u === uid };
    }).filter(d => d.here || d.admin);
  }
  // Einfache Mitglieder: aktiv, nicht Admin, nicht „Organisation“ – dazu offene Einladungen
  function dzSimple() {
    const b = bands[currentBand];
    const keep = new Set([b.createdBy, ...(b.verwalter || [])]);
    const act = members.filter(m => isActiveIn(m, currentBand, b.cfg) && !keep.has(m.uid)).map(m => m.name || 'Unbekannt');
    const claimed = new Set(members.map(m => m.memberships && m.memberships[currentBand] && m.memberships[currentBand].entry).filter(Boolean));
    const open = Object.entries(b.cfg.extra || {}).filter(([id]) => !claimed.has(id)).map(([, e]) => (e.name || 'Unbekannt') + ' (Einladung offen)');
    return [...act, ...open];
  }
  async function loadDissolve() {
    dzBand = currentBand; dzConsent = {};
    const ds = dzDeciders();
    const got = await Promise.all(ds.map(d => db.doc(dzPath(d.uid, currentBand)).get().catch(() => null)));
    ds.forEach((d, i) => { const g = got[i]; if (g && g.exists && g.data() && g.data().ok) dzConsent[d.uid] = true; });
  }
  function dzState() {
    const simple = dzSimple(), ds = dzDeciders();
    const missing = ds.filter(d => !dzConsent[d.uid]);
    return { simple, ds, missing, ok: !simple.length && !missing.length };
  }
  function renderDissolve() {
    const panel = $('dissolvePanel');
    const show = canRoles(currentBand) && dzBand === currentBand;
    panel.classList.toggle('hidden', !show);
    if (!show) return;
    const { simple, ds, missing, ok } = dzState();
    const me = actorUid();
    const preview = !!viewAs;

    const s1 = $('dzStep1'); s1.innerHTML = ''; s1.className = 'dz-step ' + (simple.length ? 'no' : 'ok');
    const h1 = el('div', 'dz-head'); h1.append(el('span', 'dz-icon', simple.length ? '✕' : '✓'), el('span', null, '1. Alle einfachen Mitglieder entfernt'));
    s1.append(h1, el('div', 'dz-sub', simple.length
      ? `Noch ${simple.length} ${simple.length === 1 ? 'Mitglied' : 'Mitglieder'} in der Band: ${simple.join(', ')}. Mitglieder entfernen kann der Admin (Mitglied aufklappen → „Aus der Band entfernen“, danach speichern).`
      : 'In der Band sind nur noch der Admin und Mitglieder mit der Rolle „Organisation“.'));

    const s2 = $('dzStep2'); s2.innerHTML = ''; s2.className = 'dz-step ' + (missing.length ? 'no' : 'ok');
    const h2 = el('div', 'dz-head'); h2.append(el('span', 'dz-icon', missing.length ? '✕' : '✓'), el('span', null, '2. Zustimmung von Admin und Organisation'));
    s2.append(h2, el('div', 'dz-sub', 'Jede Person setzt ihren eigenen Haken. Erst wenn alle zugestimmt haben, kann die Band aufgelöst werden.'));
    const list = el('div', 'dz-list');
    ds.forEach(d => {
      const row = el('div', 'dz-row');
      row.append(el('span', null, d.name + (d.admin ? ' · Admin' : ' · Organisation') + (d.uid === me ? ' (du)' : '')));
      if (d.uid === me) {
        const lab = el('label', 'dz-check');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!dzConsent[d.uid]; cb.id = 'dzOk';
        if (preview) lab.classList.add('pv-locked');
        cb.addEventListener('click', async e => {
          if (preview) { e.preventDefault(); return previewBlocked(e); }
          const v = cb.checked;
          cb.disabled = true;
          try {
            const ref = db.doc(dzPath(uid, currentBand));
            if (v) await ref.set({ ok: true, at: new Date().toISOString() }); else await ref.delete();
            if (v) dzConsent[uid] = true; else delete dzConsent[uid];
            flash(v ? 'Zustimmung gesetzt' : 'Zustimmung zurückgezogen');
          } catch (err) { cb.checked = !v; flash('Konnte nicht gespeichert werden', true); }
          cb.disabled = false;
          $('dzConfirm').classList.add('hidden');
          renderDissolve();
        });
        lab.append(cb, 'OK, einverstanden');
        row.append(lab);
      } else {
        row.append(el('span', 'dz-state ' + (dzConsent[d.uid] ? 'ok' : 'wait'), dzConsent[d.uid] ? '✓ einverstanden' : 'ausstehend'));
      }
      list.appendChild(row);
    });
    s2.append(list);
    $('dzBtn').classList.toggle('pv-locked', preview);
    if (!ok) $('dzConfirm').classList.add('hidden');
  }
  $('dzBtn').addEventListener('click', e => {
    if (!canRoles(currentBand)) return previewBlocked(e, DZ_DENIED);
    if (viewAs) return previewBlocked(e);
    const { simple, missing, ok } = dzState();
    if (!ok) {
      const parts = [];
      if (simple.length) parts.push('zuerst alle einfachen Mitglieder entfernen');
      if (missing.length) parts.push('Zustimmung fehlt noch von: ' + missing.map(d => d.name).join(', '));
      setMsg($('dzMsg'), 'Die Band kann noch nicht aufgelöst werden – ' + parts.join('; ') + '.', 'error');
      return;
    }
    setMsg($('dzMsg'), '');
    $('dzConfirm').classList.remove('hidden');
  });
  $('dzNo').addEventListener('click', () => { $('dzConfirm').classList.add('hidden'); });
  $('dzYes').addEventListener('click', async () => {
    if (viewAs || !canRoles(currentBand) || !dzState().ok) return;
    const id = currentBand, b = bands[id];
    const yes = $('dzYes'), no = $('dzNo');
    yes.disabled = no.disabled = true;
    setMsg($('dzMsg'), 'Band wird aufgelöst …');
    try {
      // Termine, Gigs und Dokumente löschen
      try {
        const evs = await db.collection(`calendar/${id}/events`).get();
        await Promise.all(evs.docs.map(async d => {
          const ev = d.data() || {};
          (ev.docs || []).forEach(dc => deleteAsset(dc.id));
          try { await db.collection(`calendar/${id}/events`).doc(d.id).delete(); } catch (e) {}
        }));
      } catch (e) {}
      // Einladungscodes ungültig machen
      await Promise.all(Object.values(b.cfg.extra || {}).filter(x => x.code).map(x => db.doc('invites/' + x.code).delete().catch(() => {})));
      await db.doc('bands/' + id).delete();
      await Promise.all(dzDeciders().filter(d => d.uid === uid).map(() => db.doc(dzPath(uid, id)).delete().catch(() => {})));
      try { await db.doc(cfgPath(uid, id)).delete(); } catch (e) {}
      // aus dem eigenen Profil entfernen
      profile.bandIds = (profile.bandIds || []).filter(x => x !== id);
      if (profile.memberships) delete profile.memberships[id];
      if (profile.lastBand === id) profile.lastBand = profile.bandIds[0] || null;
      try { await db.doc('members/' + uid).set(clone(profile)); } catch (e) {}
      if (calUnsub) { try { calUnsub(); } catch (e) {} calUnsub = null; }
      calEventsBand = null;
      delete bands[id];
      viewAs = null; renderViewAs(); discardDraft();
      $('dzConfirm').classList.add('hidden'); setMsg($('dzMsg'), '');
      const rest = bandIdsOf(profile);
      if (rest.length) {
        currentPage = 'overview';
        enterApp(rest[0]);
        flash(`„${b.name}“ wurde aufgelöst`);
      } else {
        ls.sdel('bandLoggedIn');
        currentPage = 'overview';
        $('app').classList.add('hidden');
        $('auth').classList.remove('hidden');
        $('registerSlot').appendChild(form);
        prepareForm();
        showTab('register');
        flash(`„${b.name}“ wurde aufgelöst`);
      }
    } catch (err) {
      setMsg($('dzMsg'), 'Die Band konnte nicht aufgelöst werden: ' + friendlyError(err), 'error');
    }
    yes.disabled = no.disabled = false;
  });

  function renderMembers(loading) {
    const t = $('tMembers'); t.innerHTML = '';
    const admin = isAdmin(currentBand);
    const rolesMgr = canRoles(currentBand);
    const founderView = isFounder(currentBand);
    $('mlistTools').classList.toggle('hidden', loading);
    if (loading) { t.appendChild(el('div', 'mroles', 'Mitglieder werden geladen …')); return; }

    // Standard-Berechtigungen (nur Admins)
    if (admin) {
      const sum = REGISTERS.map(r => `${r.title}: ${LEVELS[draft.access.defaults[r.id] || regDefault(r.id)]}`).join(' · ');
      const { card, body } = makeCard('__default', { name: 'Standard-Berechtigungen', summary: sum, isDefault: true });
      body.append(el('p', 'mnote', 'Gilt für alle Mitglieder ohne eigene Einstellung – auch für neue Mitglieder.'));
      body.append(section('Register', permGrid(
        reg => draft.access.defaults[reg] || regDefault(reg), reg => regDefault(reg),
        (reg, v) => { draft.access.defaults[reg] = v; renderMembers(false); }, false)));
      t.appendChild(card);
    }

    const rankOf = m => draftIsAdmin(m.uid) ? 0 : (memberRoles(m, currentBand, draft).includes('Organisation') ? 1 : (memberRoles(m, currentBand, draft).length ? 2 : 3));
    const RANKS = ['Admins', 'Organisation', 'Mitglieder', 'Ohne Rolle'];
    const rankSorted = sortedMembers().map((m, i) => ({ m, i })).sort((a, b) => rankOf(a.m) - rankOf(b.m) || a.i - b.i).map(x => x.m);
    let lastRank = -1;
    rankSorted.forEach(m => {
      const rk = rankOf(m);
      if (rk !== lastRank) { lastRank = rk; t.appendChild(el('div', 'rank-head', RANKS[rk] + ' (' + rankSorted.filter(x => rankOf(x) === rk).length + ')')); }
      const roles = memberRoles(m, currentBand, draft);
      const badges = [];
      if (isFounder(currentBand, m.uid)) badges.push(el('span', 'admin-badge', 'Admin'));

      const extra = admin && !draftIsAdmin(m.uid) ? permSummary(m) : '';
      const summary = [roles.join(', ') || 'Keine Rolle', extra].filter(Boolean).join(' · ');
      const { card, body } = makeCard('m:' + m.uid, { name: m.name || 'Unbekannt', badges, summary, locked: photoLocked(m), photo: typeof m.photo === 'string' && m.photo.startsWith('data:image/') ? m.photo : null });
      const contact = contactBox(m);

      if (rolesMgr) {
        // Wer „Organisation“ hat, kann sich diese Rolle nicht selbst entfernen
        const selfLock = m.uid === actorUid() && !isFounder(currentBand, actorUid()) && roles.includes('Organisation') ? ['Organisation'] : null;
        const sec = section('Rollen', roleChipEditor(roles, list => {
          if (selfLock && !list.includes('Organisation')) list = [...list, 'Organisation'];
          draft.assignments[m.uid] = list; updateDirty(); refreshSummary(card, m);
        }, selfLock, !!viewAs));
        if (selfLock) sec.appendChild(el('div', 'note-info', 'ℹ Deine Rolle „Organisation“ kannst du nicht selbst entfernen. Das muss ein anderes berechtigtes Mitglied (Admin oder jemand mit der Rolle „Organisation“) tun.'));
        body.append(sec);
      }
      if (admin) {
        if (draftIsAdmin(m.uid)) {
          body.append(section('Register', el('div', 'mnote', 'Der Admin hat in allen Registern vollen Zugriff.')));
        } else {
          body.append(section('Register', permGrid(
            reg => draft.access.members[m.uid] && draft.access.members[m.uid][reg],
            reg => draft.access.defaults[reg] || regDefault(reg),
            (reg, v) => {
              const mm = draft.access.members[m.uid] = draft.access.members[m.uid] || {};
              if (v) mm[reg] = v; else delete mm[reg];
              if (!Object.keys(mm).length) delete draft.access.members[m.uid];
              refreshSummary(card, m);
            }, true)));
        }
        // Mitglied entfernen: nur der Admin, alle ausser sich selbst
        const canRemove = founderView && m.uid !== uid;
        if (canRemove) {
          const wrapRm = el('div', 'remove-line');
          const rm = el('button', 'link-danger', 'Aus der Band entfernen'); rm.type = 'button';
          rm.addEventListener('click', () => {
            wrapRm.innerHTML = '';
            const yes = el('button', 'btn small danger', 'Ja, entfernen'); yes.type = 'button';
            const no = el('button', 'btn small ghost', 'Abbrechen'); no.type = 'button';
            wrapRm.append(el('span', 'mnote', `${m.name || 'Diese Person'} wirklich entfernen?`), yes, no);
            no.addEventListener('click', () => renderMembers(false));
            yes.addEventListener('click', () => {
              draft.removed[m.uid] = new Date().toISOString();
              draft.admins = draft.admins.filter(a => a !== m.uid);
              delete draft.access.members[m.uid];
              delete draft.assignments[m.uid];
              expanded.delete('m:' + m.uid);
              renderMembers(false); updateDirty();
              flash(`${m.name || 'Mitglied'} wird beim Speichern entfernt`);
            });
          });
          wrapRm.appendChild(rm);
          body.append(wrapRm);
        }
      } else {
        if (!rolesMgr) {
          const box = el('div');
          if (!roles.length) box.appendChild(el('span', 'mroles', 'Keine Rolle'));
          roles.forEach(r => box.appendChild(el('span', 'role-pill', r)));
          body.append(section('Rollen', box));
        }
      }
      body.insertBefore(section('Kontakt', contact), body.firstChild);
      t.appendChild(card);
    });

    // Hinzugefügte, noch nicht registrierte Personen
    openEntries().forEach(e => {
      const roles = (e.roles || []).filter(r => draft.roles.includes(r));
      const { card, body } = makeCard('e:' + e.id, {
        name: e.name, pending: true,
        badges: [el('span', 'pending-badge', 'Noch nicht registriert')],
        summary: roles.join(', ') || 'Keine Rolle',
      });
      if (admin) {
        const saved = bands[currentBand].cfg.extra[e.id];
        const line = el('div', 'mnote');
        if (saved && saved.code === e.code) {
          line.append('Persönlicher Code: ', el('strong', 'code-inline', e.code), ' ');
          const cb = el('button', 'copy-btn', 'Kopieren'); cb.type = 'button';
          cb.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(e.code); cb.textContent = 'Kopiert ✓'; } catch (err) { cb.textContent = 'Bitte markieren'; }
            setTimeout(() => { cb.textContent = 'Kopieren'; }, 1600);
          });
          line.appendChild(cb);
        } else {
          line.textContent = 'Der persönliche Code wird nach dem Speichern erstellt.';
        }
        body.append(section('Einladung', line));
        body.append(section('Rollen', roleChipEditor(roles, list => {
          draft.extra[e.id].roles = list; updateDirty();
          card.querySelector('.msum').textContent = list.join(', ') || 'Keine Rolle';
        })));
        body.append(section('Register', el('div', 'mnote', 'Bis zur Registrierung gelten die Standard-Berechtigungen.')));
        const rm = el('button', 'link-danger', 'Person entfernen'); rm.type = 'button';
        rm.addEventListener('click', () => { delete draft.extra[e.id]; expanded.delete('e:' + e.id); renderMembers(false); updateDirty(); });
        body.append(rm);
      } else {
        const box = el('div');
        if (!roles.length) box.appendChild(el('span', 'mroles', 'Keine Rolle'));
        roles.forEach(r => box.appendChild(el('span', 'role-pill' + (viewAs && viewAs.key === 'e:' + e.id && r === 'Organisation' ? ' locked-pill' : ''), r)));
        const sec = section('Rollen', box);
        if (viewAs && viewAs.key === 'e:' + e.id && roles.includes('Organisation')) {
          sec.appendChild(el('div', 'note-info', 'ℹ Deine Rolle „Organisation“ kannst du nicht selbst entfernen. Das muss ein anderes berechtigtes Mitglied (Admin oder jemand mit der Rolle „Organisation“) tun.'));
        }
        body.append(sec);
      }
      t.appendChild(card);
    });

    if (!members.length && !openEntries().length) t.appendChild(el('div', 'mroles', 'Noch keine Mitglieder gefunden.'));
  }

  // Kontaktangaben, die das Mitglied für diese Band freigegeben hat
  function contactBox(m) {
    const sh = (m.memberships && m.memberships[currentBand] && m.memberships[currentBand].share) || {};
    const box = el('div', 'contact-list');
    let any = false;
    if (sh.email && m.email) {
      any = true;
      const a = el('a', null, m.email); a.href = 'mailto:' + m.email;
      const row = el('div', 'contact-row'); row.append(el('span', 'ck', 'E-Mail'), a); box.appendChild(row);
    }
    if (sh.phone && m.phone) {
      any = true;
      const a = el('a', null, m.phone); a.href = 'tel:' + m.phone.replace(/[^+0-9]/g, '');
      const row = el('div', 'contact-row'); row.append(el('span', 'ck', 'Telefon'), a); box.appendChild(row);
    }
    if (!any) box.appendChild(el('span', 'mnote', m.uid === actorUid() ? 'Du teilst keine Kontaktangaben mit dieser Band. Ändern kannst du das unter „Profil & Bands“.' : 'Keine Kontaktangaben freigegeben.'));
    return box;
  }
  function refreshSummary(card, m) {
    const roles = memberRoles(m, currentBand, draft);
    const extra = !draftIsAdmin(m.uid) ? permSummary(m) : '';
    card.querySelector('.msum').textContent = [roles.join(', ') || 'Keine Rolle', extra].filter(Boolean).join(' · ');
  }

  $('mExpandAll').addEventListener('click', () => {
    document.querySelectorAll('#tMembers .mcard').forEach(c => c.classList.add('open'));
    expanded.add('__default');
    sortedMembers().forEach(m => expanded.add('m:' + m.uid));
    openEntries().forEach(e => expanded.add('e:' + e.id));
  });
  $('mCollapseAll').addEventListener('click', () => {
    expanded.clear();
    document.querySelectorAll('#tMembers .mcard').forEach(c => c.classList.remove('open'));
  });

  // ----- Mitglied hinzufügen (Admin) -----
  function renderAddForm() {
    addRolesSet = new Set([...addRolesSet].filter(r => draft.roles.includes(r)));
    const box = $('addRoles'); box.innerHTML = '';
    draft.roles.forEach(r => {
      const b = el('button', 'chip' + (addRolesSet.has(r) ? ' on' : ''), r);
      b.type = 'button';
      b.addEventListener('click', () => { addRolesSet.has(r) ? addRolesSet.delete(r) : addRolesSet.add(r); b.classList.toggle('on'); });
      box.appendChild(b);
    });
  }
  $('addBtn').addEventListener('click', () => {
    const name = $('addName').value.trim();
    const msg = $('addMsg');
    if (name.length < 2) return setMsg(msg, 'Bitte gib einen Namen ein.', 'error');
    if (!addRolesSet.size) return setMsg(msg, 'Bitte wähle mindestens eine Rolle.', 'error');
    const id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    draft.extra[id] = { name, roles: draft.roles.filter(r => addRolesSet.has(r)), code: genInviteCode(), addedBy: uid, addedAt: new Date().toISOString() };
    $('addName').value = ''; addRolesSet = new Set(); renderAddForm();
    renderMembers(false); updateDirty();
    setMsg(msg, `${name} wurde hinzugefügt. Nach dem Speichern erhält die Person einen persönlichen Code zum Registrieren.`, 'ok');
  });
  $('addName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('addBtn').click(); } });
  function genInviteCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = ''; const r = new Uint32Array(8); crypto.getRandomValues(r);
    for (const n of r) s += abc[n % abc.length];
    return s;
  }

  // ----- Rollenliste -----
  const ROLE_RIGHTS = {
    'Organisation': 'Rollen der Mitglieder zuweisen (ausser „Organisation“ bei sich selbst), Rollenliste, Termin-Kategorien und Bandlogo bearbeiten, Gigs bearbeiten und löschen, Dokumente hinzufügen und entfernen, alle Checklisten-Einträge ändern und Mitglieder zuweisen, der Auflösung der Band zustimmen.',
    'Setlist': 'Schaltet „Bearbeiten“ in den Registerkarten „Setlist“ und „Songs“ frei – auch wenn dort sonst „Nur lesen“ oder „Ausgeblendet“ eingestellt ist.',
    'Finanzen': 'Schaltet „Bearbeiten“ in der Registerkarte „Finanzen“ frei (Einnahmen und Ausgaben erfassen) – auch wenn dort sonst „Nur lesen“ oder „Ausgeblendet“ eingestellt ist.',
    'Timetable': 'Schaltet „Bearbeiten“ in der Registerkarte „Timetable“ frei – auch wenn dort sonst „Nur lesen“ oder „Ausgeblendet“ eingestellt ist.',
    'Checkliste': 'Schaltet „Bearbeiten“ in der Registerkarte „Checkliste“ frei – auch wenn dort sonst „Nur lesen“ oder „Ausgeblendet“ eingestellt ist. Eigene Reiter und Unterreiter erstellen, bearbeiten und löschen, Checklisten erstellen.',
  };
  function renderRoleRights() {
    const box = $('aRoleRights'); if (!box) return;
    box.innerHTML = '';
    // Rollen mit denselben Rechten werden in einer Zeile gebündelt
    const row = (names, text, cls) => {
      const r = el('div', 'rr-row' + (cls ? ' ' + cls : ''));
      const tags = el('div', 'rr-names');
      names.forEach(n => tags.appendChild(el('span', 'role-tag rr-name' + (FIXED_ROLES.includes(n) ? ' fixed' : ''), n)));
      r.append(tags, el('span', 'rr-text', text)); box.appendChild(r);
    };
    row(['Admin'], 'Wer die Band gegründet hat – alle Rechte, auch Mitglieder hinzufügen/entfernen, Rechte pro Mitglied, Admin-Rolle vergeben und Band auflösen. (Keine wählbare Rolle.)', 'admin');
    const NONE = 'Keine zusätzlichen Rechte – dient zur Information (z. B. Gründer, Instrument oder Aufgabe).';
    const groups = new Map();
    draft.roles.forEach(r => { const t = ROLE_RIGHTS[r] || NONE; if (!groups.has(t)) groups.set(t, []); groups.get(t).push(r); });
    // Rollen mit besonderen Rechten zuerst, die reinen Info-Rollen am Schluss
    [...groups.entries()].sort((a, b) => (a[0] === NONE) - (b[0] === NONE)).forEach(([t, names]) => row(names, t, ''));
  }
  function renderRoleEditor() {
    renderRoleRights();
    const box = $('aRoles'); box.innerHTML = '';
    if (!draft.roles.length) box.append(el('span', 'found muted', 'Noch keine Rollen – füge unten welche hinzu.'));
    draft.roles.forEach(r => {
      const t = el('span', 'role-tag', r);
      if (FIXED_ROLES.includes(r)) { t.classList.add('fixed'); t.title = 'Feste Rolle – kann nicht entfernt werden'; box.appendChild(t); return; }
      if (viewAs) { const lk = el('button', 'pv-lock-btn', '🔒'); lk.type = 'button'; lk.addEventListener('click', previewBlocked); t.appendChild(lk); box.appendChild(t); return; }
      const x = el('button', null, '×'); x.type = 'button'; x.title = 'Rolle entfernen';
      x.addEventListener('click', () => {
        draft.roles = draft.roles.filter(y => y !== r);
        renderRoleEditor(); renderMembers(false); renderAddForm(); updateDirty();
      });
      t.appendChild(x); box.appendChild(t);
    });
  }
  function addRole() {
    if (viewAs) return previewBlocked();
    const inp = $('aNewRole'); const v = inp.value.trim();
    if (!v) return;
    if (draft.roles.some(r => r.toLowerCase() === v.toLowerCase())) { setMsg($('aMsg'), `„${v}“ gibt es schon.`, 'error'); return; }
    draft.roles.push(v); inp.value = ''; setMsg($('aMsg'), '');
    renderRoleEditor(); renderMembers(false); renderAddForm(); updateDirty(); inp.focus();
  }
  $('aAddRole').addEventListener('click', addRole);
  $('aNewRole').addEventListener('mousedown', () => { if (viewAs) previewBlocked(); });

  // Rote Meldung, wenn in der Vorschau etwas geändert werden soll
  let pvTimer = null;
  const PREVIEW_TEXT = 'Gesperrt: In der Vorschau kannst du nichts ändern. Beende die Ansicht, um Änderungen vorzunehmen.';
  function previewBlocked(e, text) {
    if (e && e.preventDefault) e.preventDefault();
    $('previewWarnText').textContent = typeof text === 'string' ? text : PREVIEW_TEXT;
    const bar = $('previewWarn');
    bar.classList.remove('hidden');
    bar.classList.remove('shake'); void bar.offsetWidth; bar.classList.add('shake');
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => bar.classList.add('hidden'), 3500);
  }
  $('aNewRole').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } });
  // Band-Genre: gesetzt von Admin, sonst automatisch das häufigste Genre der Songs
  const bandGenreAuto = () => {
    const c = {}; [...slSongs.map(x => x.genre), ...slLists.flatMap(l => (l.items || []).filter(i => i.type === 'song').map(i => i.genre))].map(x => (x || '').trim()).filter(Boolean).forEach(g => c[g] = (c[g] || 0) + 1);
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  };
  function genreHint() {
    const a = slBand === currentBand ? bandGenreAuto() : '';
    $('aGenreHint').textContent = draftGenre ? '' : (a ? 'Automatisch aus den Songs: ' + a : 'Leer: wird automatisch aus den Songs bestimmt, sobald Songs mit Genre da sind.');
    $('aGenreList').innerHTML = ''; slGenresOfBand().forEach(g => $('aGenreList').appendChild(new Option(g)));
  }
  $('aGenre').addEventListener('input', () => { draftGenre = $('aGenre').value.trim().slice(0, 40); genreHint(); updateDirty(); });
  $('aBandName').addEventListener('input', () => { draftName = $('aBandName').value.trim(); const b = $('aTagEditor'); if (b._refresh) b._refresh(); updateDirty(); });
  [['aShowLogo', 'logo'], ['aShowName', 'name'], ['aShowTag', 'tag']].forEach(([id, k]) => $(id).addEventListener('change', () => { draftShow = { ...draftShow, [k]: $(id).checked }; updateDirty(); }));

  // ----- Register-Berechtigungen -----
  function levelSelect(value, withDefault, defaultLevel, onChange) {
    const s = el('select');
    if (withDefault) { const o = el('option', null, `Standard (${LEVELS[defaultLevel]})`); o.value = ''; s.appendChild(o); }
    Object.entries(LEVELS).forEach(([k, t]) => { const o = el('option', null, t); o.value = k; s.appendChild(o); });
    s.value = value || '';
    const paint = () => { s.className = 'lv-' + (s.value || defaultLevel); };
    paint();
    s.addEventListener('change', () => { onChange(s.value); paint(); updateDirty(); });
    return s;
  }

  // ----- Speichern / Verwerfen -----
  async function saveTeam(msgEl) {
    const band = bands[currentBand];
    if (!canRoles(band.id) || !draft) return;
    const msg = msgEl || $('aMsg');
    if (!isAdmin(band.id)) return saveRolesOnly(band, msg);
    const newName = draftName;
    if (newName.length < 2) return setMsg(msg, 'Bitte gib einen Bandnamen ein.', 'error');
    if (!draft.roles.length) return setMsg(msg, 'Es braucht mindestens eine Rolle.', 'error');
    if (newName !== band.name && wordBlocked(newName)) return setMsg(msg, 'Der Bandname enthält ein gesperrtes Wort.', 'error');
    const tagChanged = draftTag !== (band.tag || '');
    const showChanged = JSON.stringify(draftShow) !== JSON.stringify(showOf(band)) || draftGenre !== (band.genre || '');
    if (tagChanged) {
      if (!TAG_RE.test(draftTag)) return setMsg(msg, 'Der Band-Tag braucht 1 bis 3 Zeichen (A–Z, 0–9).', 'error');
      const left = tagCooldownLeft(band);
      if (left > 0) return setMsg(msg, `Der Band-Tag kann erst in ${Math.ceil(left / 60000)} Min. wieder geändert werden.`, 'error');
      if (await tagTaken(draftTag, band.id)) return setMsg(msg, `Der Band-Tag ${fmtTag(draftTag)} ist schon vergeben.`, 'error');
    }
    const btns = [$('aSave'), $('ubSave')];
    btns.forEach(b => b.disabled = true);
    setMsg(msg, 'Wird gespeichert …');
    try {
      const assignments = materializedAssignments();
      const extra = {};
      Object.entries(draft.extra).forEach(([k, v]) => { extra[k] = { ...v, roles: (v.roles || []).filter(r => draft.roles.includes(r)) }; });
      // Einladungs-Verweise für neu hinzugefügte Personen anlegen
      for (const [id, e] of Object.entries(extra)) {
        const prev = band.cfg.extra[id];
        if (!prev || prev.code !== e.code) await db.doc('invites/' + e.code).set({ bandId: band.id, entryId: id, createdAt: new Date().toISOString() });
      }
      const now = new Date().toISOString();
      const cfg = { roles: draft.roles, access: draft.access, assignments, extra, removed: draft.removed, categories: cleanCategories(), logo: draft.logo || null, updatedAt: now, rolesAt: now };
      cfg.admins = [];
      await db.doc(cfgPath(uid, band.id)).set(clone(cfg));
      if (newName !== band.name || tagChanged || showChanged) {
        const { id, cfg: _c, ...rest } = band;
        await db.doc('bands/' + band.id).set({ ...rest, name: newName, tag: draftTag, tagAt: tagChanged ? now : (band.tagAt || null), tagAtMs: tagChanged ? Date.now() : (band.tagAtMs || 0), show: { ...draftShow }, genre: draftGenre });
        const opt = [...$('bandSwitch').options].find(o => o.value === band.id);
        if (opt) opt.textContent = newName + ' (Admin)';
      }
      const fresh = await loadBand(band.id);
      if (fresh) bands[band.id] = fresh; else { band.name = newName; band.cfg = normCfg(cfg); }
      discardDraft();
      renderAppHeader();
      if (currentPage === 'team') await openTeam();
      setMsg($('aMsg'), 'Gespeichert ✓', 'ok');
      setMsg($('addMsg'), '');
      flash('Änderungen gespeichert ✓');
    } catch (e) {
      setMsg(msg, friendlyError(e), 'error');
      flash(friendlyError(e), true);
    } finally {
      btns.forEach(b => b.disabled = false);
    }
  }
  // Rollen aller aktiven Mitglieder festschreiben (damit zählt z. B. „Organisation“ verlässlich)
  function materializedAssignments() {
    const out = {};
    Object.entries(draft.assignments).forEach(([k, v]) => { out[k] = v.filter(r => draft.roles.includes(r)); });
    members.filter(m => isActiveIn(m, currentBand, draft)).forEach(m => { if (!out[m.uid]) out[m.uid] = memberRoles(m, currentBand, draft); });
    return out;
  }
  // Mitglieder mit der Rolle „Organisation“ speichern nur Rollen – im eigenen Dokument
  async function saveRolesOnly(band, msg) {
    if (!draft.roles.length) return setMsg(msg, 'Es braucht mindestens eine Rolle.', 'error');
    const btns = [$('aSave'), $('ubSave')];
    btns.forEach(b => b.disabled = true);
    setMsg(msg, 'Wird gespeichert …');
    try {
      const now = new Date().toISOString();
      await db.doc(cfgPath(uid, band.id)).set(clone({ roles: draft.roles, assignments: materializedAssignments(), categories: cleanCategories(), logo: draft.logo || null, rolesAt: now }));
      const fresh = await loadBand(band.id);
      if (fresh) bands[band.id] = fresh;
      discardDraft();
      renderAppHeader();
      if (currentPage === 'team') await openTeam();
      setMsg($('aMsg'), 'Gespeichert ✓', 'ok');
      flash('Änderungen gespeichert ✓');
    } catch (e) {
      setMsg(msg, friendlyError(e), 'error');
      flash(friendlyError(e), true);
    } finally {
      btns.forEach(b => b.disabled = false);
    }
  }
  // ----- Termin-Kategorien (Admin und Organisation) -----
  const cleanCategories = () => draft.categories.map(c => ({ id: c.id, name: (c.name || '').trim() || 'Ohne Namen', color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#64748b' }));
  function renderCatEditor() {
    const box = $('aCats'); box.innerHTML = '';
    draft.categories.forEach((c, idx) => {
      const row = el('div', 'cat-row');
      if (viewAs) {
        const sw = el('button', 'cat-swatch'); sw.type = 'button'; sw.style.background = c.color; sw.addEventListener('click', previewBlocked);
        const nm = el('button', 'cat-name-ro', c.name + '  🔒'); nm.type = 'button'; nm.addEventListener('click', previewBlocked);
        row.append(sw, nm); box.appendChild(row); return;
      }
      const color = el('input'); color.type = 'color'; color.value = c.color; color.className = 'cat-color'; color.title = 'Farbe wählen';
      color.addEventListener('input', () => { c.color = color.value; updateDirty(); });
      const name = el('input'); name.type = 'text'; name.value = c.name; name.className = 'cat-name'; name.maxLength = 30;
      name.addEventListener('input', () => { c.name = name.value; updateDirty(); });
      if (c.id === 'auftritt') {
        const fx = el('span', 'cat-fixed', '🔒 fest'); fx.title = 'Diese Kategorie kann nicht entfernt werden';
        row.append(color, name, fx); box.appendChild(row); return;
      }
      const rm = el('button', 'link-danger', 'Entfernen'); rm.type = 'button';
      rm.addEventListener('click', () => {
        if (draft.categories.length <= 1) return setMsg($('aMsg'), 'Es braucht mindestens eine Kategorie.', 'error');
        draft.categories.splice(idx, 1); renderCatEditor(); updateDirty();
      });
      row.append(color, name, rm); box.appendChild(row);
    });
    $('aAddCat').classList.toggle('pv-locked', !!viewAs);
  }
  $('aAddCat').addEventListener('click', () => {
    if (viewAs) return previewBlocked();
    const palette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#ec4899', '#64748b'];
    draft.categories.push({ id: 'c' + Date.now().toString(36), name: 'Neue Kategorie', color: palette[draft.categories.length % palette.length] });
    renderCatEditor(); updateDirty();
    const inputs = $('aCats').querySelectorAll('.cat-name'); if (inputs.length) { inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
  });


  // ----- Bandlogo (Admin und Organisation bearbeiten, alle sehen es) -----
  const defaultLogo = () => document.getElementById('logoTpl').content.cloneNode(true);
  function logoNode(src) {
    const img = el('img'); img.src = src; img.alt = 'Bandlogo'; return img;
  }
  // Bandlogo anzeigen: verborgen = verschwommen mit Schloss (nur wer es bearbeiten darf, sieht es klar)
  function fillBandLogo(box, bandId, { canSee } = {}) {
    box.innerHTML = '';
    const b = bands[bandId], lg = b && b.cfg.logo;
    const hidden = !!lg && !showOf(b).logo && !(canSee !== undefined ? canSee : canRoles(bandId));
    box.classList.toggle('custom', !!lg);
    box.classList.toggle('img-locked', hidden);
    box.classList.toggle('img-zoom', !!lg && !hidden);
    box.appendChild(lg ? logoNode(lg) : defaultLogo());
    box.onclick = hidden
      ? e => { e.preventDefault(); e.stopPropagation(); flash('Dieses Bandlogo ist privat – die Band hat es in ihren Einstellungen verborgen.', true); }
      : lg ? e => { e.preventDefault(); e.stopPropagation(); openImage(lg, b.name); } : null;
  }
  function renderBrandLogo() { fillBandLogo($('brandLogo'), currentBand); }
  function renderLogoPanel() {
    const can = canRoles(currentBand);
    const lg = draft && draftBand === currentBand ? draft.logo : (bands[currentBand] && bands[currentBand].cfg.logo);
    const pv = $('logoPreview'); pv.innerHTML = '';
    if (lg) pv.appendChild(logoNode(lg)); else pv.appendChild(el('span', 'logo-empty', 'Kein Logo'));
    $('logoHint').textContent = can ? 'Das Logo erscheint oben links in der Seitenleiste für alle Mitglieder.' : 'Das Logo der Band. Ändern können es der Admin und Mitglieder mit der Rolle „Organisation“.';
    // Knöpfe sind für alle sichtbar; ohne Berechtigung gesperrt (🔒) mit roter Meldung beim Klicken
    $('logoRemove').classList.toggle('hidden', !lg);
    $('logoUpload').classList.toggle('pv-locked', !!viewAs || !can);
    $('logoRemove').classList.toggle('pv-locked', !!viewAs || !can);
  }
  const LOGO_DENIED = 'Keine Berechtigung: Das Bandlogo ändern dürfen nur der Admin und Mitglieder mit der Rolle „Organisation“.';
  function logoBlocked(e) {
    if (!canRoles(currentBand)) { previewBlocked(e, LOGO_DENIED); return true; }
    if (viewAs) { previewBlocked(e); return true; }
    return false;
  }
  function svgToDataUrl(text) { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text))); }
  function rasterToDataUrl(file, max = 256) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * s)), hgt = Math.max(1, Math.round(img.height * s));
        const c = document.createElement('canvas'); c.width = w; c.height = hgt;
        c.getContext('2d').drawImage(img, 0, 0, w, hgt);
        URL.revokeObjectURL(url);
        let out = c.toDataURL('image/png');
        if (out.length > 180000) out = c.toDataURL('image/webp', 0.9);
        if (out.length > 180000 || !out.startsWith('data:image/webp') && out.length > 180000) out = c.toDataURL('image/jpeg', 0.85);
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad')); };
      img.src = url;
    });
  }
  $('logoUpload').addEventListener('click', e => { logoBlocked(e); });
  $('logoFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file || viewAs || !canRoles(currentBand)) return;
    const msg = $('logoMsg');
    try {
      const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
      let data;
      if (isSvg) {
        if (file.size > 150000) return setMsg(msg, 'Die SVG-Datei ist zu gross (max. 150 KB).', 'error');
        const text = await file.text();
        if (!/<svg[\s>]/i.test(text)) return setMsg(msg, 'Das ist keine gültige SVG-Datei.', 'error');
        data = svgToDataUrl(text);
      } else if (file.type.startsWith('image/')) {
        data = await rasterToDataUrl(file);
      } else {
        return setMsg(msg, 'Bitte wähle ein Bild (PNG, JPG, WebP, GIF) oder eine SVG-Datei.', 'error');
      }
      draft.logo = data;
      renderLogoPanel(); updateDirty();
      setMsg(msg, 'Neues Logo – wird beim Speichern übernommen.', '');
    } catch (err) {
      setMsg(msg, 'Diese Datei konnte nicht gelesen werden.', 'error');
    }
  });
  $('logoRemove').addEventListener('click', e => {
    if (logoBlocked(e)) return;
    draft.logo = null; renderLogoPanel(); updateDirty();
    setMsg($('logoMsg'), 'Logo wird beim Speichern entfernt.', '');
  });

  $('aSave').addEventListener('click', () => saveTeam());
  $('ubSave').addEventListener('click', async () => {
    const p = isProfileDirty();
    if (isSettingsDirty()) await saveSettings();
    if (isDirty()) await saveTeam();
    if (p) form.requestSubmit();
  });
  $('ubDiscard').addEventListener('click', () => {
    if (isDirty()) {
      discardDraft();
      setMsg($('addMsg'), '');
      if (currentPage === 'team') openTeam();
    }
    if (isProfileDirty()) prepareForm();
    if (isSettingsDirty()) discardSettings();
    updateDirty();
    flash('Änderungen verworfen');
  });
  $('ubOpen').addEventListener('click', () => {
    const t = $('ubOpen').dataset.target; if (!t) return;
    if (inHub && (t === 'profile' || t === 'settings')) return openHubSection(t);
    if (inHub && t === 'team') return flash('Öffne zuerst die Band, um die Änderungen in der Verwaltung zu sehen.', true);
    showPage(t);
  });

  let flashTimer = null;
  // ---- Zeichenfilter für Texteingaben: keine Emojis, nur übliche Zeichen; Umlaute bleiben (NFC) ----
  const EMOJI_RE = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}]|[\uFE0E\uFE0F\u20E3\u200D]/u;
  const BAD_CHARS_RE = /[^\p{L}\p{N}\u0300-\u036F\s.,;:!?'"()\[\]\-–—_\/&+*#@%=€$°…·’‘„“”«»§]/gu;
  function cleanText(v) { return String(v == null ? '' : v).normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(BAD_CHARS_RE, ''); }
  let topAlertT = null;
  function topAlert(text) {
    let a = document.getElementById('topAlert');
    if (!a) { a = document.createElement('div'); a.id = 'topAlert'; a.className = 'top-alert'; a.setAttribute('role', 'alert'); document.body.appendChild(a); }
    a.textContent = text; a.classList.add('show'); clearTimeout(topAlertT); topAlertT = setTimeout(() => a.classList.remove('show'), 4200);
  }
  document.addEventListener('input', e => {
    const t = e.target; if (!t || e.isComposing || t.dataset.raw != null) return;
    const ok = t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && ['text', 'search', 'tel', ''].includes((t.getAttribute('type') || '').toLowerCase()));
    if (!ok) return;
    const before = t.value, after = cleanText(before); if (after === before) return;
    const pos = t.selectionStart, hadEmoji = EMOJI_RE.test(before);
    t.value = after; try { const np = Math.max(0, (pos == null ? after.length : pos) - (before.length - after.length)); t.setSelectionRange(np, np); } catch (er) {}
    topAlert(hadEmoji ? 'Emojis können hier nicht verwendet werden. Bei Bedarf bitte Sonderzeichen nutzen, zum Beispiel – & + # *.' : 'Dieses Zeichen ist nicht erlaubt. Erlaubt sind Buchstaben, Zahlen und übliche Satzzeichen.');
  }, true);
  // Säubern beim Verlassen des Feldes (und bei Enter): mehrfache Leerzeichen, Leerzeichen am Rand, zu viele Leerzeilen
  const tidyText = v => String(v == null ? '' : v).replace(/[ \t\u00A0]+/g, ' ').split(/\r?\n/).map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  function tidyField(t) {
    if (!t || t.dataset.raw != null) return;
    const ok = t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && ['text', 'search', 'tel', ''].includes((t.getAttribute('type') || '').toLowerCase()));
    if (!ok) return; const nv = tidyText(t.value); if (nv !== t.value) t.value = nv;
  }
  document.addEventListener('change', e => tidyField(e.target), true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') tidyField(e.target); }, true);
  function flash(text, isErr) {
    const f = $('flash');
    f.textContent = text; f.className = 'flash' + (isErr ? ' err' : '');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => f.classList.add('hidden'), 2600);
  }


  // ================= Kalender (Seite 2) =================
  const CAL_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const CAL_WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const CAL_WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  let calView = 'month';
  let calDate = new Date();
  let calSel = new Date();
  try { const v = ls.get('bandCalView'); if (['day', 'week', 'month', 'year'].includes(v)) calView = v; } catch (e) {}

  const dOnly = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const wdIdx = d => (d.getDay() + 6) % 7;   // Montag = 0
  function startOfWeek(d) { const x = dOnly(d); x.setDate(x.getDate() - wdIdx(x)); return x; }
  function addDays(d, n) { const x = dOnly(d); x.setDate(x.getDate() + n); return x; }
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  const fmtLong = d => `${CAL_WD_LONG[wdIdx(d)]}, ${d.getDate()}. ${CAL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  function calTitle() {
    if (calView === 'year') return String(calDate.getFullYear());
    if (calView === 'month') return `${CAL_MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}`;
    if (calView === 'day') return fmtLong(calDate);
    const s = startOfWeek(calDate), e = addDays(s, 6);
    const range = s.getMonth() === e.getMonth()
      ? `${s.getDate()}.–${e.getDate()}. ${CAL_MONTHS[e.getMonth()]} ${e.getFullYear()}`
      : `${s.getDate()}. ${CAL_MONTHS[s.getMonth()]}${s.getFullYear() !== e.getFullYear() ? ' ' + s.getFullYear() : ''} – ${e.getDate()}. ${CAL_MONTHS[e.getMonth()]} ${e.getFullYear()}`;
    return `KW ${isoWeek(s)} · ${range}`;
  }

  function calStep(dir) {
    const d = new Date(calDate);
    if (calView === 'day') { calDate = addDays(d, dir); calSel = dOnly(calDate); }
    else if (calView === 'week') calDate = addDays(d, 7 * dir);
    else if (calView === 'month') calDate = new Date(d.getFullYear(), d.getMonth() + dir, 1);
    else calDate = new Date(d.getFullYear() + dir, 0, 1);
    renderCalendar(dir);
  }
  function calSetView(v, date) {
    calView = v;
    if (date) calDate = dOnly(date);
    if (v === 'day') { calDate = dOnly(date || calSel); calSel = dOnly(calDate); }
    ls.set('bandCalView', v);
    renderCalendar(0);
  }
  function calSelect(d, gotoView) {
    calSel = dOnly(d);
    if (gotoView) { calView = gotoView; calDate = dOnly(d); ls.set('bandCalView', gotoView); }
    renderCalendar(0);
  }

  // ----- Termine: Daten & Wiederholungen -----
  const DEFAULT_CATEGORIES = [
    { id: 'probe', name: 'Probe', color: '#3b82f6' },
    { id: 'auftritt', name: 'Gig', color: '#8b5cf6' },
    { id: 'sitzung', name: 'Sitzung', color: '#e8a33d' },
    { id: 'sonstiges', name: 'Sonstiges', color: '#10b981' },
  ];
  let calEvents = [];          // [{ id, ...data }]
  let calUnsub = null;
  let calEventsBand = null;
  const pad2 = n => String(n).padStart(2, '0');
  const dKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseKey = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const catOf = id => {
    const cats = (bands[currentBand] && bands[currentBand].cfg.categories) || DEFAULT_CATEGORIES;
    if (id === '__deadline') return { id, name: 'Deadline', color: '#ef4444' };
    return cats.find(c => c.id === id) || { id: '', name: 'Ohne Kategorie', color: '#9ca3af' };
  };
  const canEditCalendar = () => levelFor(currentBand, currentPage === 'page3' ? 'page3' : 'page2') === 'edit';

  // Alle Termine (inkl. Wiederholungen) zwischen from und to (Tage, inklusive)
  function occurrences(ev, from, to) {
    const out = [];
    const base = parseKey(ev.date);
    const r = ev.repeat || { freq: 'none' };
    const ex = new Set(ev.exdates || []);
    const push = d => { if (d >= from && d <= to && !ex.has(dKey(d))) out.push(d); };
    if (!r.freq || r.freq === 'none') { push(base); return out; }
    const iv = Math.max(1, parseInt(r.interval, 10) || 1);
    const until = r.end === 'until' && r.until ? parseKey(r.until) : null;
    const maxCount = r.end === 'count' && r.count ? Math.max(1, parseInt(r.count, 10)) : Infinity;
    let n = 0;
    if (r.freq === 'weekly') {
      const wds = (r.weekdays && r.weekdays.length ? [...r.weekdays] : [wdIdx(base)]).sort((a, b) => a - b);
      let ws = startOfWeek(base);
      for (let w = 0; w < 3000; w++) {
        for (const wd of wds) {
          const d = addDays(ws, wd);
          if (d < base) continue;
          if ((until && d > until) || n >= maxCount || d > to) return out;
          n++; push(d);
        }
        ws = addDays(ws, 7 * iv);
      }
      return out;
    }
    for (let i = 0; i < 20000; i++) {
      let d;
      if (r.freq === 'daily') d = addDays(base, i * iv);
      else if (r.freq === 'monthly') { d = new Date(base.getFullYear(), base.getMonth() + i * iv, base.getDate()); if (d.getDate() !== base.getDate()) continue; }
      else if (r.freq === 'yearly') { d = new Date(base.getFullYear() + i * iv, base.getMonth(), base.getDate()); if (d.getMonth() !== base.getMonth()) continue; }
      else break;
      if ((until && d > until) || n >= maxCount || d > to) break;
      n++; push(d);
    }
    return out;
  }
  // Tag -> Liste der Termine (sortiert)
  function eventsByDay(from, to) {
    const map = {};
    calEvents.forEach(ev => occurrences(ev, from, to).forEach(d => { (map[dKey(d)] = map[dKey(d)] || []).push({ ev, date: d }); }));
    Object.values(map).forEach(list => list.sort((a, b) => (a.ev.allDay ? -1 : 0) - (b.ev.allDay ? -1 : 0) || (a.ev.start || '').localeCompare(b.ev.start || '')));
    return map;
  }
  function loadEvents() {
    if (!db || !currentBand) return;
    if (calEventsBand === currentBand && calUnsub) return;
    if (calUnsub) { try { calUnsub(); } catch (e) {} calUnsub = null; }
    calEventsBand = currentBand;
    calEvents = [];
    const col = db.collection(`calendar/${currentBand}/events`);
    const apply = snap => setEventDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    if (typeof col.onSnapshot === 'function') {
      calUnsub = col.onSnapshot(apply, () => { calUnsub = null; });
    } else {
      calUnsub = () => {};
      col.get().then(apply).catch(() => {});
    }
  }
  // Termine (mit Datum) und eigenständige Checklisten (kind „checklist“, Datum = Deadline oder leer)
  let clLists = [];
  function setEventDocs(arr) {
    calEvents = arr.filter(e => e && e.date);
    clLists = arr.filter(e => e && e.kind === 'checklist');
    refreshEventViews();
  }
  async function reloadEventsOnce() {
    // Für den lokalen Demo-Modus (ohne Live-Aktualisierung)
    if (typeof db.collection('x').onSnapshot === 'function') return;
    const s = await db.collection(`calendar/${currentBand}/events`).get();
    setEventDocs(s.docs.map(d => ({ id: d.id, ...d.data() }))); return;
    refreshEventViews();
  }
  const timeLabel = ev => ev.allDay ? 'Ganztägig' : `${ev.start || ''}${ev.end ? '–' + ev.end : ''}`;
  function evChip(item, cls) {
    const c = catOf(item.ev.category);
    const chip = el('div', 'ev-chip' + (cls ? ' ' + cls : ''));
    chip.style.setProperty('--c', c.color);
    const isDl = item.ev.kind === 'checklist';
    chip.append(el('span', 'ev-dot'), el('span', 'ev-t', (isDl ? '⏰ ' : '') + (item.ev.allDay ? '' : (item.ev.start || '') + ' ') + (item.ev.title || 'Ohne Titel')));
    if (item.ev.repeat && item.ev.repeat.freq && item.ev.repeat.freq !== 'none') chip.appendChild(el('span', 'ev-rep', '↻'));
    chip.title = `${item.ev.title || ''} · ${timeLabel(item.ev)} · ${c.name}`;
    chip.addEventListener('click', e => { e.stopPropagation(); if (isDl) return openDeadline(e, item.ev, item.date); openEventModal({ ev: item.ev, occ: item.date }); });
    return chip;
  }

  // ----- Darstellung -----
  function renderCalendar(dir) {
    ttSub();
    $('calTitle').textContent = calTitle();
    document.querySelectorAll('#calViews button').forEach(b => b.classList.toggle('on', b.dataset.view === calView));
    requestAnimationFrame(() => placeViewInd());
    $('calZoom').classList.toggle('show', calView === 'day' || calView === 'week');
    $('czVal').textContent = Math.round(HOUR_PX / 40 * 100) + ' %';
    $('calAdd').classList.toggle('pv-locked', !canEditCalendar() || !!viewAs);
    const body = $('calBody');
    body.innerHTML = '';
    body.className = 'cal-body view-' + calView;
    if (calView === 'year') renderYear(body);
    else if (calView === 'month') renderMonth(body);
    else if (calView === 'day') renderDay(body);
    else renderWeek(body);
    if (dir) { body.classList.add(dir > 0 ? 'slide-next' : 'slide-prev'); }
    renderDayList();
  }

  function renderDayList() {
    $('calSelLabel').textContent = fmtLong(calSel);
    const list = $('calDayList'); list.innerHTML = '';
    const items = eventsByDay(calSel, calSel)[dKey(calSel)] || [];
    if (!items.length) list.appendChild(el('div', 'mnote', 'Keine Termine an diesem Tag.'));
    items.forEach(it => {
      const c = catOf(it.ev.category);
      const row = el('button', 'day-ev'); row.type = 'button';
      row.style.setProperty('--c', c.color);
      const left = el('div', 'day-ev-time', timeLabel(it.ev));
      const mid = el('div', 'day-ev-main');
      mid.append(el('div', 'day-ev-title', (it.ev.kind === 'checklist' ? '⏰ Deadline: ' : '') + (it.ev.title || 'Ohne Titel')));
      const meta = [c.name, it.ev.location, it.ev.repeat && it.ev.repeat.freq !== 'none' ? '↻ ' + repeatText(it.ev.repeat) : ''].filter(Boolean).join(' · ');
      mid.append(el('div', 'day-ev-meta', meta));
      row.append(left, mid);
      row.addEventListener('click', e => { if (it.ev.kind === 'checklist') return openDeadline(e, it.ev, it.date); openEventModal({ ev: it.ev, occ: it.date }); });
      list.appendChild(row);
    });
    $('calAddDay').classList.toggle('pv-locked', !canEditCalendar() || !!viewAs);
  }

  // Sonn- und Feiertage (Schweiz, allgemein verbreitete Feiertage; kantonale fehlen noch)
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mo - 1, da);
  }
  function holidaysOf(y) {
    const holCache = holidaysOf.c || (holidaysOf.c = {}); if (holCache[y]) return holCache[y];
    const o = {}, add = (d, n) => { o[dKey(d)] = n; }, E = easter(y);
    add(new Date(y, 0, 1), 'Neujahr'); add(new Date(y, 0, 2), 'Berchtoldstag');
    add(addDays(E, -2), 'Karfreitag'); add(E, 'Ostersonntag'); add(addDays(E, 1), 'Ostermontag');
    add(addDays(E, 39), 'Auffahrt'); add(addDays(E, 49), 'Pfingstsonntag'); add(addDays(E, 50), 'Pfingstmontag');
    add(new Date(y, 7, 1), 'Bundesfeier (1. August)'); add(new Date(y, 11, 25), 'Weihnachten'); add(new Date(y, 11, 26), 'Stephanstag');
    return (holCache[y] = o);
  }
  function holidayName(d) { return holidaysOf(d.getFullYear())[dKey(d)] || ''; }
  function calTip(d) { return fmtLong(d) + (holidayName(d) ? ' · ' + holidayName(d) : ''); }

  function dayCell(d, cls, onClick) {
    const today = new Date();
    const b = el('button', 'cal-day' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.appendChild(el('span', 'cal-dn', String(d.getDate())));
    if (sameDay(d, today)) b.classList.add('today');
    if (sameDay(d, calSel)) b.classList.add('sel');
    if (wdIdx(d) >= 5) b.classList.add('weekend');
    if (wdIdx(d) === 6 || holidayName(d)) b.classList.add('holy');
    if (holidayName(d)) b.classList.add('hol');
    b.title = calTip(d);
    b.addEventListener('click', e => { e.stopPropagation(); onClick(d); });
    return b;
  }

  function renderMonth(body) {
    const first = new Date(calDate.getFullYear(), calDate.getMonth(), 1);
    const start = startOfWeek(first);
    const map = eventsByDay(start, addDays(start, 41));
    const grid = el('div', 'cal-month');
    grid.appendChild(el('div', 'cal-head kw', 'KW'));
    CAL_WD.forEach((w, i) => grid.appendChild(el('div', 'cal-head' + (i >= 5 ? ' weekend' : '') + (i === 6 ? ' holy' : ''), w)));
    for (let r = 0; r < 6; r++) {
      const ws = addDays(start, r * 7);
      const kw = el('button', 'cal-kw', String(isoWeek(ws))); kw.type = 'button'; kw.title = 'Woche anzeigen';
      kw.addEventListener('click', () => calSetView('week', ws));
      grid.appendChild(kw);
      for (let c = 0; c < 7; c++) {
        const d = addDays(ws, c);
        // Einfacher Klick: nur auswählen (unten erscheinen die Termine). Doppelklick: Wochenansicht.
        const cell = dayCell(d, d.getMonth() !== first.getMonth() ? 'other' : '', x => selectInMonth(x, cell));
        cell.addEventListener('dblclick', e => { e.stopPropagation(); calSelect(d, 'week'); });
        cell.title = calTip(d) + ' – Doppelklick: Wochenansicht';
        const items = map[dKey(d)] || [];
        if (items.length) {
          const box = el('div', 'cal-evs');
          items.slice(0, 3).forEach(it => box.appendChild(evChip(it)));
          if (items.length > 3) box.appendChild(el('div', 'ev-more', `+${items.length - 3} weitere`));
          cell.appendChild(box);
        }
        grid.appendChild(cell);
      }
    }
    body.appendChild(grid);
  }

  // Erzeugt (einmalig) eine Farbwechsel-Animation für eine Kombination von Farben
  const cycleAnims = {};
  function cycleAnim(colors) {
    const key = colors.join('|');
    if (cycleAnims[key]) return cycleAnims[key];
    const name = 'evcycle' + Object.keys(cycleAnims).length;
    const n = colors.length;
    let frames = '';
    colors.forEach((c, i) => {
      const a = (i / n * 100).toFixed(2), b = ((i + 0.6) / n * 100).toFixed(2);
      frames += `${a}% { background-color: ${c}; } ${b}% { background-color: ${c}; } `;
    });
    frames += `100% { background-color: ${colors[0]}; }`;
    let st = document.getElementById('evCycleStyles');
    if (!st) { st = document.createElement('style'); st.id = 'evCycleStyles'; document.head.appendChild(st); }
    st.appendChild(document.createTextNode(`@keyframes ${name} { ${frames} }\n`));
    cycleAnims[key] = name;
    return name;
  }
  // Auswahl in der Jahresansicht ohne Neuzeichnen (damit ein Doppelklick sauber erkannt wird)
  function selectInMonth(d, cell) {
    calSel = dOnly(d);
    document.querySelectorAll('#calBody .cal-month .cal-day.sel').forEach(x => x.classList.remove('sel'));
    cell.classList.add('sel');
    renderDayList();
  }
  function selectInYear(d, cell) {
    calSel = dOnly(d);
    document.querySelectorAll('#calBody .cal-day.mini.sel').forEach(x => x.classList.remove('sel'));
    cell.classList.add('sel');
    renderDayList();
  }
  function renderYear(body) {
    const y = calDate.getFullYear();
    const map = eventsByDay(new Date(y, 0, 1), new Date(y, 11, 31));
    const wrap = el('div', 'cal-year');
    for (let m = 0; m < 12; m++) {
      const card = el('div', 'cal-mini' + (new Date().getFullYear() === y && new Date().getMonth() === m ? ' current' : ''));
      const t = el('button', 'cal-mini-title', CAL_MONTHS[m]); t.type = 'button'; t.title = 'Monat anzeigen';
      t.addEventListener('click', e => e.stopPropagation());
      t.addEventListener('dblclick', e => { e.stopPropagation(); calSetView('month', new Date(y, m, 1)); });
      t.title = 'Doppelklick: Monat anzeigen';
      card.appendChild(t);
      const g = el('div', 'cal-mini-grid');
      CAL_WD.forEach((w, i) => g.appendChild(el('div', 'cal-mini-wd' + (i === 6 ? ' holy' : ''), w[0])));
      const first = new Date(y, m, 1);
      for (let i = 0; i < wdIdx(first); i++) g.appendChild(el('div'));
      const days = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const date = new Date(y, m, d);
        // Einfachklick: nur auswählen (unten anzeigen) – Doppelklick: Monat öffnen
        const cell = dayCell(date, 'mini', x => selectInYear(x, cell));
        cell.addEventListener('dblclick', e => { e.stopPropagation(); calSelect(date, 'month'); });
        const items = map[dKey(date)];
        if (items && items.length) {
          // Ganzen Tag in der Kategorienfarbe einfärben; bei mehreren Farben langsam wechseln
          const colors = [...new Set(items.map(it => catOf(it.ev.category).color))];
          cell.classList.add('has-ev');
          if (colors.length === 1) cell.style.background = colors[0];
          else { cell.style.background = colors[0]; cell.style.animation = `${cycleAnim(colors)} ${colors.length * 2.4}s ease-in-out infinite`; }
          cell.title = calTip(date) + ' – ' + items.map(it => it.ev.title || 'Termin').join(', ');
        }
        g.appendChild(cell);
      }
      card.appendChild(g);
      card.addEventListener('dblclick', () => calSetView('month', new Date(y, m, 1)));
      wrap.appendChild(card);
    }
    body.appendChild(wrap);
  }

  const WEEK_FROM = 0, WEEK_TO = 24, DAY_FROM = 0;   // Woche und Tag: ganzer Tag 00:00–24:00
  // Zoom in Tag/Woche: Höhe einer Stunde in Pixeln (Shift + Mausrad bzw. zwei Finger)
  const ZOOM_MIN = 20, ZOOM_MAX = 200;
  let HOUR_PX = 40;
  try { const z = parseFloat(ls.get('bandCalZoom')); if (z >= ZOOM_MIN && z <= ZOOM_MAX) HOUR_PX = z; } catch (e) {}
  const setHourVar = () => document.documentElement.style.setProperty('--hour', HOUR_PX + 'px');
  // Spaltenbreite in der Woche (Zoom in die Breite); null = Standard (Handy: ganze Woche sichtbar)
  let WCOL = null;
  try { const w = parseFloat(ls.get('bandCalWcol')); if (w > 0 && w <= 400) WCOL = w; } catch (e) {}
  const setWcolVar = () => { if (WCOL) document.documentElement.style.setProperty('--wcol', WCOL + 'px'); else document.documentElement.style.removeProperty('--wcol'); };
  setWcolVar();
  setHourVar();
  const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  // ----- Tagesansicht: Termine nach Uhrzeit, bei Gigs automatisch mit dem Zeitplan -----
  const GIG_STEPS = [['getin', 'Get In'], ['aufbau', 'Aufbau'], ['soundcheck', 'Soundcheck'], ['linecheck', 'Linecheck'], ['gig', 'Gig']];
  function gigPlanBlocks(ev) {
    const sc = ev.schedule || {};
    const pts = GIG_STEPS.map(([k, label]) => ({ label, t: k === 'gig' ? (ev.allDay ? '' : ev.start) : sc[k] })).filter(x => /^\d\d:\d\d$/.test(x.t || ''))
      .map(x => ({ ...x, m: toMin(x.t) })).sort((a, b) => a.m - b.m);
    const endM = !ev.allDay && /^\d\d:\d\d$/.test(ev.end || '') ? toMin(ev.end) : null;
    return pts.map((p, i) => {
      let b = i < pts.length - 1 ? pts[i + 1].m : (endM != null ? (endM <= p.m ? 24 * 60 : endM) : p.m + 30);
      return { label: p.label, a: p.m, b: Math.max(b, p.m + 15), isGig: p.label === 'Gig', end: p.label === 'Gig' ? ev.end : '' };
    });
  }
  function renderDay(body) {
    const d = dOnly(calDate);
    const today = new Date();
    const items = eventsByDay(d, d)[dKey(d)] || [];
    // Spalten pro Kategorie; Gigs mit Zeitplan werden in ihre Abschnitte aufgeteilt
    const groups = new Map();
    const grp = it => { const id = it.ev.kind === 'checklist' ? '__deadline' : (it.ev.category || ''); if (!groups.has(id)) groups.set(id, { cat: catOf(id), blocks: [], allDay: [] }); return groups.get(id); };
    items.forEach(it => {
      const g = grp(it);
      if (it.ev.category === 'auftritt' && it.ev.kind !== 'checklist' && ttCalOn()) {
        const tl = ttEntries(it.ev.id);
        tl.forEach((x, i) => { const a = toMin(x.time), e = ttEnd(x, tl[i + 1] && tl[i + 1].time); const sub = [x.end ? 'bis ' + x.end : (+x.dur > 0 ? x.dur + ' Min.' : ''), +x.songs > 0 ? x.songs + ' Songs' : '', ttSetName(x) ? '🎼 ' + ttSetName(x) : ''].filter(Boolean).join(' · '); g.blocks.push({ it, a, b: Math.max(e, a + 15), label: ttName(x), plan: true, isGig: false, tt: true, sub }); });
      }
      if (it.ev.category === 'auftritt' && it.ev.kind !== 'checklist') {
        const plan = gigPlanBlocks(it.ev);
        if (plan.length) { plan.forEach(p => g.blocks.push({ it, a: p.a, b: p.b, label: p.label, plan: true, isGig: p.isGig })); if (it.ev.allDay) g.allDay.push(it); return; }
      }
      if (it.ev.allDay) { g.allDay.push(it); return; }
      const a = toMin(it.ev.start), b = Math.max(toMin(it.ev.end || it.ev.start), a + 30);
      g.blocks.push({ it, a, b });
    });
    // von links nach rechts nach der frühesten Zeit sortiert (ganztägig zählt als 00:00)
    const first = g => Math.min(g.allDay.length ? -1 : Infinity, ...g.blocks.map(x => x.a));
    let cols = [...groups.values()].sort((x, y) => first(x) - first(y));
    if (!cols.length) cols = [{ cat: { name: 'Termine', color: 'var(--muted)' }, blocks: [], allDay: [], empty: true }];
    const from = DAY_FROM;
    body.dataset.from = from;
    const wrap = el('div', 'cal-dayview cal-scroll');
    wrap.style.setProperty('--ncol', cols.length);
    const head = el('div', 'cal-dhead sticky-r1' + (sameDay(d, today) ? ' today' : ''));
    head.style.gridColumn = `2 / span ${cols.length}`;
    head.append(el('span', 'wd', CAL_WD_LONG[wdIdx(d)]), el('span', 'dn', String(d.getDate())), el('span', 'dm', CAL_MONTHS[d.getMonth()] + ' ' + d.getFullYear()));
    wrap.append(el('div', 'cal-wcorner sticky-r1 sticky-c'), head);
    // Kategorie-Köpfe
    wrap.appendChild(el('div', 'cal-wcorner sticky-r2 sticky-c'));
    cols.forEach(g => {
      const h = el('div', 'cal-dcat sticky-r2'); h.style.setProperty('--c', g.cat.color);
      h.append(el('span', 'ev-dot'), el('span', null, g.empty ? 'Keine Termine' : g.cat.name));
      wrap.appendChild(h);
    });
    wrap.appendChild(el('div', 'cal-allday-l sticky-c sticky-r3', 'ganztägig'));
    cols.forEach(g => { const ad = el('div', 'cal-allday sticky-r3'); g.allDay.forEach(it => ad.appendChild(evChip(it))); wrap.appendChild(ad); });
    const hours = el('div', 'cal-hours sticky-c');
    for (let hr = from; hr < WEEK_TO; hr++) hours.appendChild(el('div', 'cal-hour', pad2(hr) + ':00'));
    wrap.appendChild(hours);
    const fmt = m => pad2(Math.floor(m / 60) % 24) + ':' + pad2(m % 60);
    cols.forEach(g => {
      const col = el('div', 'cal-col cal-dcol');
      col.style.height = ((WEEK_TO - from) * HOUR_PX) + 'px';
      col.addEventListener('dblclick', e => {
        const r = col.getBoundingClientRect();
        const hr = Math.min(WEEK_TO - 1, from + Math.floor((e.clientY - r.top) / HOUR_PX));
        calCreate(e, d, hr);
      });
      const blocks = g.blocks.sort((x, y) => x.a - y.a);
      const lanes = [];
      blocks.forEach(t => {
        let lane = lanes.findIndex(end => end <= t.a);
        if (lane < 0) { lane = lanes.length; lanes.push(t.b); } else lanes[lane] = t.b;
        t.lane = lane;
      });
      blocks.forEach(t => {
        const top = Math.max(0, (t.a - from * 60) / 60 * HOUR_PX);
        const height = Math.max(20, (Math.min(t.b, WEEK_TO * 60) - Math.max(t.a, from * 60)) / 60 * HOUR_PX);
        let chip;
        if (t.plan) {
          chip = el('div', 'ev-chip ev-block ev-plan' + (t.isGig ? ' is-gig' : '') + (t.tt ? ' is-tt' : ''));
          chip.style.setProperty('--c', g.cat.color);
          const tl = el('span', 'ev-t'); tl.append(el('b', 'ev-pt', fmt(t.a)), ' ' + t.label + ' · ' + (t.it.ev.title || 'Gig'));
          chip.append(tl);
          chip.append(el('span', 'ev-time', (t.tt ? (t.sub || '⏱ Timetable') : (t.isGig && t.it.ev.end ? 'bis ' + t.it.ev.end : '')) + (!t.tt && t.it.ev.location ? (t.isGig && t.it.ev.end ? ' · ' : '') + t.it.ev.location : '')));
          chip.title = `${t.label} – ${t.it.ev.title || ''}`;
          chip.addEventListener('click', e => { e.stopPropagation(); openEventModal({ ev: t.it.ev, occ: t.it.date }); });
        } else {
          chip = evChip(t.it, 'ev-block');
          chip.appendChild(el('span', 'ev-time', timeLabel(t.it.ev) + (t.it.ev.location ? ' · ' + t.it.ev.location : '')));
        }
        chip.style.top = (top + 1) + 'px';
        chip.style.height = (height - 2) + 'px';
        if (height < 44) chip.classList.add('short');
        const w = 100 / lanes.length;
        chip.style.left = `calc(${t.lane * w}% + 4px)`;
        chip.style.width = `calc(${w}% - 8px)`;
        col.appendChild(chip);
      });
      if (sameDay(d, today) && today.getHours() >= from) {
        const line = el('div', 'cal-now');
        line.style.top = ((today.getHours() - from) * 60 + today.getMinutes()) / 60 * HOUR_PX + 'px';
        col.appendChild(line);
      }
      wrap.appendChild(col);
    });
    body.appendChild(wrap);
    setupCalScroll(wrap);
  }
  // ----- fester Ausschnitt für Tag/Woche: Zoom verändert nur den Inhalt, nicht die Grösse des Fensters -----
  let calScroll = { top: null, left: 0 };
  function setupCalScroll(wrap) {
    // Kopfzeilen bleiben oben stehen: zweite Zeile direkt unter der ersten
    const hOf = cls => Math.max(0, ...[...wrap.querySelectorAll(cls)].map(x => x.offsetHeight));
    const h1 = hOf('.sticky-r1'), h2 = hOf('.sticky-r2');
    wrap.querySelectorAll('.sticky-r2').forEach(x => { x.style.top = h1 + 'px'; });
    wrap.querySelectorAll('.sticky-r3').forEach(x => { x.style.top = (h1 + h2) + 'px'; });
    if (calScroll.top == null) calScroll.top = Math.max(0, 7 * HOUR_PX - 10);   // beim ersten Öffnen ab ca. 07:00
    wrap.scrollTop = calScroll.top; wrap.scrollLeft = calScroll.left;
    wrap.addEventListener('scroll', () => { calScroll.top = wrap.scrollTop; calScroll.left = wrap.scrollLeft; }, { passive: true });
  }
  function renderWeek(body) {
    const s = startOfWeek(calDate);
    const today = new Date();
    const map = eventsByDay(s, addDays(s, 6));
    body.dataset.from = WEEK_FROM;
    const wrap = el('div', 'cal-week cal-scroll');
    // Kopfzeile
    wrap.appendChild(el('div', 'cal-wcorner sticky-r1 sticky-c'));
    for (let i = 0; i < 7; i++) {
      const d = addDays(s, i);
      const h = el('button', 'cal-wday sticky-r1' + (sameDay(d, today) ? ' today' : '') + (sameDay(d, calSel) ? ' sel' : '') + (i >= 5 ? ' weekend' : ''));
      h.type = 'button';
      h.append(el('span', 'wd', CAL_WD[i]), el('span', 'dn', String(d.getDate())));
      h.title = fmtLong(d);
      h.addEventListener('click', () => calSelect(d));
      h.addEventListener('dblclick', e => { e.stopPropagation(); calSetView('day', d); });
      h.title = fmtLong(d) + ' – Doppelklick: Tagesansicht';
      wrap.appendChild(h);
    }
    // Ganztägige Termine
    wrap.appendChild(el('div', 'cal-allday-l sticky-c sticky-r2', 'ganztägig'));
    for (let i = 0; i < 7; i++) {
      const d = addDays(s, i);
      const cell = el('div', 'cal-allday sticky-r2' + (sameDay(d, calSel) ? ' sel' : ''));
      (map[dKey(d)] || []).filter(it => it.ev.allDay).forEach(it => cell.appendChild(evChip(it)));
      cell.addEventListener('click', () => calSelect(d));
      wrap.appendChild(cell);
    }
    // Stundenraster
    const hours = el('div', 'cal-hours sticky-c');
    for (let hr = WEEK_FROM; hr < WEEK_TO; hr++) hours.appendChild(el('div', 'cal-hour', pad2(hr) + ':00'));
    wrap.appendChild(hours);
    for (let i = 0; i < 7; i++) {
      const d = addDays(s, i);
      const col = el('div', 'cal-col' + (sameDay(d, calSel) ? ' sel' : '') + (i >= 5 ? ' weekend' : ''));
      col.style.height = ((WEEK_TO - WEEK_FROM) * HOUR_PX) + 'px';
      col.addEventListener('click', () => calSelect(d));
      col.addEventListener('dblclick', e => {
        const r = col.getBoundingClientRect();
        const hr = Math.min(WEEK_TO - 1, WEEK_FROM + Math.floor((e.clientY - r.top) / HOUR_PX));
        calCreate(e, d, hr);
      });
      // Termine mit Uhrzeit, Überschneidungen nebeneinander
      const timed = (map[dKey(d)] || []).filter(it => !it.ev.allDay).map(it => {
        const a = toMin(it.ev.start), b = Math.max(toMin(it.ev.end || it.ev.start) , a + 30);
        return { it, a, b };
      }).sort((x, y) => x.a - y.a);
      const lanes = [];
      timed.forEach(t => {
        let lane = lanes.findIndex(end => end <= t.a);
        if (lane < 0) { lane = lanes.length; lanes.push(t.b); } else lanes[lane] = t.b;
        t.lane = lane;
      });
      timed.forEach(t => {
        const top = Math.max(0, (t.a - WEEK_FROM * 60) / 60 * HOUR_PX);
        const height = Math.max(18, (Math.min(t.b, WEEK_TO * 60) - Math.max(t.a, WEEK_FROM * 60)) / 60 * HOUR_PX);
        const chip = evChip(t.it, 'ev-block');
        chip.style.top = top + 'px';
        chip.style.height = height + 'px';
        const w = 100 / lanes.length;
        chip.style.left = `calc(${t.lane * w}% + 2px)`;
        chip.style.width = `calc(${w}% - 4px)`;
        chip.appendChild(el('span', 'ev-time', timeLabel(t.it.ev)));
        col.appendChild(chip);
      });
      if (sameDay(d, today) && today.getHours() >= WEEK_FROM) {
        const line = el('div', 'cal-now');
        line.style.top = ((today.getHours() - WEEK_FROM) * 60 + today.getMinutes()) / 60 * HOUR_PX + 'px';
        col.appendChild(line);
      }
      wrap.appendChild(col);
    }
    body.appendChild(wrap);
    setupCalScroll(wrap);
  }

  // ----- Termin-Dialog -----
  const FREQ_UNITS = { daily: ['Tag', 'Tage'], weekly: ['Woche', 'Wochen'], monthly: ['Monat', 'Monate'], yearly: ['Jahr', 'Jahre'] };
  function repeatText(r) {
    if (!r || !r.freq || r.freq === 'none') return 'Keine Wiederholung';
    const iv = Math.max(1, parseInt(r.interval, 10) || 1);
    const u = FREQ_UNITS[r.freq];
    let t = iv === 1 ? { daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', yearly: 'Jährlich' }[r.freq] : `Alle ${iv} ${u[1]}`;
    if (r.freq === 'weekly' && r.weekdays && r.weekdays.length) t += ' am ' + r.weekdays.slice().sort((a, b) => a - b).map(i => CAL_WD[i]).join(', ');
    if (r.end === 'until' && r.until) { const u2 = parseKey(r.until); t += ` bis ${u2.getDate()}.${u2.getMonth() + 1}.${u2.getFullYear()}`; }
    if (r.end === 'count' && r.count) t += `, ${r.count}×`;
    return t;
  }
  let evEditing = null;       // { ev?, occ? }
  let evWeekdays = new Set();
  function gigFlash() { const b = $('gigAdd'); b.classList.remove('flash3'); void b.offsetWidth; b.classList.add('flash3'); setTimeout(() => b.classList.remove('flash3'), 2400); }
  // Textvorschläge für die Verpflegung (aus Allergene.txt): Klick hängt den Text an
  const CAT_SUGG = ['1 Vegi-Menü', '1 veganes Menü', 'Bitte ohne Schweinefleisch', 'Bitte glutenfreie Option', 'Bitte laktosefreie Option', 'Getränke für die Band', 'Nachtessen im Backstage'];
  function catSuggBuild() {
    const box = $('evCatSugg'); if (!box) return; box.innerHTML = '';
    const add = t => { const f = $('evCatering'); f.value = (f.value.trim() ? f.value.trim() + '\n' : '') + t; f.dispatchEvent(new Event('input')); };
    CAT_SUGG.forEach(t => { const b = el('button', 'chip-btn', '+ ' + t); b.type = 'button'; b.addEventListener('click', () => add(t)); box.append(b); });
  }
  // Teilnehmer eines Termins (leer = alle)
  async function evAttBuild(sel) {
    const box = $('evAtt'); box.innerHTML = ''; const bid = currentBand;
    const draw = () => {
      box.innerHTML = '';
      (bandMembersCache[bid] || []).forEach(m => { const lb = el('label', 'hc-opt'), cb = el('input'); cb.type = 'checkbox'; cb.value = m.uid; cb.checked = sel.includes(m.uid); cb.addEventListener('change', sum); lb.append(cb, m.name || 'Unbekannt'); box.append(lb); });
      sum();
    };
    const sum = () => { const n = box.querySelectorAll('input:checked').length; $('secAttSum').textContent = n ? n + ' ausgewählt' : 'alle'; };
    await loadBandMembers(bid);
    draw();
  }
  function openEventModal(opts) {
    // Gigs werden nur auf der Gig-Seite bearbeitet: aus dem Kalender dorthin springen
    if (opts.ev && opts.ev.category === 'auftritt' && opts.ev.kind !== 'checklist' && !opts.gigOnly && !opts.checklist) {
      const d0 = opts.occ ? dOnly(opts.occ) : parseKey(opts.ev.date);
      gigsOpen.add(opts.ev.id + '|' + dKey(d0));
      if (levelFor(currentBand, 'page3') === 'hidden') return previewBlocked(null, 'Keine Berechtigung: Die Registerkarte „Gigs“ ist für dich ausgeblendet. Bitte den Admin um Zugriff.');
      showPage('page3');
      setTimeout(() => { const c = document.querySelector(`.gig[data-key="${opts.ev.id}|${dKey(d0)}"]`); if (c) c.scrollIntoView({ block: 'center' }); }, 80);
      return;
    }
    evEditing = opts;
    const ev = opts.ev || null;
    const isGigEv = !!(ev && ev.category === 'auftritt');
    const editable = canEditCalendar() && (!isGigEv || canRoles(currentBand));
    $('evReadonly').textContent = isGigEv && canEditCalendar() && !canRoles(currentBand)
      ? '🔒 Gigs bearbeiten dürfen nur der Admin und Mitglieder mit der Rolle „Organisation“. Du kannst diesen Gig nur ansehen.'
      : 'Du kannst diesen Termin nur ansehen.';
    const m = $('evModal');
    const gigOnly = !!opts.gigOnly;
    $('evModalTitle').textContent = gigOnly ? (ev ? (editable ? 'Gig bearbeiten' : 'Gig') : 'Gig erstellen') : (ev ? (editable ? 'Termin bearbeiten' : 'Termin') : 'Neuer Termin');
    // Kategorien
    const sel = $('evCat'); sel.innerHTML = '';
    ((bands[currentBand] && bands[currentBand].cfg.categories) || DEFAULT_CATEGORIES).filter(c => c.id !== 'auftritt' || gigOnly || isGigEv).forEach(c => { const o = el('option', null, c.name); o.value = c.id; sel.appendChild(o); });
    const date = ev ? parseKey(ev.date) : dOnly(opts.date || calSel);
    $('evTitle').value = ev ? ev.title || '' : '';
    $('evDate').value = dKey(date);
    $('evAllDay').checked = ev ? !!ev.allDay : false;
    const h = opts.hour != null ? opts.hour : 19;
    $('evStart').value = ev ? ev.start || '' : pad2(h) + ':00';
    $('evEnd').value = ev ? ev.end || '' : pad2(Math.min(23, h + 2)) + ':00';
    $('evLocation').value = ev ? ev.location || '' : '';
    $('evNotes').value = ev ? ev.notes || '' : '';
    $('evAddress').value = ev ? ev.address || '' : '';
    $('evParking').value = ev ? ev.parking || '' : '';
    $('evMaps').value = ev ? ev.mapsUrl || '' : '';
    const sc = (ev && ev.schedule) || {};
    $('evGetIn').value = sc.getin || ''; $('evAufbau').value = sc.aufbau || ''; $('evSoundcheck').value = sc.soundcheck || ''; $('evLinecheck').value = sc.linecheck || '';
    $('evCatering').value = ev ? ev.catering || '' : ''; $('evCateringTime').value = ev ? ev.cateringTime || '' : '';
    evAttBuild(ev && Array.isArray(ev.attendees) ? ev.attendees : []); catSuggBuild();
    $('evChecklist').checked = !!(ev && ev.checklist) || (!ev && !!opts.checklist);
    evLinkList = ev && Array.isArray(ev.links) ? ev.links.slice() : [];
    evContactList = ev && Array.isArray(ev.contacts) ? ev.contacts.map(c => ({ ...c })) : [];
    renderContactInputs(editable);
    renderLinkInputs(editable);
    evDocList = ev && Array.isArray(ev.docs) ? ev.docs.slice() : []; evDocNew = []; evDocRemoved = [];
    setMsg($('evDocMsg'), ''); renderDocInputs(editable);
    $('evToGig').classList.toggle('hidden', gigOnly || !!ev || !!opts.checklist);
    sel.value = gigOnly ? 'auftritt' : (ev && ev.category ? ev.category : (opts.category || (sel.options[0] ? sel.options[0].value : '')));
    paintCatDot();
    updateGigFields();
    const r = (ev && ev.repeat) || { freq: 'none' };
    $('evFreq').value = r.freq || 'none';
    $('evInterval').value = r.interval || 1;
    evWeekdays = new Set(r.weekdays && r.weekdays.length ? r.weekdays : [wdIdx(date)]);
    document.querySelector(`input[name="evEnd"][value="${r.end || 'never'}"]`).checked = true;
    $('evUntil').value = r.until || dKey(addDays(date, 90));
    $('evCount').value = r.count || 10;
    updateRepeatUi();
    $('evAllDay').dispatchEvent(new Event('change'));
    // Bearbeitbar?
    m.querySelectorAll('input, select, textarea').forEach(x => { x.disabled = !editable; });
    m.querySelectorAll('.wd-chip').forEach(x => { x.disabled = !editable; });
    sel.disabled = !editable || gigOnly;
    $('evCatLock').classList.toggle('hidden', !gigOnly);
    // Abschnitte: wichtige offen, leere zu
    $('secTime').open = true; $('secPlace').open = true;
    $('secCatering').open = !!$('evCatering').value || !!$('evCateringTime').value; $('secLinks').open = evLinkList.length > 0; $('secContact').open = evContactList.length > 0;
    $('secDocs').open = evDocList.length > 0;
    $('secNotes').open = !!$('evNotes').value; $('secRepeat').open = $('evFreq').value !== 'none';
    updateSecSums();
    $('evSave').classList.toggle('hidden', !editable);
    $('evDelete').classList.toggle('hidden', !editable || !ev);
    $('evDelConfirm').classList.add('hidden');
    $('evReadonly').classList.toggle('hidden', editable);
    $('evOccInfo').textContent = ev && ev.repeat && ev.repeat.freq !== 'none' && opts.occ ? `Teil einer Serie (${repeatText(ev.repeat)}). Änderungen gelten für die ganze Serie.` : '';
    setMsg($('evMsg'), '');
    m.classList.remove('hidden');
    setTimeout(() => { if (editable) $('evTitle').focus(); }, 30);
  }
  function closeEventModal(saved) {
    // Nicht gespeicherte, neu hochgeladene Dokumente wieder löschen
    if (saved !== true) { evDocNew.forEach(id => deleteAsset(id)); }
    evDocNew = []; evDocRemoved = [];
    $('evModal').classList.add('hidden'); evEditing = null;
  }
  function paintCatDot() { $('evCatDot').style.background = catOf($('evCat').value).color; }
  // Bei Gigs: Location, Adresse, Parkieren
  function updateGigFields() {
    const gig = $('evCat').value === 'auftritt';
    $('evGigFields').classList.toggle('hidden', !gig);
    $('evSchedule').classList.toggle('hidden', !gig);
    document.querySelectorAll('#evModal .gig-only').forEach(x => x.classList.toggle('hidden', !gig));
    $('evStartLabel').textContent = gig ? 'Gig' : 'Von';
    $('evEndLabel').textContent = gig ? 'Gig Ende' : 'Bis';
    $('secTimeTitle').textContent = gig ? 'Zeitplan' : 'Zeit';
    $('secPlaceTitle').textContent = gig ? 'Location & Anfahrt' : 'Ort';
    $('evLocationLabel').innerHTML = gig ? 'Location <small>(optional)</small>' : 'Ort <small>(optional)</small>';
    $('evLocation').placeholder = gig ? 'z. B. Kulturhaus Bern' : 'z. B. Proberaum';
  }

  // ================= Dokumente (Gigs) =================
  let assetsApi;                 // undefined = noch nicht geprüft, null = nicht verfügbar
  const getAssets = () => Data.assets();
  const docUrl = id => Data.assetUrl(id);
  const EXT_TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', json: 'application/json', mp4: 'video/mp4', webm: 'video/webm' };
  const ALLOWED = new Set(Object.values(EXT_TYPES));
  function fileType(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (ALLOWED.has(f.type)) return f.type;
    return EXT_TYPES[ext] || '';
  }
  const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const docIcon = t => t === 'application/pdf' ? '📄' : t.startsWith('image/') ? '🖼️' : t.startsWith('video/') ? '🎬' : t === 'text/csv' ? '📊' : '📝';
  const uploadErr = e => {
    const c = e && e.code;
    if (c === 'too_large') return 'Datei zu gross (max. 20 MB, SVG max. 2 MB).';
    if (c === 'unsupported_type') return 'Dieser Dateityp wird nicht unterstützt.';
    if (c === 'quota_or_state') return 'Der Speicherplatz der App ist voll.';
    if (c === 'rate_limited') return 'Zu viele Uploads auf einmal – bitte kurz warten.';
    return 'Hochladen hat nicht geklappt. Bitte erneut versuchen.';
  };
  async function uploadFiles(files, msgEl) {
    const api = await getAssets();
    if (!api) { setMsg(msgEl, 'Dokumente hochladen ist für dich hier nicht möglich.', 'error'); return []; }
    const out = [];
    for (const f of files) {
      const type = fileType(f);
      if (!type) { setMsg(msgEl, `„${f.name}“: Dateityp nicht unterstützt. Erlaubt sind PDF, Bilder, Text, CSV, Markdown, JSON und Video.`, 'error'); continue; }
      if (f.size > (type === 'image/svg+xml' ? 2 : 20) * 1048576) { setMsg(msgEl, `„${f.name}“ ist zu gross.`, 'error'); continue; }
      setMsg(msgEl, `„${f.name}“ wird hochgeladen …`);
      try {
        const r = await api.upload(f, { type });
        out.push({ id: r.id, name: f.name, type: r.contentType || type, size: r.sizeBytes || f.size, by: uid, at: new Date().toISOString() });
        setMsg(msgEl, '');
      } catch (e) { setMsg(msgEl, `„${f.name}“: ${uploadErr(e)}`, 'error'); }
    }
    return out;
  }
  async function deleteAsset(id) { try { const api = await getAssets(); if (api) await api.delete(id); } catch (e) {} }
  const DOC_DENIED = 'Keine Berechtigung: Bitte eine berechtigte Person (Admin oder Organisation) bitten, die Datei hinzuzufügen.';
  const DOC_DENIED_RM = 'Keine Berechtigung: Bitte eine berechtigte Person (Admin oder Organisation) bitten, die Datei zu entfernen.';
  function docRow(d, onRemove, locked) {
    const row = el('div', 'doc-row');
    row.append(el('span', 'doc-ico', docIcon(d.type || '')));
    const a = el('a', 'doc-name', d.name || 'Dokument'); a.href = docUrl(d.id); a.target = '_blank'; a.rel = 'noopener';
    row.append(a, el('span', 'doc-size', d.size ? fmtSize(d.size) : ''));
    if (onRemove) { const rm = el('button', 'link-danger' + (locked ? ' pv-locked' : ''), 'Entfernen'); rm.type = 'button'; rm.addEventListener('click', onRemove); row.appendChild(rm); }
    return row;
  }

  // Im Termin-Dialog
  let evDocList = [], evDocNew = [], evDocRemoved = [];
  function renderDocInputs(editable) {
    const box = $('evDocs'); box.innerHTML = '';
    if (!evDocList.length) box.appendChild(el('div', 'mnote', 'Noch keine Dokumente – z. B. Vertrag, Technik-Rider, Bühnenplan, Setlist.'));
    const allowed = canRoles(currentBand);
    evDocList.forEach((d, i) => box.appendChild(docRow(d, editable === false ? null : e => {
      if (!allowed) return previewBlocked(e, DOC_DENIED_RM);
      evDocList.splice(i, 1);
      if (evDocNew.includes(d.id)) { evDocNew = evDocNew.filter(x => x !== d.id); deleteAsset(d.id); }
      else evDocRemoved.push(d.id);
      renderDocInputs(true); updateSecSums();
    }, !allowed)));
    $('evDocAdd').classList.toggle('hidden', editable === false);
    $('evDocAdd').classList.toggle('pv-locked', !allowed || !!viewAs);
    $('secDocsSum').textContent = evDocList.length ? `${evDocList.length} Dokument${evDocList.length > 1 ? 'e' : ''}` : '';
  }
  $('evDocAdd').addEventListener('click', e => {
    if (!canRoles(currentBand)) { e.preventDefault(); return previewBlocked(e, DOC_DENIED); }
    if (viewAs) { e.preventDefault(); previewBlocked(); }
  });
  $('evDocFile').addEventListener('change', async e => {
    const files = [...(e.target.files || [])]; e.target.value = '';
    if (!files.length || viewAs || !canRoles(currentBand)) return;
    const added = await uploadFiles(files, $('evDocMsg'));
    added.forEach(d => { evDocList.push(d); evDocNew.push(d.id); });
    renderDocInputs(true); updateSecSums();
  });

  // ----- Links (Gig) -----
  let evLinkList = [];
  function normUrl(u) { u = (u || '').trim(); if (!u) return ''; return /^https?:\/\//i.test(u) ? u : 'https://' + u; }
  // ----- Kontakte (Gigs): Name, Funktion, Telefon, E-Mail -----
  let evContactList = [];
  function renderContactInputs(editable) {
    const box = $('evContacts'); box.innerHTML = '';
    if (!evContactList.length) box.appendChild(el('div', 'mnote', 'Noch keine Kontakte – z. B. Veranstalter, Technik vor Ort, Booking.'));
    evContactList.forEach((c, i) => {
      const card = el('div', 'contact-edit');
      const f = (key, ph, type) => {
        const inp = el('input'); inp.type = type || 'text'; inp.placeholder = ph; inp.value = c[key] || ''; inp.disabled = editable === false; inp.maxLength = 80;
        inp.addEventListener('input', () => { evContactList[i][key] = inp.value; updateSecSums(); });
        return inp;
      };
      card.append(f('name', 'Name'), f('role', 'Funktion, z. B. Veranstalter'), f('phone', 'Telefon', 'tel'), f('email', 'E-Mail', 'email'));
      if (editable !== false) {
        const rm = el('button', 'link-danger', 'Entfernen'); rm.type = 'button';
        rm.addEventListener('click', () => { evContactList.splice(i, 1); renderContactInputs(true); updateSecSums(); });
        card.appendChild(rm);
      }
      box.appendChild(card);
    });
    $('evAddContact').classList.toggle('hidden', editable === false);
  }
  $('evAddContact').addEventListener('click', () => {
    evContactList.push({ name: '', role: '', phone: '', email: '' }); renderContactInputs(true); updateSecSums();
    const ins = $('evContacts').querySelectorAll('.contact-edit'); if (ins.length) ins[ins.length - 1].querySelector('input').focus();
  });
  function renderLinkInputs(editable) {
    const box = $('evLinks'); box.innerHTML = '';
    if (!evLinkList.length) box.appendChild(el('div', 'mnote', 'Noch keine Links – z. B. Veranstaltungsseite, Tickets, Technik-Rider.'));
    evLinkList.forEach((l, i) => {
      const row = el('div', 'link-row');
      const inp = el('input'); inp.type = 'url'; inp.placeholder = 'https://…'; inp.value = l; inp.disabled = editable === false;
      inp.addEventListener('input', () => { evLinkList[i] = inp.value; updateSecSums(); });
      row.appendChild(inp);
      if (editable !== false) {
        const rm = el('button', 'link-danger', 'Entfernen'); rm.type = 'button';
        rm.addEventListener('click', () => { evLinkList.splice(i, 1); renderLinkInputs(true); updateSecSums(); });
        row.appendChild(rm);
      } else if (l) {
        const a = el('a', 'map-link', 'Öffnen ↗'); a.href = normUrl(l); a.target = '_blank'; a.rel = 'noopener'; row.appendChild(a);
      }
      box.appendChild(row);
    });
    $('evAddLink').classList.toggle('hidden', editable === false);
  }
  $('evAddLink').addEventListener('click', () => {
    evLinkList.push(''); renderLinkInputs(true);
    const ins = $('evLinks').querySelectorAll('input'); if (ins.length) ins[ins.length - 1].focus();
  });
  // Kurze Zusammenfassung neben jedem Abschnittstitel
  function updateSecSums() {
    const gig = $('evCat').value === 'auftritt';
    const times = gig
      ? [['Get In', 'evGetIn'], ['Soundcheck', 'evSoundcheck'], ['Gig', 'evStart']].map(([k, id]) => $(id).value ? `${k} ${$(id).value}` : '').filter(Boolean).join(' · ')
      : ($('evAllDay').checked ? 'Ganztägig' : [$('evStart').value, $('evEnd').value].filter(Boolean).join('–'));
    $('secTimeSum').textContent = $('evAllDay').checked ? 'Ganztägig' : times;
    $('secPlaceSum').textContent = $('evLocation').value.trim();
    $('secCateringSum').textContent = $('evCatering').value.trim() || $('evCateringTime').value ? '✓' : '';
    const n = evLinkList.filter(x => (x || '').trim()).length;
    $('secLinksSum').textContent = n ? `${n} Link${n > 1 ? 's' : ''}` : '';
    const nc = evContactList.filter(c => (c.name || c.phone || c.email || '').trim()).length;
    $('secContactSum').textContent = nc ? (nc === 1 ? (evContactList.find(c => (c.name || '').trim()) || {}).name || '1 Kontakt' : `${nc} Kontakte`) : '';
    $('secNotesSum').textContent = $('evNotes').value.trim() ? '✓' : '';
    $('secRepeatSum').textContent = $('evFreq').value === 'none' ? 'Nie' : repeatText(collectRepeat());
  }
  ['evGetIn', 'evAufbau', 'evSoundcheck', 'evLinecheck', 'evStart', 'evEnd', 'evLocation', 'evCatering', 'evNotes', 'evFreq', 'evAllDay'].forEach(id => $(id).addEventListener('input', () => updateSecSums()));
  function updateRepeatUi() {
    const f = $('evFreq').value;
    $('evRepeatOpts').classList.toggle('hidden', f === 'none');
    if (f !== 'none') {
      const iv = Math.max(1, parseInt($('evInterval').value, 10) || 1);
      $('evUnit').textContent = FREQ_UNITS[f][iv === 1 ? 0 : 1];
    }
    $('evWeekdaysRow').classList.toggle('hidden', f !== 'weekly');
    const box = $('evWeekdays'); box.innerHTML = '';
    CAL_WD.forEach((w, i) => {
      const b = el('button', 'wd-chip' + (evWeekdays.has(i) ? ' on' : ''), w); b.type = 'button';
      b.disabled = !canEditCalendar();
      b.addEventListener('click', () => { if (evWeekdays.has(i) && evWeekdays.size > 1) evWeekdays.delete(i); else evWeekdays.add(i); updateRepeatUi(); });
      box.appendChild(b);
    });
    const end = (document.querySelector('input[name="evEnd"]:checked') || {}).value;
    $('evUntil').classList.toggle('dim', end !== 'until');
    $('evCount').classList.toggle('dim', end !== 'count');
    $('evRepeatSummary').textContent = f === 'none' ? '' : repeatText(collectRepeat());
    if (typeof updateSecSums === 'function') updateSecSums();
  }
  function collectRepeat() {
    const f = $('evFreq').value;
    if (f === 'none') return { freq: 'none' };
    const end = (document.querySelector('input[name="evEnd"]:checked') || {}).value || 'never';
    const r = { freq: f, interval: Math.max(1, parseInt($('evInterval').value, 10) || 1), end };
    if (f === 'weekly') r.weekdays = [...evWeekdays].sort((a, b) => a - b);
    if (end === 'until') r.until = $('evUntil').value;
    if (end === 'count') r.count = Math.max(1, parseInt($('evCount').value, 10) || 1);
    return r;
  }
  ['evFreq', 'evInterval', 'evUntil', 'evCount'].forEach(id => $(id).addEventListener('input', updateRepeatUi));
  document.querySelectorAll('input[name="evEnd"]').forEach(x => x.addEventListener('change', updateRepeatUi));
  $('evCat').addEventListener('change', () => { paintCatDot(); updateGigFields(); updateSecSums(); });
  $('evAllDay').addEventListener('change', () => { $('evTimes').classList.toggle('hidden', $('evAllDay').checked); });
  $('evCancel').addEventListener('click', () => closeEventModal());
  $('evClose').addEventListener('click', closeEventModal);
  $('evToGig').addEventListener('click', () => {
    closeEventModal();
    if (levelFor(currentBand, 'page3') === 'hidden') return previewBlocked(null, 'Keine Berechtigung: Die Registerkarte „Gigs“ ist für dich ausgeblendet. Bitte den Admin um Zugriff.');
    showPage('page3'); setTimeout(gigFlash, 150);
  });
  $('evModal').addEventListener('click', e => { if (e.target === $('evModal')) closeEventModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('evModal').classList.contains('hidden')) closeEventModal(); });

  async function writeEvent(id, data) {
    const col = db.collection(`calendar/${currentBand}/events`);
    const ref = id ? col.doc(id) : col.doc();
    await ref.set(data);
    await reloadEventsOnce();
    return ref.id;
  }
  $('evSave').addEventListener('click', async () => {
    if (viewAs) return previewBlocked();
    if (!canEditCalendar()) return;
    const msg = $('evMsg');
    const title = $('evTitle').value.trim();
    const date = $('evDate').value;
    const allDay = $('evAllDay').checked;
    const start = $('evStart').value, end = $('evEnd').value;
    if (!title) return setMsg(msg, 'Bitte gib einen Titel ein.', 'error');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setMsg(msg, 'Bitte wähle ein Datum.', 'error');
    if (!allDay && !start) return setMsg(msg, 'Bitte gib eine Startzeit ein.', 'error');
    if (!allDay && end && toMin(end) < toMin(start)) return setMsg(msg, 'Das Ende liegt vor dem Beginn.', 'error');
    const repeat = collectRepeat();
    if (repeat.end === 'until' && (!repeat.until || repeat.until < date)) return setMsg(msg, 'Das Enddatum der Wiederholung muss nach dem Termin liegen.', 'error');
    const ev = evEditing && evEditing.ev;
    const now = new Date().toISOString();
    const data = {
      title, date, allDay, start: allDay ? '' : start, end: allDay ? '' : end,
      location: $('evLocation').value.trim(), notes: $('evNotes').value.trim(),
      address: $('evCat').value === 'auftritt' || (evEditing && evEditing.gigOnly) ? $('evAddress').value.trim() : (ev && ev.address) || '',
      parking: $('evCat').value === 'auftritt' || (evEditing && evEditing.gigOnly) ? $('evParking').value.trim() : (ev && ev.parking) || '',
      mapsUrl: $('evCat').value === 'auftritt' || (evEditing && evEditing.gigOnly) ? normUrl($('evMaps').value) : (ev && ev.mapsUrl) || '',
      schedule: { getin: $('evGetIn').value, aufbau: $('evAufbau').value, soundcheck: $('evSoundcheck').value, linecheck: $('evLinecheck').value },
      attendees: [...$('evAtt').querySelectorAll('input:checked')].map(i => i.value),
      catering: $('evCatering').value.trim(), cateringTime: /^\d\d:\d\d$/.test($('evCateringTime').value) ? $('evCateringTime').value : '',
      links: evLinkList.map(normUrl).filter(Boolean),
      contacts: $('evCat').value === 'auftritt' || (evEditing && evEditing.gigOnly) ? evContactList.map(c => ({ name: (c.name || '').trim(), role: (c.role || '').trim(), phone: (c.phone || '').trim(), email: (c.email || '').trim() })).filter(c => c.name || c.phone || c.email) : ((ev && ev.contacts) || []),
      docs: evDocList,
      category: evEditing && evEditing.gigOnly ? 'auftritt' : $('evCat').value, repeat,
      exdates: ev && ev.exdates ? ev.exdates : [],
      checklist: $('evChecklist').checked, checklists: (ev && ev.checklists) || {},
      createdBy: ev ? ev.createdBy : uid, createdAt: ev ? ev.createdAt : now, updatedBy: uid, updatedAt: now,
    };
    $('evSave').disabled = true; setMsg(msg, 'Wird gespeichert …');
    try {
      await writeEvent(ev ? ev.id : null, data);
      calSel = parseKey(date);
      evDocRemoved.forEach(id => deleteAsset(id));
      closeEventModal(true);
      refreshEventViews();
      const isGig = data.category === 'auftritt';
      flash(ev ? (isGig ? 'Gig gespeichert ✓' : 'Termin gespeichert ✓') : (isGig ? 'Gig erstellt ✓' : 'Termin erstellt ✓'));
    } catch (e) {
      setMsg(msg, friendlyError(e), 'error');
    } finally { $('evSave').disabled = false; }
  });
  $('evDelete').addEventListener('click', () => {
    if (viewAs) return previewBlocked();
    const ev = evEditing && evEditing.ev; if (!ev) return;
    const series = ev.repeat && ev.repeat.freq !== 'none';
    $('evDelOne').classList.toggle('hidden', !series || !evEditing.occ);
    $('evDelAll').textContent = series ? 'Ganze Serie löschen' : 'Ja, löschen';
    $('evDelConfirm').classList.remove('hidden');
  });
  $('evDelNo').addEventListener('click', () => $('evDelConfirm').classList.add('hidden'));
  $('evDelAll').addEventListener('click', async () => {
    const ev = evEditing && evEditing.ev; if (!ev) return;
    try {
      await db.collection(`calendar/${currentBand}/events`).doc(ev.id).delete();
      (ev.docs || []).forEach(dc => deleteAsset(dc.id));
      calEvents = calEvents.filter(x => x.id !== ev.id);
      await reloadEventsOnce();
      closeEventModal(); refreshEventViews(); flash('Termin gelöscht');
    } catch (e) { setMsg($('evMsg'), friendlyError(e), 'error'); }
  });
  $('evDelOne').addEventListener('click', async () => {
    const ev = evEditing && evEditing.ev; if (!ev || !evEditing.occ) return;
    const { id, ...rest } = ev;
    const data = { ...rest, exdates: [...new Set([...(ev.exdates || []), dKey(evEditing.occ)])], updatedBy: uid, updatedAt: new Date().toISOString() };
    try { await writeEvent(id, data); closeEventModal(); refreshEventViews(); flash('Termin an diesem Tag gelöscht'); }
    catch (e) { setMsg($('evMsg'), friendlyError(e), 'error'); }
  });
  // Fehlende Berechtigung zuerst prüfen (gilt auch in der Rollenvorschau), dann Vorschau-Sperre
  const CAL_DENIED = 'Keine Berechtigung: Bitte eine berechtigte Person bitten, den Termin einzutragen – oder den Admin, dir das Recht „Bearbeiten“ für den Kalender zu geben.';
  function calCreate(e, date, hour) {
    if (!canEditCalendar()) return previewBlocked(e, CAL_DENIED);
    if (viewAs) return previewBlocked(e);
    openEventModal(hour != null ? { date, hour } : { date });
  }
  $('calAdd').addEventListener('click', e => calCreate(e, calSel));
  $('calAddDay').addEventListener('click', e => calCreate(e, calSel));


  // Bedienung: Knöpfe, Tastatur, Wischen
  $('calPrev').addEventListener('click', () => calStep(-1));
  $('calNext').addEventListener('click', () => calStep(1));
  $('calToday').addEventListener('click', () => { calDate = new Date(); calSel = dOnly(new Date()); renderCalendar(0); });
  document.querySelectorAll('#calViews button').forEach(b => b.addEventListener('click', () => calSetView(b.dataset.view, calView === 'year' && b.dataset.view !== 'year' ? calSel : null)));
  document.addEventListener('keydown', e => {
    if (currentPage !== 'page2' || $('app').classList.contains('hidden') || !$('evModal').classList.contains('hidden')) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); calStep(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); calStep(1); }
    else if (e.key === 'd' || e.key === 'D') calSetView('day', calSel);
    else if (e.key === 'w' || e.key === 'W') calSetView('week', calSel);
    else if (e.key === 'm' || e.key === 'M') calSetView('month', calSel);
    else if (e.key === 'j' || e.key === 'J') calSetView('year', calSel);
    else if (e.key === 't' || e.key === 'T') $('calToday').click();
  });
  (() => {
    const area = $('calBody');
    let sx = 0, sy = 0, sid = null, swiping = false, suppressUntil = 0;
    area.addEventListener('click', ev => { if (Date.now() < suppressUntil) { ev.stopPropagation(); ev.preventDefault(); } }, true);
    area.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; sid = e.pointerId; swiping = false; });
    area.addEventListener('pointermove', e => {
      if (e.pointerId !== sid) return;
      if (window.calPinching) { swiping = false; area.style.transform = ''; return; }
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!swiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) swiping = true;
      if (swiping) area.style.transform = `translateX(${dx * 0.35}px)`;
    });
    const end = e => {
      if (e.pointerId !== sid) return;
      const dx = e.clientX - sx;
      area.style.transform = '';
      if (swiping && Math.abs(dx) > 60 && !window.calPinching) {
        suppressUntil = Date.now() + 350;   // Klick nach dem Wischen ignorieren
        calStep(dx < 0 ? 1 : -1);
      }
      sid = null; swiping = false;
    };
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', end);
  })();

  // ----- Zoom in Tag- und Wochenansicht -----
  (() => {
    const area = $('calBody');
    const vp = area.parentElement;
    const tip = el('div', 'cal-zoom-tip'); vp.appendChild(tip);
    let tipT = null, pending = null, raf = 0;
    const scroller = () => { const inner = area.querySelector('.cal-scroll'); if (inner) return inner; let n = area; while (n && n !== document.body) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return document.scrollingElement; };
    const zoomable = () => currentPage === 'page2' && (calView === 'day' || calView === 'week');
    // neue Stundenhöhe setzen, dabei die Uhrzeit unter dem Finger/Mauszeiger an derselben Stelle halten
    function applyZoom(px, clientY) {
      px = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, px));
      if (Math.abs(px - HOUR_PX) < 0.5) return;
      const col = area.querySelector('.cal-col');
      const f0 = parseFloat(area.dataset.from); const from = (isNaN(f0) ? WEEK_FROM : f0) * 60;
      const top0 = col ? col.getBoundingClientRect().top : 0;
      const minute = from + (clientY - top0) / HOUR_PX * 60;
      HOUR_PX = px; setHourVar();
      renderCalendar(0);
      const col2 = area.querySelector('.cal-col');
      if (col2) { const target = col2.getBoundingClientRect().top + (minute - from) / 60 * HOUR_PX; const sc = scroller(); sc.scrollTop += target - clientY; }
      try { ls.set('bandCalZoom', String(Math.round(HOUR_PX))); } catch (e) {}
      tip.textContent = 'Zoom ' + Math.round(HOUR_PX / 40 * 100) + ' %';
      tip.classList.add('show'); clearTimeout(tipT); tipT = setTimeout(() => tip.classList.remove('show'), 900);
    }
    const queue = (px, y) => { pending = [px, y]; if (!raf) raf = requestAnimationFrame(() => { raf = 0; const [a, b] = pending; applyZoom(a, b); }); };
    area.addEventListener('calzoom', e => applyZoom(e.detail.px, e.detail.y));
    // Shift + Mausrad (manche Systeme liefern dabei deltaX statt deltaY)
    area.addEventListener('wheel', e => {
      if (!e.shiftKey || !zoomable()) return;
      e.preventDefault();
      const d = e.deltaY || e.deltaX; if (!d) return;
      const base = pending && raf ? pending[0] : HOUR_PX;
      queue(base * Math.pow(1.0015, -d), e.clientY);
    }, { passive: false });
    // Zwei Finger auseinander/zusammen (Mobile)
    let pinch = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    area.addEventListener('touchstart', e => {
      if (e.touches.length === 2 && zoomable()) {
        const t = e.touches;
        const col = area.querySelector('.cal-week .cal-col');
        pinch = { dx0: Math.abs(t[0].clientX - t[1].clientX), dy0: Math.abs(t[0].clientY - t[1].clientY), d0: dist(t), px0: HOUR_PX, w0: col ? col.offsetWidth : null };
        window.calPinching = true;
      }
    }, { passive: true });
    area.addEventListener('touchmove', e => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const t = e.touches;
      const y = (t[0].clientY + t[1].clientY) / 2;
      const dx = Math.abs(t[0].clientX - t[1].clientX), dy = Math.abs(t[0].clientY - t[1].clientY);
      // senkrecht auseinander = Stunden höher; waagrecht auseinander = Wochentage breiter (nur Woche)
      const vert = pinch.dy0 > 30 ? dy / pinch.dy0 : (pinch.dx0 > 30 && calView !== 'week' ? dx / pinch.dx0 : 1);
      if (Math.abs(vert - 1) > 0.02) queue(pinch.px0 * vert, y);
      if (calView === 'week' && pinch.w0 && pinch.dx0 > 30) {
        WCOL = Math.max(20, Math.min(400, pinch.w0 * dx / pinch.dx0)); setWcolVar();
        try { ls.set('bandCalWcol', String(Math.round(WCOL))); } catch (e2) {}
      }
    }, { passive: false });
    const endPinch = e => { if (pinch && e.touches.length < 2) { pinch = null; setTimeout(() => { window.calPinching = false; }, 300); } };
    area.addEventListener('touchend', endPinch);
    area.addEventListener('touchcancel', endPinch);
  })();


  // ----- Zoom-Knöpfe −/+ (Tag und Woche) -----
  (() => {
    const center = () => { const vp = $('calBody').getBoundingClientRect(); return Math.max(vp.top, 0) + Math.min(vp.height, window.innerHeight) / 2; };
    const step = f => {
      const want = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, HOUR_PX * f));
      // gleiche Logik wie beim Mausrad: Uhrzeit in der Mitte bleibt stehen
      $('calBody').dispatchEvent(new CustomEvent('calzoom', { detail: { px: want, y: center() } }));
      if (calView === 'week' && WCOL) { WCOL = Math.max(20, Math.min(400, WCOL * f)); setWcolVar(); try { ls.set('bandCalWcol', String(Math.round(WCOL))); } catch (e) {} }
    };
    $('czIn').addEventListener('click', () => step(1.25));
    $('czOut').addEventListener('click', () => step(0.8));
    $('czVal').addEventListener('click', () => {
      WCOL = null; setWcolVar(); try { ls.set('bandCalWcol', ''); } catch (e) {}
      $('calBody').dispatchEvent(new CustomEvent('calzoom', { detail: { px: 40, y: center() } }));
    });
  })();

  // ----- Ansichtswahl (Tag/Woche/Monat/Jahr) als Schieberegler -----
  function placeViewInd(x) {
    const box = $('calViews'), ind = box && box.querySelector('.cv-ind'); if (!ind) return;
    const on = box.querySelector('button.on'); if (!on) return;
    if (typeof x === 'number') { ind.style.left = x + 'px'; return; }
    ind.style.left = on.offsetLeft + 'px'; ind.style.width = on.offsetWidth + 'px';
  }
  window.addEventListener('resize', () => placeViewInd());
  (() => {
    const box = $('calViews'); if (!box) return;
    let st = null;
    const btns = () => [...box.querySelectorAll('button')];
    box.addEventListener('pointerdown', e => {
      const on = box.querySelector('button.on'); if (!on) return;
      st = { id: e.pointerId, x0: e.clientX, left0: on.offsetLeft, moved: false };
    });
    window.addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x0;
      if (!st.moved && Math.abs(dx) < 8) return;
      st.moved = true; box.classList.add('dragging');
      const ind = box.querySelector('.cv-ind');
      const max = box.clientWidth - ind.offsetWidth - 3;
      placeViewInd(Math.max(3, Math.min(max, st.left0 + dx)));
    });
    const end = e => {
      if (!st || (e && e.pointerId !== st.id)) return;
      const moved = st.moved; st = null; box.classList.remove('dragging');
      if (!moved) return;
      // nächstgelegene Ansicht unter der Markierung wählen
      const ind = box.querySelector('.cv-ind');
      const mid = ind.offsetLeft + ind.offsetWidth / 2;
      let best = null, bd = 1e9;
      btns().forEach(b => { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = b; } });
      const suppress = ev => { ev.stopPropagation(); ev.preventDefault(); };
      box.addEventListener('click', suppress, { capture: true, once: true }); setTimeout(() => box.removeEventListener('click', suppress, { capture: true }), 0);
      if (best && best.dataset.view !== calView) calSetView(best.dataset.view, calView === 'year' && best.dataset.view !== 'year' ? calSel : null);
      else placeViewInd();
    };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  })();

  // ================= Gigs (Seite 3) =================
  const gigsOpen = new Set();
  let gigsShowPast = false;
  const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  function refreshEventViews() {
    if (currentPage === 'page2') renderCalendar(0);
    if (currentPage === 'page3') renderGigs();
    if (currentPage === 'page4') renderChecklistPage();
    if (currentPage === 'overview') renderOverview();
  }
  function relDays(d) {
    const diff = Math.round((dOnly(d) - dOnly(new Date())) / 86400000);
    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    if (diff === -1) return 'Gestern';
    if (diff > 1) return `in ${diff} Tagen`;
    return `vor ${-diff} Tagen`;
  }
  // Dokumente-Abschnitt offen halten, wenn er gerade benutzt wurde
  const gigDocsOpenKeys = new Set();
  function gigDocsOpen(body) {
    const d = body.querySelectorAll('details.gsec'); const last = d[d.length - 1];
    if (!last) return;
    const k = body.dataset.key;
    if (gigDocsOpenKeys.has(k)) last.open = true;
    last.addEventListener('toggle', () => { if (last.open) gigDocsOpenKeys.add(k); else gigDocsOpenKeys.delete(k); });
  }
  // ================= Checkliste (Gigs) =================
  // Gespeichert im Termin: checklists[<Datum>] = [{ id, title, items: [{ id, title, members: [uid], done }] }]
  let gigMembers = [], gigMembersBand = null, gigMembersLoading = false;
  const clpOpen = new Set();     // aufgeklappte Einträge auf der Seite „Checkliste“
  let clpShowPast = false;
  const clClosed = new Set();    // zugeklappte Reiter
  let clEdit = null;             // gerade bearbeitetes Element
  const CL_DENIED = 'Keine Berechtigung: Du kannst nur Reiter und Unterreiter bearbeiten und entfernen, die du selbst erstellt hast. Alle anderen dürfen der Admin und die Organisation ändern.';
  const CL_MEMBER_DENIED = 'Keine Berechtigung: Du kannst nur dich selbst eintragen oder austragen. Andere Mitglieder eintragen und entfernen dürfen der Admin und die Organisation.';
  const CL_READ = 'Keine Berechtigung: Du hast für die Checkliste nur Leserechte. Bitte den Admin, dir das Recht „Bearbeiten“ für die Checkliste zu geben.';
  const CL_DONE_DENIED = 'Keine Berechtigung: Abhaken dürfen nur eingetragene Personen, wer den Eintrag erstellt hat, der Admin und die Organisation.';
  const clId = () => Math.random().toString(36).slice(2, 10);
  async function ensureGigMembers() {
    if (gigMembersBand === currentBand || gigMembersLoading) return;
    gigMembersLoading = true;
    const band = currentBand;
    try { gigMembers = (await loadMembers(band)).filter(m => isActiveIn(m, band, bands[band].cfg)); } catch (e) { gigMembers = []; }
    gigMembersBand = band; gigMembersLoading = false;
    if (currentBand === band) refreshEventViews();
  }
  // Noch nicht registrierte Mitglieder (vom Admin angelegt) werden als „e:<Eintrag>“ gespeichert
  function clOpenEntries() {
    const b = bands[currentBand]; if (!b) return [];
    const claimed = new Set(gigMembers.map(m => m.memberships && m.memberships[currentBand] && m.memberships[currentBand].entry).filter(Boolean));
    return Object.entries(b.cfg.extra || {}).filter(([id]) => !claimed.has(id)).map(([id, e]) => ({ uid: 'e:' + id, name: e.name || 'Unbekannt', pending: true }));
  }
  // Alle, die man zuweisen kann: registrierte Mitglieder + offene Einträge
  const clPeople = () => [...gigMembers.map(m => ({ uid: m.uid, name: m.name || 'Unbekannt' })), ...clOpenEntries()].sort((a, b) => a.name.localeCompare(b.name));
  const clName = u => {
    if (typeof u === 'string' && u.startsWith('e:')) { const e = bands[currentBand] && bands[currentBand].cfg.extra[u.slice(2)]; if (e) return e.name || 'Unbekannt'; }
    const m = gigMembers.find(x => x.uid === u) || (u === uid ? profile : null); return m ? (m.name || 'Unbekannt') : 'Ehemaliges Mitglied';
  };
  let clMenu = null;   // offenes Zuweisungs-Menü
  const clLocked = u => photoLocked(gigMembers.find(x => x.uid === u));
  const clPhoto = u => { const m = gigMembers.find(x => x.uid === u) || (u === uid ? profile : null); return m && typeof m.photo === 'string' && m.photo.startsWith('data:image/') ? m.photo : null; };
  // Änderung frisch aus der Datenbank lesen, anpassen und speichern (damit gleichzeitige Änderungen nicht verloren gehen)
  async function clMutate(evId, dk, fn) {
    const ref = db.collection(`calendar/${currentBand}/events`).doc(evId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Der Gig existiert nicht mehr.');
    const data = snap.data();
    const all = data.checklists && typeof data.checklists === 'object' ? clone(data.checklists) : {};
    const list = Array.isArray(all[dk]) ? all[dk] : [];
    if (fn(list) === false) return false;
    all[dk] = list;
    await ref.set({ ...data, checklists: all });
    await reloadEventsOnce();
    return true;
  }
  // ----- Eigene Reihenfolge (nur für mich, im eigenen Profil gespeichert) -----
  function clOrdered(arr, order) {
    if (!Array.isArray(order) || !order.length) return arr;
    const rank = id => { const i = order.indexOf(id); return i < 0 ? 1e6 : i; };
    return arr.map((x, i) => [x, i]).sort((a, b) => rank(a[0].id) - rank(b[0].id) || a[1] - b[1]).map(x => x[0]);
  }
  async function clSaveOrder(okey, part, ids) {
    if (!profile) return;
    profile.clOrder = profile.clOrder && typeof profile.clOrder === 'object' ? profile.clOrder : {};
    const o = profile.clOrder[okey] = profile.clOrder[okey] || {};
    if (part === 'r') o.r = ids; else { o.i = o.i || {}; o.i[part] = ids; }
    if (readOnly) return;
    try { await db.doc('members/' + uid).set(clone(profile)); } catch (e) { flash('Reihenfolge konnte nicht gespeichert werden', true); }
  }
  // Ziehen wie bei den Registerkarten: Element packen, es folgt dem Zeiger, Nachbarn weichen aus.
  // Maus: nach kurzer Bewegung. Touch: lange drücken (damit normales Scrollen weiter geht).
  function clMakeDraggable(item, grip, container, selector, onDrop) {
    if (clSortMode() !== 'manual') return;   // Verschieben nur bei „Manuell“ – sonst ausgeblendet
    let st = null;
    const sibs = () => [...container.children].filter(c => c.matches(selector));
    const NO = 'input, button, select, textarea, a, label, .cl-menu, .cl-form';
    const activate = () => {
      if (clSortMode() !== 'manual') { previewBlocked(null, clSortLocked()); cleanup(); return; }
      if (viewAs) { previewBlocked(); cleanup(); return; }
      st.active = true;
      st.before = sibs().map(c => c.dataset.cid).join();
      st.top0 = item.offsetTop; st.offset = 0;
      item.classList.add('cl-lifted'); container.classList.add('cl-sorting');
      document.body.classList.add('cl-grabbing');
      if (navigator.vibrate && st.touch) try { navigator.vibrate(15); } catch (e) {}
    };
    const flip = (node, fn) => { const r0 = node.getBoundingClientRect().top; fn(); const d = r0 - node.getBoundingClientRect().top;
      if (!d) return; node.style.transition = 'none'; node.style.transform = `translateY(${d}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { node.style.transition = ''; node.style.transform = ''; })); };
    const move = e => {
      if (!st || e.pointerId !== st.id) return;
      const dy = e.clientY - st.y0;
      if (!st.active) {
        if (st.touch) { if (Math.abs(dy) > 8 || Math.abs(e.clientX - st.x0) > 8) cleanup(); return; }
        if (Math.abs(dy) < 6) return;
        activate(); if (!st) return;
      }
      e.preventDefault();
      const list = sibs(); const i = list.indexOf(item);
      const prev = list[i - 1], next = list[i + 1];
      let y = dy - st.offset;
      if (prev && y < -prev.offsetHeight / 2) { flip(prev, () => container.insertBefore(item, prev)); }
      else if (next && y > next.offsetHeight / 2) { flip(next, () => container.insertBefore(next, item)); }
      st.offset = item.offsetTop - st.top0;
      y = dy - st.offset;
      item.style.transform = `translateY(${y}px) scale(1.015)`;
    };
    const blockTouch = e => { if (st && st.active) e.preventDefault(); };
    const cleanup = () => {
      if (!st) return;
      clearTimeout(st.timer);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', blockTouch);
      st = null;
    };
    const up = e => {
      if (!st || (e && e.pointerId !== st.id)) return;
      const was = st.active, before = st.before;
      cleanup();
      if (!was) return;
      // ruhig an den neuen Platz gleiten
      item.style.transition = 'transform .16s ease, box-shadow .16s ease';
      item.style.transform = '';
      setTimeout(() => { item.style.transition = ''; item.classList.remove('cl-lifted'); }, 170);
      container.classList.remove('cl-sorting'); document.body.classList.remove('cl-grabbing');
      // den Klick nach dem Loslassen nicht als Auf-/Zuklappen werten
      const stop = ev => { ev.preventDefault(); ev.stopPropagation(); };
      item.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => item.removeEventListener('click', stop, { capture: true }), 0);
      const ids = sibs().map(c => c.dataset.cid);
      if (ids.join() !== before) { onDrop(ids); flash('Reihenfolge gespeichert (nur für dich)'); }
    };
    grip.addEventListener('pointerdown', e => {
      if (e.button > 0 || st || e.target.closest(NO)) return;
      st = { id: e.pointerId, y0: e.clientY, x0: e.clientX, active: false, touch: e.pointerType === 'touch' };
      window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      window.addEventListener('touchmove', blockTouch, { passive: false });
      if (st.touch) st.timer = setTimeout(() => { if (st && !st.active) activate(); }, 350);
    });
    grip.classList.add('cl-grip');
    if (!grip.title) grip.title = 'Packen und ziehen zum Verschieben (nur für dich)';
  }
  // ----- Sortierung der Checkliste (Einstellungen, pro Person) -----
  const CL_SORTS = [
    { id: 'personal', icon: '🙋', title: 'Persönlicher Status', text: 'Checklisten und Reiter, bei denen du noch etwas offen hast, zuerst – dann offene, erledigte zuletzt.' },
    { id: 'band', icon: '📊', title: 'Bandstatus', text: 'Am wenigsten erledigte Checklisten und Reiter zuerst, erledigte zuletzt.' },
    { id: 'date', icon: '🕒', title: 'Termin', text: 'Checklisten nach den kommenden Terminen – der nächste zuerst. Reiter in der Reihenfolge, wie sie erstellt wurden.' },
    { id: 'alpha', icon: '🔤', title: 'Alphabet', text: 'Checklisten, Reiter und Unterreiter von A bis Z.' },
    { id: 'manual', icon: '✋', title: 'Manuell', text: 'Checklisten nach den kommenden Terminen, Reiter und Unterreiter in deiner eigenen Reihenfolge (packen und verschieben).' },
  ];
  const validSort = m => CL_SORTS.some(x => x.id === m);
  const clSortGlobal = () => (profile && validSort(profile.clSort)) ? profile.clSort : 'manual';
  // Band-Sortierung: { mode, at }. Sie gilt nur, wenn sie später gesetzt wurde als die allgemeine Einstellung.
  const bandSortEntry = id => { const v = profile && profile.clSortBand && profile.clSortBand[id]; if (!v) return null; return typeof v === 'string' ? { mode: v, at: '' } : v; };
  const clSortBandOverride = (id = currentBand) => { const e = bandSortEntry(id); return e && validSort(e.mode) && (e.at || '') > (profile.clSortAt || '') ? e.mode : null; };
  // Eigene Einstellung für diese Band hat Vorrang vor der allgemeinen (bandübergreifenden)
  const clSortMode = () => clSortBandOverride() || clSortGlobal();
  const clSortName = () => CL_SORTS.find(x => x.id === clSortMode()).title;
  const clSortLocked = () => `Verschieben gesperrt: Es ist „Sortieren nach: ${clSortName()}“ gewählt. Wähle „Manuell“ (oben über „⇅“ oder in den Einstellungen), um Reiter und Unterreiter selbst zu verschieben.`;
  // ----- Einstellungen: Änderungen erst mit „Speichern“ übernehmen (wie in der Verwaltung) -----
  function settingsDraft() {
    if (!setDraft) { const oc = ovCfg(); setDraft = { cursor: cursorPref, theme: themePref, clSort: clSortGlobal(), clearBands: [], share: shareState(), clock: { time: oc.time, face: oc.face, date: oc.date }, photoPublic: !(profile && profile.photoPublic === false) }; }
    return setDraft;
  }
  // Sichtbarkeit von E-Mail/Telefon pro Band (gespeichert im eigenen Profil unter memberships[band].share)
  function shareState() {
    const out = {};
    bandIdsOf(profile).forEach(id => { const sh = (profile.memberships && profile.memberships[id] && profile.memberships[id].share) || {}; out[id] = { email: !!sh.email, phone: !!sh.phone }; });
    return out;
  }
  const isSettingsDirty = () => !!setDraft && (setDraft.cursor !== cursorPref || setDraft.theme !== themePref || setDraft.clSort !== clSortGlobal() || setDraft.clearBands.length > 0 || JSON.stringify(setDraft.share) !== JSON.stringify(shareState()) || clockChanged(setDraft) || setDraft.photoPublic !== !(profile && profile.photoPublic === false));
  const clockChanged = d => { const oc = ovCfg(); return !!d.clock && (d.clock.time !== oc.time || d.clock.face !== oc.face || d.clock.date !== oc.date); };
  // ================= Vorschau per Glühbirne =================
  const pvPop = el('div', 'pv-pop hidden'); document.body.appendChild(pvPop);
  let pvFor = null, pvHideT = null;
  const pvHide = () => { pvPop.classList.add('hidden'); pvFor = null; };
  function bulb(build, title) {
    const b = el('button', 'pv-bulb', '💡'); b.type = 'button';
    b.title = 'Vorschau: ' + title; b.setAttribute('aria-label', b.title);
    const show = () => {
      clearTimeout(pvHideT);
      pvFor = b; pvPop.innerHTML = '';
      pvPop.append(el('div', 'pv-t', '💡 ' + title), build());
      pvPop.classList.remove('hidden');
      const r = b.getBoundingClientRect(), w = pvPop.offsetWidth, h = pvPop.offsetHeight;
      let left = Math.min(Math.max(8, r.left - 10), innerWidth - w - 8), top = r.bottom + 8;
      if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
      pvPop.style.left = left + 'px'; pvPop.style.top = top + 'px';
    };
    b.addEventListener('mouseenter', show);
    b.addEventListener('mouseleave', () => { pvHideT = setTimeout(() => { if (!pvPop.matches(':hover')) pvHide(); }, 180); });
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (pvFor === b && !pvPop.classList.contains('hidden')) pvHide(); else show(); });
    return b;
  }
  pvPop.addEventListener('mouseleave', () => { pvHideT = setTimeout(pvHide, 180); });
  document.addEventListener('click', e => { if (!pvPop.contains(e.target)) pvHide(); });
  window.addEventListener('scroll', pvHide, true);
  const pvLcd = (txt, cls) => { const b = el('div', 'sc-box ' + (cls || '')); b.textContent = txt; return b; };
  const pvCol = (...kids) => { const c = el('div', 'pv-col'); c.append(...kids); return c; };
  const pvCap = t => el('div', 'pv-cap', t);
  const PV = {
    theme() {
      const pref = (setDraft && setDraft.theme) || themePref;
      const dark = pref === 'dark' || (pref === 'system' && darkMq && darkMq.matches);
      const m = el('div', 'pv-mini' + (dark ? ' dark' : ''));
      m.append(el('div', 'pm-side'), (() => { const c = el('div', 'pm-main'); c.append(el('div', 'pm-bar'), el('div', 'pm-card'), el('div', 'pm-card short')); return c; })());
      return pvCol(m, pvCap(pref === 'system' ? 'Automatisch – gerade ' + (dark ? 'dunkel' : 'hell') : dark ? 'Dunkel' : 'Hell'));
    },
    cursor() {
      const cur = (setDraft && setDraft.cursor) || cursorPref, o = CURSORS.find(x => x.id === cur) || CURSORS[0];
      const ic = el('div', 'pv-cursor'); ic.innerHTML = CURSOR_ICONS[o.id] || handIcon(o.emoji);
      return pvCol(ic, pvCap(o.label));
    },
    time() { const d = settingsDraft().clock, now = new Date(); return pvCol(pvLcd(fmtTimeOv(now, d.time, true), 'sc-time'), pvCap(d.time === '12' ? '12 Stunden' : '24 Stunden')); },
    face() {
      const d = settingsDraft().clock, now = new Date();
      const t = pvLcd('', 'sc-time' + (d.face === 'analog' ? ' analog' : ''));
      if (d.face === 'analog') t.innerHTML = analogSvg(now); else t.textContent = fmtTimeOv(now, d.time, true);
      const box = el('div', 'side-clock stacked pv-side'); box.append(t, pvLcd(fmtDateOv(now, d.date), 'sc-date'));
      return pvCol(box, pvCap('So erscheint es oben links'));
    },
    date() { const d = settingsDraft().clock; return pvCol(pvLcd(fmtDateOv(new Date(), d.date), 'sc-date'), pvCap(DATE_FMTS.find(x => x.id === d.date).label)); },
    photo() {
      const on = settingsDraft().photoPublic;
      const a = el('div', 'avatar'); setAvatar(a, profile.name, profile.photo, { zoom: false, locked: !on });
      return pvCol(a, pvCap(on ? 'Andere sehen dein Profilbild' : 'Andere sehen es verschwommen mit Schloss'));
    },
    share() {
      const sh = settingsDraft().share, id = bandIdsOf(profile)[0], x = (id && sh[id]) || {};
      const c = el('div', 'pv-card'); c.append(el('b', null, profile.name), el('div', null, '✉️ ' + (x.email ? (profile.email || 'deine E-Mail') : 'verborgen')), el('div', null, '📞 ' + (x.phone ? (profile.phone || 'deine Nummer') : 'verborgen')));
      return pvCol(c, pvCap(id ? 'So sehen dich die Mitglieder von „' + bands[id].name + '“' : 'Du bist in keiner Band'));
    },
    brand() {
      const b = bands[currentBand], sh = draftShow || showOf(b), lg = b && (draft ? draft.logo : b.cfg.logo);
      const box = el('div', 'pv-brand');
      const logo = el('span', 'brand-logo' + (lg ? ' custom' : '') + (lg && !sh.logo ? ' img-locked' : ''));
      logo.appendChild(lg ? logoNode(lg) : defaultLogo());
      const nm = el('div', 'brand-name'); if (sh.name) nm.append(draftName || b.name); if (sh.tag && draftTag) nm.append(tagChip(draftTag));
      const tx = el('div', 'brand-text'); tx.append(nm, el('div', 'brand-sub', 'Band-Verwaltung'));
      box.append(logo, tx);
      return pvCol(box, pvCap('So sehen es die Mitglieder (ohne Admin/Organisation)'));
    },
    tag() { const t = draftTag || regTag; const c = el('div', 'pv-card'); const n = el('b'); n.append('Housi'); if (t) n.append(tagChip(t)); c.append(n); return pvCol(c, pvCap(t ? 'Tag neben Nickname und Bandname: ' + fmtTag(t) : 'Noch kein Tag gewählt')); },
  };
  function addBulb(target, key, title) { if (!target || target.querySelector(':scope > .pv-bulb')) return; target.appendChild(bulb(PV[key], title)); }

  // Einstellungen „Uhr & Datum“ (gilt für die Übersicht und alle Zeitangaben dort)
  function renderClockSettings() {
    const box = $('clockSettings'); if (!box || !profile) return;
    box.innerHTML = '';
    const d = settingsDraft().clock;
    const seg = (label, opts, key) => {
      const f = el('div', 'field');
      const lb = el('label', null, label); lb.appendChild(bulb(PV[key === 'time' ? 'time' : 'face'], label)); f.appendChild(lb);
      const g = el('div', 'seg ovm-seg set-seg');
      opts.forEach(([v, t]) => { const b = el('button', d[key] === v ? 'on' : '', t); b.type = 'button'; b.addEventListener('click', () => { d[key] = v; renderClockSettings(); updateDirty(); }); g.appendChild(b); });
      f.appendChild(g); box.appendChild(f);
    };
    seg('Zeitformat', [['24', '24 Stunden (20:00)'], ['12', '12 Stunden (8:00 PM)']], 'time');
    seg('Uhr', [['digital', 'Digital'], ['analog', 'Analog']], 'face');
    const f = el('div', 'field'); const l = el('label', null, 'Datumsformat'); l.htmlFor = 'setDateFmt'; l.appendChild(bulb(PV.date, 'Datumsformat'));
    const sel = el('select'); sel.id = 'setDateFmt';
    DATE_FMTS.forEach(x => sel.appendChild(new Option(`${x.label}  (${fmtDateOv(new Date(), x.id)})`, x.id)));
    sel.value = d.date;
    sel.addEventListener('change', () => { d.date = sel.value; updateDirty(); });
    f.append(l, sel); box.appendChild(f);
    box.appendChild(el('div', 'note-info clock-tz', `Zeitzone: ${tzName()} (${tzOffset()}) – vom Gerät übernommen.` + (ovLoc ? ` Standort: ${locText()}.` : '')));
  }
  function renderSettingsAll() { renderSortOptions(); renderShareSettings(); renderClockSettings(); renderCursorOptions(); renderVis(); }
  // Sichtbarkeit: Profilbild + Hinweis/Knopf zur Bandsichtbarkeit (nur auf einer Bandseite)
  function renderVis() {
    if (!profile) return;
    addBulb($('setPhotoPublic').closest('.share-row'), 'photo', 'Profilbild');
    addBulb(document.querySelector('#visPanel > .share-title'), 'share', 'E-Mail und Telefon');
    $('setPhotoPublic').checked = settingsDraft().photoPublic;
    $('visToTeam').classList.toggle('hidden', inHub || !currentBand);
  }
  $('setPhotoPublic').addEventListener('change', () => { settingsDraft().photoPublic = $('setPhotoPublic').checked; updateDirty(); });
  $('visToTeam').addEventListener('click', () => {
    if (!isAdmin(currentBand)) return flash('Die Sichtbarkeit der Band kann nur der Admin unter „Verwaltung → Band“ ändern.', true);
    showPage('team');
    const p = $('bandNamePanel'); p.classList.remove('folded');
    setTimeout(() => p.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  });
  function goVisibility() {
    if (inHub) return openHubSection('settings', $('visPanel'));
    showPage('settings');
    const p = $('visPanel'); p.classList.remove('folded');
    setTimeout(() => p.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  $('pfToVis').addEventListener('click', goVisibility);
  function renderShareSettings() {
    const box = $('shareSettings'); if (!box || !profile) return;
    box.innerHTML = '';
    const d = settingsDraft().share;
    const ids = bandIdsOf(profile);
    if (!ids.length) { box.appendChild(el('div', 'mnote', 'Du bist noch in keiner Band.')); return; }
    ids.forEach(id => {
      const card = el('div', 'band-card');
      const head = el('div', 'band-card-head');
      head.append(el('span', 'bname', bands[id].name));
      card.append(head);
      const vis = el('div', 'share-rows');
      vis.append(el('div', 'share-title', 'Für die Mitglieder dieser Band sichtbar:'));
      [['email', 'E-Mail'], ['phone', 'Telefon']].forEach(([k, label]) => {
        const row = el('label', 'share-row');
        const sw = el('span', 'switch');
        const inp = el('input'); inp.type = 'checkbox'; inp.checked = !!(d[id] && d[id][k]);
        inp.addEventListener('change', () => { d[id] = d[id] || { email: false, phone: false }; d[id][k] = inp.checked; updateDirty(); });
        sw.append(inp, el('span'));
        const has = k === 'email' ? profile.email : profile.phone;
        row.append(sw, el('span', null, label), has ? '' : el('small', 'share-none', '(keine hinterlegt)'));
        vis.appendChild(row);
      });
      card.append(vis);
      box.appendChild(card);
    });
  }
  async function saveSettings() {
    if (!isSettingsDirty()) return;
    const d = setDraft;
    themePref = d.theme; ls.set('bandTheme', themePref);
    cursorPref = d.cursor || cursorPref; ls.set('bandCursor', cursorPref);
    let profChanged = false;
    if (profile && d.clSort !== clSortGlobal()) {
      profile.clSort = d.clSort;
      profile.clSortAt = new Date().toISOString();   // gilt jetzt überall – bis eine Band später eine eigene bekommt
      profChanged = true;
    }
    if (profile && JSON.stringify(d.share) !== JSON.stringify(shareState())) {
      profile.memberships = { ...(profile.memberships || {}) };
      Object.entries(d.share).forEach(([id, sh]) => { if (profile.memberships[id]) profile.memberships[id] = { ...profile.memberships[id], share: { email: !!sh.email, phone: !!sh.phone } }; });
      profChanged = true;
    }
    if (profile && clockChanged(d)) { profile.overview = { ...ovCfg(), ...d.clock }; profChanged = true; }
    if (profile && d.photoPublic !== (profile.photoPublic !== false)) { profile.photoPublic = d.photoPublic; profChanged = true; }
    if (profile && d.clearBands.length) { profile.clSortBand = { ...(profile.clSortBand || {}) }; d.clearBands.forEach(id => delete profile.clSortBand[id]); profChanged = true; }
    setDraft = null;
    applyTheme(); applyCursor(); updateDirty();
    if (currentPage === 'settings' || currentPage === 'home') renderSettingsAll();
    setMsg($('setMsg'), '');
    if (profChanged) await saveProfileQuiet();
    flash('Einstellungen gespeichert ✓');
  }
  function discardSettings() {
    setDraft = null; applyTheme(); applyCursor();
    if (currentPage === 'settings' || currentPage === 'home') renderSettingsAll();
    updateDirty();
  }
  $('setSave').addEventListener('click', () => saveSettings());
  function renderSortOptions() {
    const box = $('clSortOptions'); if (!box) return;
    box.innerHTML = '';
    CL_SORTS.forEach(o => {
      const b = el('button', 'sort-opt' + (settingsDraft().clSort === o.id ? ' on' : '')); b.type = 'button';
      const txt = el('span', 'so-text'); txt.append(el('span', 'so-t', o.title), el('span', 'so-d', o.text));
      b.append(el('span', 'so-radio'), el('span', 'so-ic', o.icon), txt);
      b.addEventListener('click', () => {
        if (!profile) return;
        settingsDraft().clSort = o.id;   // erst mit „Speichern“ übernehmen
        renderSortOptions(); updateDirty();
      });
      box.appendChild(b);
    });
    // Hinweis auf Bands mit eigener Sortierung
    const over = Object.keys((profile && profile.clSortBand) || {}).filter(id => bands[id] && bandIdsOf(profile).includes(id) && clSortBandOverride(id) && !settingsDraft().clearBands.includes(id)).map(id => [id, clSortBandOverride(id)]);
    if (over.length) {
      const n = el('div', 'note-info sort-over');
      n.append('Eigene Sortierung in: ');
      over.forEach(([id, m], i) => {
        if (i) n.append(', ');
        n.append(el('strong', null, bands[id].name), ' (' + CL_SORTS.find(x => x.id === m).title + ') ');
        const x = el('button', 'linkish-btn', 'zurücksetzen'); x.type = 'button';
        x.addEventListener('click', () => { settingsDraft().clearBands.push(id); renderSortOptions(); updateDirty(); });
        n.appendChild(x);
      });
      n.append(' – dort gilt diese, weil sie später gewählt wurde. Speicherst du hier eine neue Wahl, gilt sie wieder für alle Bands.');
      box.appendChild(n);
    }
  }
  async function saveProfileQuiet() {
    if (readOnly || !profile) return;
    try { await db.doc('members/' + uid).set(clone(profile)); } catch (e) { flash('Einstellung konnte nicht gespeichert werden', true); }
    if (currentPage === 'page4') renderChecklistPage();
  }
  // Menü in der Registerkarte „Checkliste“: gleiche Auswahl, wahlweise nur für diese Band oder für alle
  let sortPick = null;
  function renderSortMenu() {
    const m = $('clpSortMenu'); m.innerHTML = '';
    const band = bands[currentBand];
    m.appendChild(el('div', 'csm-head', 'Checkliste sortieren'));
    CL_SORTS.forEach(o => {
      const b = el('button', 'csm-opt' + (sortPick === o.id ? ' on' : '')); b.type = 'button';
      b.append(el('span', 'so-radio'), el('span', 'so-ic', o.icon), el('span', 'so-t', o.title));
      b.title = o.text;
      b.addEventListener('click', e => { e.stopPropagation(); sortPick = o.id; renderSortMenu(); });
      m.appendChild(b);
    });
    const over = clSortBandOverride();
    m.appendChild(el('div', 'csm-note', over ? `In „${band.name}“ gilt eine eigene Sortierung.` : 'Aktuell gilt hier die allgemeine Sortierung aus den Einstellungen.'));
    const acts = el('div', 'csm-acts');
    const one = el('button', 'btn small', `Auf „${band.name}“ anwenden`); one.type = 'button';
    const all = el('button', 'btn small ghost', 'Auf alle Bands anwenden'); all.type = 'button';
    const single = bandIdsOf(profile).length <= 1;
    if (single) { all.disabled = true; all.classList.add('csm-off'); all.title = 'Du bist nur in einer Band'; }
    one.addEventListener('click', async e => {
      e.stopPropagation();
      profile.clSortBand = profile.clSortBand && typeof profile.clSortBand === 'object' ? profile.clSortBand : {};
      profile.clSortBand[currentBand] = { mode: sortPick, at: new Date().toISOString() };
      closeSortMenu(); flash(`Sortierung für „${band.name}“: ${CL_SORTS.find(x => x.id === sortPick).title}`);
      renderChecklistPage(); await saveProfileQuiet();
    });
    all.addEventListener('click', async e => {
      e.stopPropagation();
      profile.clSort = sortPick;
      profile.clSortAt = new Date().toISOString();   // gilt überall – frühere Band-Sortierungen treten zurück
      closeSortMenu(); flash('Sortierung für alle Bands: ' + CL_SORTS.find(x => x.id === sortPick).title);
      renderChecklistPage(); await saveProfileQuiet();
    });
    acts.append(one, all);
    if (single) {
      // Nur eine Band: Weg zu „Deine Bands“, um eine weitere hinzuzufügen
      acts.appendChild(el('div', 'csm-single', 'Du bist nur in einer Band. Auf dem Startbildschirm kannst du einer weiteren beitreten oder eine gründen.'));
      const go = el('button', 'btn small ghost csm-bands', '🎸 Zu deinen Bands →'); go.type = 'button';
      go.addEventListener('click', e => { e.stopPropagation(); closeSortMenu(); showAddBand(); });
      acts.appendChild(go);
    }
    m.appendChild(acts);
    const link = el('button', 'linkish-btn csm-link', 'Zu den Einstellungen'); link.type = 'button';
    link.addEventListener('click', e => { e.stopPropagation(); closeSortMenu(); showPage('settings'); });
    m.appendChild(link);
  }
  // „Band beitreten oder gründen“ als Fenster öffnen
  function showAddBand() { hubAddBandMode('join'); }
  function closeSortMenu() { $('clpSortMenu').classList.add('hidden'); }
  $('clpSortMenu').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => closeSortMenu());
  // Reiter/Unterreiter nach Einstellung ordnen
  function clSorted(arr, kind, ctx) {
    const mode = clSortMode();
    if (mode === 'manual') return clOrdered(arr, ctx.manual);
    const idx = new Map(arr.map((x, i) => [x.id, i]));
    const byIdx = (a, b) => idx.get(a.id) - idx.get(b.id);
    if (mode === 'date') return arr.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || byIdx(a, b));
    if (mode === 'alpha') return arr.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de', { sensitivity: 'base' }) || byIdx(a, b));
    const items = x => Array.isArray(x.items) ? x.items : [];
    const isDone = x => kind === 'r' ? (items(x).length ? items(x).every(i => i.done) : !!x.done) : !!x.done;
    const share = x => kind === 'r' && items(x).length ? items(x).filter(i => i.done).length / items(x).length : (x.done ? 1 : 0);
    const me = actorUid();
    const isMine = x => !!me && ((x.members || []).includes(me) || (kind === 'r' && items(x).some(i => !i.done && (i.members || []).includes(me))));
    if (mode === 'personal') {
      const rank = x => isDone(x) ? 2 : (isMine(x) ? 0 : 1);
      return arr.slice().sort((a, b) => rank(a) - rank(b) || byIdx(a, b));
    }
    // Bandstatus
    return arr.slice().sort((a, b) => isDone(a) - isDone(b) || share(a) - share(b) || byIdx(a, b));
  }
  $('clpSortInfo').addEventListener('click', e => {
    e.stopPropagation();
    const m = $('clpSortMenu');
    if (!m.classList.contains('hidden')) return closeSortMenu();
    sortPick = clSortMode(); renderSortMenu(); m.classList.remove('hidden');
  });
  const clDk = (ev, d) => ev.kind === 'checklist' || !d ? '_' : dKey(d);
  function gigChecklist(ev, d, key) {
    const dk = clDk(ev, d);
    const list = ev.checklists && Array.isArray(ev.checklists[dk]) ? ev.checklists[dk] : [];
    const mgr = canRoles(currentBand);           // Admin und Organisation
    const me = actorUid();                       // in der Vorschau: das betrachtete Mitglied
    const preview = !!viewAs;
    const box = el('div', 'cl');
    const run = async (fn, okMsg) => {
      clpOpen.add(key);
      try { const r = await clMutate(ev.id, dk, fn); if (r !== false && okMsg) flash(okMsg); refreshEventViews(); }
      catch (e) { flash(friendlyError(e), true); }
    };
    // Rechte prüfen: zuerst fehlende Berechtigung (rote Meldung), dann Vorschau-Sperre
    const clWrite = levelFor(currentBand, 'page4') === 'edit';
    const guard = (e, allowed, text) => {
      if (!clWrite) { if (e) e.preventDefault(); previewBlocked(e, CL_READ); return false; }
      if (!allowed) { if (e) e.preventDefault(); previewBlocked(e, text); return false; }
      if (preview) { if (e) e.preventDefault(); previewBlocked(e); return false; }
      return true;
    };
    // Zweistufiges Löschen: erster Klick fragt nach
    const delBtn = (title, ok, onDel) => {
      const b = el('button', 'cl-ib' + (ok ? '' : ' pv-locked'), '🗑'); b.type = 'button'; b.title = title;
      let armed = null;
      b.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        if (!guard(e, ok, CL_DENIED)) return;
        if (!armed) { b.textContent = 'Löschen?'; b.classList.add('warn'); armed = setTimeout(() => { armed = null; b.textContent = '🗑'; b.classList.remove('warn'); }, 3000); return; }
        clearTimeout(armed); onDel();
      });
      return b;
    };
    const editBtn = (id, title, ok) => {
      const b = el('button', 'cl-ib' + (ok ? '' : ' pv-locked'), '✎'); b.type = 'button'; b.title = title;
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (!guard(e, ok, CL_DENIED)) return; clEdit = id; clpOpen.add(key); refreshEventViews(); });
      return b;
    };
    // Eingabezeile für einen Namen
    const form = (opts) => {
      const f = el('div', 'cl-form');
      const t = el('input'); t.type = 'text'; t.maxLength = 80; t.placeholder = opts.placeholder; t.value = opts.title || '';
      f.appendChild(t);
      const allowed = opts.allowed !== false;
      const ok = el('button', 'btn small' + (allowed ? '' : ' pv-locked'), opts.okText); ok.type = 'button';
      const submit = e => {
        if (!guard(e, allowed, CL_DENIED)) return;
        const title = t.value.trim();
        if (!title) { t.focus(); return; }
        opts.onOk(title);
      };
      ok.addEventListener('click', submit);
      [t].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(e); if (e.key === 'Escape' && opts.onCancel) opts.onCancel(); }));
      if (!allowed || preview) { t.readOnly = true; t.classList.add('pv-locked-input'); }
      f.appendChild(ok);
      if (opts.onCancel) { const c = el('button', 'btn small ghost', 'Abbrechen'); c.type = 'button'; c.addEventListener('click', opts.onCancel); f.appendChild(c); }
      if (opts.focus) setTimeout(() => t.focus(), 0);
      return f;
    };

    // Wer erledigt das? (für Reiter und Unterreiter)
    const peopleBox = (mem, change, menuId) => {
      const mine = !!me && mem.includes(me);
      const ppl = el('div', 'cl-people');
      ppl.appendChild(el('span', 'cl-who', mem.length ? 'Übernommen von:' : 'Noch niemand übernimmt das'));
      mem.forEach(u => {
        const chip = el('span', 'cl-person' + (u === me ? ' me' : ''));
        const av = el('span', 'avatar'); setAvatar(av, clName(u), clPhoto(u), { locked: clLocked(u) });
        chip.append(av, el('span', null, clName(u) + (u === me ? ' (du)' : '')));
        if (mgr || u === me) {
          const x = el('button', 'cl-x', '✕'); x.type = 'button'; x.title = u === me ? 'Doch nicht – mich austragen' : clName(u) + ' austragen';
          x.addEventListener('click', e => {
            if (!guard(e, mgr || u === me, CL_MEMBER_DENIED)) return;
            change(y => { y.members = (y.members || []).filter(v => v !== u); }, u === me ? 'Du bist ausgetragen' : clName(u) + ' ausgetragen');
          });
          chip.appendChild(x);
        }
        ppl.appendChild(chip);
      });
      // „Ich erledige das“ – für alle, auch Admin und Organisation
      if (me && !mine) {
        const b = el('button', 'cl-add-me' + (preview ? ' pv-locked' : ''), '🙋 Ich erledige das'); b.type = 'button';
        b.addEventListener('click', e => {
          if (!guard(e, true)) return;
          change(y => { y.members = [...new Set([...(y.members || []), uid])]; }, 'Du erledigst das ✓');
        });
        ppl.appendChild(b);
      }
      // Admin/Organisation: Mitglieder per Klappmenü zuweisen oder entfernen
      if (mgr) {
        const wrap = el('span', 'cl-menu-wrap');
        const btn = el('button', 'cl-menu-btn' + (preview ? ' pv-locked' : ''), '👥 Mitglieder zuweisen ▾'); btn.type = 'button';
        const menu = el('div', 'cl-menu' + (clMenu === menuId ? ' open' : ''));
        const people = clPeople();
        if (!people.length) menu.appendChild(el('div', 'cl-menu-empty', 'Keine Mitglieder vorhanden.'));
        people.forEach(pp => {
          const lab = el('label', 'cl-menu-row');
          const cb = el('input'); cb.type = 'checkbox'; cb.checked = mem.includes(pp.uid);
          const av = el('span', 'avatar'); setAvatar(av, pp.name, pp.pending ? null : clPhoto(pp.uid), { locked: !pp.pending && clLocked(pp.uid) });
          lab.append(cb, av, el('span', 'cl-menu-name', pp.name + (pp.uid === me ? ' (du)' : '')));
          if (pp.pending) lab.appendChild(el('span', 'cl-menu-tag', 'nicht registriert'));
          cb.addEventListener('click', e => {
            if (!guard(e, true)) return;
            const v = cb.checked;
            clMenu = menuId;
            change(y => { const set = new Set(y.members || []); if (v) set.add(pp.uid); else set.delete(pp.uid); y.members = [...set]; },
              v ? pp.name + (pp.uid === me ? ' – du erledigst das' : ' erledigt das') : pp.name + ' entfernt');
          });
          menu.appendChild(lab);
        });
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          if (preview) return previewBlocked(e);
          const open = !menu.classList.contains('open');
          document.querySelectorAll('.cl-menu.open').forEach(m => m.classList.remove('open'));
          menu.classList.toggle('open', open);
          clMenu = open ? menuId : null;
        });
        menu.addEventListener('click', e => e.stopPropagation());
        wrap.append(btn, menu);
        ppl.appendChild(wrap);
      }
      return ppl;
    };
    if (!list.length) box.appendChild(el('div', 'cl-empty', 'Noch keine Checkliste. Lege unten einen ersten Reiter an, z. B. „Technik“, „Merch“ oder „Transport“.'));

    const okey = ev.id + '|' + dk;
    const myOrder = (profile && profile.clOrder && profile.clOrder[okey]) || {};
    clSorted(list, 'r', { manual: myOrder.r }).forEach(r => {
      const rid = key + '|' + r.id;
      const items = clSorted(Array.isArray(r.items) ? r.items : [], 'i', { manual: myOrder.i && myOrder.i[r.id] });
      const det = el('details', 'cl-reiter'); det.open = !clClosed.has(rid);
      det.dataset.cid = r.id;
      det.addEventListener('toggle', () => { if (det.open) clClosed.delete(rid); else clClosed.add(rid); });
      const sum = el('summary');
      const doneN = items.filter(i => i.done).length;
      const rMem = Array.isArray(r.members) ? r.members : [];
      // Reiter mit Unterreitern: automatisch abgehakt, sobald alle erledigt sind
      const auto = items.length > 0;
      const rDone = auto ? doneN === items.length : !!r.done;
      const rOwn = mgr || (!!me && r.createdBy === me);   // selbst erstellt oder Admin/Organisation
      const rCanDone = rOwn || (!!me && rMem.includes(me));
      det.classList.toggle('done', rDone);
      const rcb = el('input'); rcb.type = 'checkbox'; rcb.className = 'cl-rcb' + (auto ? ' auto' : (rCanDone ? '' : ' locked'));
      rcb.checked = rDone;
      rcb.title = auto ? 'Wird automatisch abgehakt, wenn alle Unterreiter erledigt sind' : 'Erledigt';
      rcb.addEventListener('click', e => {
        e.stopPropagation();
        if (auto) { e.preventDefault(); flash('Wird automatisch abgehakt, sobald alle Unterreiter erledigt sind'); return; }
        if (!guard(e, rCanDone, CL_DONE_DENIED)) return;
        const v = rcb.checked;
        run(l => { const x = l.find(y => y.id === r.id); if (!x) return false; x.done = v; x.doneBy = uid; });
      });
      if (clSortMode() === 'manual') sum.appendChild(el('span', 'cl-grip-ic', '⠿'));
      clMakeDraggable(det, sum, box, '.cl-reiter', ids => clSaveOrder(okey, 'r', ids));
      sum.appendChild(rcb);
      if (clEdit === 'r:' + rid) {
        sum.append(el('span', 'cl-rt', r.title));
      } else {
        sum.append(el('span', 'cl-rt', r.title), el('span', 'cl-rs', items.length ? `${doneN}/${items.length}` : ''));
        const tools = el('span', 'cl-tools');
        tools.append(editBtn('r:' + rid, 'Reiter umbenennen', rOwn), delBtn('Reiter löschen', rOwn, () => run(l => { const i = l.findIndex(x => x.id === r.id); if (i < 0) return false; l.splice(i, 1); }, 'Reiter gelöscht')));
        sum.appendChild(tools);
      }
      det.appendChild(sum);
      const body = el('div', 'cl-body');
      if (clEdit === 'r:' + rid) {
        body.appendChild(form({ placeholder: 'Name des Reiters', title: r.title, okText: 'Speichern', focus: true,
          onCancel: () => { clEdit = null; refreshEventViews(); },
          onOk: title => { clEdit = null; run(l => { const x = l.find(y => y.id === r.id); if (!x) return false; x.title = title; }, 'Reiter umbenannt'); } }));
      }
      body.appendChild(peopleBox(rMem, (fn, msg) => run(l => { const y = l.find(z => z.id === r.id); if (!y) return false; fn(y); }, msg), 'r:' + rid));
      body.lastElementChild.classList.add('cl-rpeople');
      if (!items.length) body.appendChild(el('div', 'cl-empty', 'Noch keine Unterreiter.'));
      items.forEach(it => {
        const iid = rid + '|' + it.id;
        const mem = Array.isArray(it.members) ? it.members : [];
        const mine = !!me && mem.includes(me);
        const iOwn = mgr || (!!me && it.createdBy === me);   // selbst erstellt oder Admin/Organisation
        const canDone = iOwn || mine;
        const row = el('div', 'cl-item' + (it.done ? ' done' : '') + (mem.length ? ' taken' : '') + (canDone ? '' : ' locked'));
        row.dataset.cid = it.id;
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!it.done; cb.title = 'Erledigt';
        cb.addEventListener('click', e => {
          if (!guard(e, canDone, CL_DONE_DENIED)) return;
          const v = cb.checked;
          run(l => { const x = (l.find(y => y.id === r.id) || { items: [] }).items.find(y => y.id === it.id); if (!x) return false; x.done = v; x.doneBy = uid; });
        });
        const main = el('div', 'cl-main');
        if (clEdit === 'i:' + iid) {
          main.appendChild(form({ placeholder: 'Name des Unterreiters', title: it.title, okText: 'Speichern', focus: true,
            onCancel: () => { clEdit = null; refreshEventViews(); },
            onOk: title => { clEdit = null; run(l => { const x = (l.find(y => y.id === r.id) || { items: [] }).items.find(y => y.id === it.id); if (!x) return false; x.title = title; }, 'Unterreiter gespeichert'); } }));
        } else {
          main.appendChild(el('div', 'cl-title', it.title));
        }
        main.appendChild(peopleBox(mem, (fn, msg) => run(l => { const y = (l.find(z => z.id === r.id) || { items: [] }).items.find(z => z.id === it.id); if (!y) return false; fn(y); }, msg), 'i:' + iid));
        if (clSortMode() === 'manual') row.append(el('span', 'cl-grip-ic', '⠿'));
        row.append(cb, main);
        clMakeDraggable(row, row, body, '.cl-item', ids => clSaveOrder(okey, r.id, ids));
        if (clEdit !== 'i:' + iid) {
          const tools = el('span', 'cl-tools');
          tools.append(editBtn('i:' + iid, 'Unterreiter bearbeiten', iOwn), delBtn('Unterreiter löschen', iOwn, () => run(l => { const y = l.find(z => z.id === r.id); if (!y) return false; y.items = (y.items || []).filter(z => z.id !== it.id); }, 'Unterreiter gelöscht')));
          row.appendChild(tools);
        }
        body.appendChild(row);
      });
      body.appendChild(form({ placeholder: 'Neuer Unterreiter, z. B. Gitarrenkabel', okText: '+ Unterreiter',
        onOk: title => run(l => { const y = l.find(z => z.id === r.id); if (!y) return false; y.items = [...(y.items || []), { id: clId(), title, members: [], done: false, createdBy: uid, createdAt: new Date().toISOString() }]; }, 'Unterreiter hinzugefügt') }));
      det.appendChild(body);
      box.appendChild(det);
    });
    box.appendChild(form({ placeholder: 'Neuer Reiter, z. B. Technik', okText: '+ Reiter',
      onOk: title => run(l => { l.push({ id: clId(), title, items: [], createdBy: uid, createdAt: new Date().toISOString() }); }, 'Reiter hinzugefügt') }));
    const all = list.reduce((n, r) => n + ((r.items || []).length || 1), 0);
    const done = list.reduce((n, r) => n + ((r.items || []).length ? (r.items || []).filter(i => i.done).length : (r.done ? 1 : 0)), 0);
    return { box, summary: all ? `${done}/${all} erledigt` : (list.length ? `${list.length} Reiter` : '') };
  }
  // ================= Seite „Checkliste“ =================
  // Stand einer Checkliste inkl. „habe ich offene Aufgaben?“ (für die Sortierung der Karten)
  function clCardInfo(ev, d) {
    const dk = clDk(ev, d);
    const list = ev.checklists && Array.isArray(ev.checklists[dk]) ? ev.checklists[dk] : [];
    const me = actorUid();
    const mine = x => !!me && (x.members || []).includes(me);
    let mineOpen = false;
    list.forEach(r => {
      const items = r.items || [];
      const rDone = items.length ? items.every(i => i.done) : !!r.done;
      if (mine(r) && !rDone) mineOpen = true;
      items.forEach(i => { if (mine(i) && !i.done) mineOpen = true; });
    });
    return { ...clStats(ev, dk), mineOpen };
  }
  function clStats(ev, dk) {
    const list = ev.checklists && Array.isArray(ev.checklists[dk]) ? ev.checklists[dk] : [];
    const all = list.reduce((n, r) => n + ((r.items || []).length || 1), 0);
    const done = list.reduce((n, r) => n + ((r.items || []).length ? (r.items || []).filter(i => i.done).length : (r.done ? 1 : 0)), 0);
    return { all, done };
  }
  function scrollToCard(listId, key) {
    setTimeout(() => {
      const c = [...document.querySelectorAll('#' + listId + ' [data-key]')].find(x => x.dataset.key === key);
      if (!c) return;
      c.scrollIntoView({ behavior: 'smooth', block: 'start' });
      c.classList.add('flash-hl'); setTimeout(() => c.classList.remove('flash-hl'), 1600);
    }, 60);
  }
  function jumpToChecklist(key, d) {
    clpOpen.add(key);
    if (d && dOnly(d) < dOnly(new Date())) clpShowPast = true;
    showPage('page4');
    scrollToCard('clpList', key);
  }
  function jumpToGig(key, d) {
    gigsOpen.add(key);
    if (dOnly(d) < dOnly(new Date())) gigsShowPast = true;
    showPage('page3');
    scrollToCard('gigList', key);
  }
  function clpCard(it, past) {
    const ev = it.ev, d = it.date;
    const solo = ev.kind === 'checklist';
    const key = ev.id + '|' + clDk(ev, d);
    const c = solo ? (d ? catOf('__deadline') : { name: 'Checkliste', color: '#16a34a' }) : catOf(ev.category);
    const isGig = !solo && ev.category === 'auftritt';
    const card = el('div', 'gig clp-card' + (clpOpen.has(key) ? ' open' : '') + (past ? ' past' : ''));
    card.dataset.key = key;
    card.style.setProperty('--c', c.color);
    const head = el('button', 'gig-head'); head.type = 'button';
    const date = el('div', 'gig-date');
    if (d) date.append(el('span', 'gd-wd', CAL_WD[wdIdx(d)]), el('span', 'gd-d', String(d.getDate())), el('span', 'gd-m', MONTH_SHORT[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2)));
    else { date.classList.add('nodate'); date.append(el('span', 'gd-d', '☑')); }
    const info = el('div', 'gig-info');
    info.append(el('div', 'gig-title', ev.title || 'Ohne Titel'));
    const sub = el('div', 'gig-sub');
    const tag = el('span', 'clp-cat', solo && d ? '⏰ Deadline' : c.name); tag.style.setProperty('--c', c.color);
    const rest = solo
      ? (d ? (ev.start ? 'bis ' + fmtLong(d) + ', ' + ev.start + ' Uhr' : 'bis ' + fmtLong(d)) + ' · ' + relDays(d) : 'ohne Deadline')
      : [timeLabel(ev), ev.location].filter(Boolean).join(' · ');
    sub.append(tag, ' ' + rest);
    info.appendChild(sub);
    const st = clStats(ev, clDk(ev, d));
    const badge = el('span', 'gig-badge clp-prog' + (st.all && st.done === st.all ? ' full' : ''), st.all ? `${st.done}/${st.all}` : 'leer');
    const chev = el('span', 'mchev'); chev.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
    head.append(date, info, badge, chev);
    head.addEventListener('click', () => {
      if (clpOpen.has(key)) clpOpen.delete(key); else clpOpen.add(key);
      card.classList.toggle('open', clpOpen.has(key));
    });
    const body = el('div', 'gig-body');
    const { box } = gigChecklist(ev, d, key);
    body.appendChild(box);
    const actions = el('div', 'gig-actions');
    if (isGig) {
      const g = el('button', 'btn small' + (levelFor(currentBand, 'page3') === 'hidden' ? ' pv-locked' : ''), '🎤 Zum Gig'); g.type = 'button';
      g.addEventListener('click', e => {
        if (levelFor(currentBand, 'page3') === 'hidden') return previewBlocked(e, 'Keine Berechtigung: Die Registerkarte „Gigs“ ist für dich ausgeblendet. Bitte den Admin um Zugriff.');
        jumpToGig(key, d);
      });
      actions.appendChild(g);
    }
    if (d) {
      const cal = el('button', 'btn small ghost', 'Im Kalender anzeigen'); cal.type = 'button';
      cal.addEventListener('click', e => {
        if (levelFor(currentBand, 'page2') === 'hidden') return previewBlocked(e, 'Keine Berechtigung: Der Kalender ist für dich ausgeblendet.');
        calSel = dOnly(d); calDate = dOnly(d); calView = 'month'; showPage('page2');
      });
      actions.appendChild(cal);
    }
    if (solo) {
      const ok = clSoloCanEdit(ev);
      const ed = el('button', 'btn small ghost' + (ok ? '' : ' pv-locked'), 'Bearbeiten'); ed.type = 'button';
      ed.addEventListener('click', e => {
        if (!ok) return previewBlocked(e, CL_SOLO_DENIED);
        openClNew({ edit: ev });
      });
      actions.appendChild(ed);
    }
    body.appendChild(actions);
    card.append(head, body);
    return card;
  }
  // Eigenständige Checkliste bearbeiten: Ersteller, Admin und Organisation (mit Recht „Bearbeiten“ für die Checkliste)
  const clSoloCanEdit = ev => levelFor(currentBand, 'page4') === 'edit' && (canRoles(currentBand) || (!!actorUid() && ev.createdBy === actorUid()));
  const CL_SOLO_DENIED = 'Keine Berechtigung: Diese Checkliste können nur die Person, die sie erstellt hat, der Admin und die Organisation bearbeiten.';
  // Klick auf eine Deadline im Kalender: zur Checkliste springen
  function openDeadline(e, ev, d) {
    if (levelFor(currentBand, 'page4') === 'hidden') return previewBlocked(e, 'Keine Berechtigung: Die Registerkarte „Checkliste“ ist für dich ausgeblendet. Bitte den Admin um Zugriff.');
    jumpToChecklist(ev.id + '|_', d);
  }
  function clpItems() {
    const today = dOnly(new Date());
    const from = addDays(today, -730), to = addDays(today, 730);
    const all = [];
    calEvents.filter(ev => ev.checklist && ev.kind !== 'checklist').forEach(ev => occurrences(ev, from, to).forEach(d => all.push({ ev, date: d })));
    clLists.forEach(ev => all.push({ ev, date: ev.date ? parseKey(ev.date) : null }));
    return all;
  }
  function renderChecklistPage() {
    if (gigMembersBand !== currentBand) ensureGigMembers();
    const list = $('clpList'); list.innerHTML = '';
    const today = dOnly(new Date());
    const all = clpItems();
    const byTime = (a, b) => a.date - b.date || (a.ev.start || '').localeCompare(b.ev.start || '');
    const mode = clSortMode();
    const undated = all.filter(x => !x.date).sort((a, b) => (a.ev.title || '').localeCompare(b.ev.title || ''));
    const upcoming = all.filter(x => x.date && x.date >= today).sort(byTime);
    // Kartenreihenfolge nach Sortierung: Termin/Manuell = nach kommenden Terminen (mit Monaten)
    const timeline = mode === 'date' || mode === 'manual';
    const past = all.filter(x => x.date && x.date < today).sort((a, b) => -byTime(a, b));
    const n = upcoming.length + undated.length;
    $('clpCount').textContent = n === 1 ? '1 offene Checkliste' : `${n} Checklisten`;
    $('clpAdd').classList.toggle('pv-locked', !!viewAs);
    $('clpSortInfo').textContent = '⇅ ' + clSortName() + (clSortBandOverride() ? ' · nur diese Band' : '') + ' ▾';
    if (!n) list.appendChild(el('div', 'empty small', 'Noch keine Checklisten. Mit „Checkliste erstellen“ legst du eine an – für einen Gig, einen Termin oder ganz für sich.'));
    if (timeline) {
      let lastMonth = '';
      upcoming.forEach(it => {
        const m = CAL_MONTHS[it.date.getMonth()] + ' ' + it.date.getFullYear();
        if (m !== lastMonth) { list.appendChild(el('div', 'gig-month', m)); lastMonth = m; }
        list.appendChild(clpCard(it, false));
      });
      if (undated.length) {
        list.appendChild(el('div', 'gig-month', 'Ohne Deadline'));
        undated.forEach(it => list.appendChild(clpCard(it, false)));
      }
    } else {
      // Persönlicher Status, Bandstatus, Alphabet: eine Liste ohne Monate
      const info = it => clCardInfo(it.ev, it.date);
      const t = it => it.date ? it.date.getTime() : 8.64e15;
      const cmp = mode === 'alpha'
        ? (a, b) => (a.ev.title || '').localeCompare(b.ev.title || '', 'de', { sensitivity: 'base' }) || t(a) - t(b)
        : mode === 'personal'
          ? (a, b) => { const A = info(a), B = info(b); const r = x => x.mineOpen ? 0 : (x.all && x.done === x.all ? 2 : 1); return r(A) - r(B) || t(a) - t(b); }
          : (a, b) => { const A = info(a), B = info(b); const sh = x => x.all ? x.done / x.all : 0; const fin = x => x.all && x.done === x.all ? 1 : 0; return fin(A) - fin(B) || sh(A) - sh(B) || t(a) - t(b); };
      if (n) list.appendChild(el('div', 'gig-month', 'Sortiert nach: ' + clSortName()));
      [...upcoming, ...undated].sort(cmp).forEach(it => list.appendChild(clpCard(it, false)));
    }
    if (past.length) {
      const t = el('button', 'gig-past-toggle', (clpShowPast ? '▾ ' : '▸ ') + `Vergangene (${past.length})`); t.type = 'button';
      t.addEventListener('click', () => { clpShowPast = !clpShowPast; renderChecklistPage(); });
      list.appendChild(t);
      if (clpShowPast) past.forEach(it => list.appendChild(clpCard(it, true)));
    }
  }

  // ----- Fenster „Checkliste erstellen“ -----
  const STAGE_SVG = '<svg viewBox="0 0 24 24"><path d="M2 2.5h20"/><path d="M3 2.5v12.5h4.5C5.5 12 5 8 6.5 2.5"/><path d="M21 2.5v12.5h-4.5c2-3 2.5-7 1-12.5"/><path d="M12 6l-2.5 9M12 6l2.5 9" stroke-dasharray="1.6 1.6"/><circle cx="12" cy="5" r="1.2"/><path d="M1.5 15h21M3 15v5h18v-5"/></svg>';
  const CLN_OPTS = [
    { id: 'gigAssign', icon: 'stage', title: 'Gig zuweisen', text: 'Einem bestehenden Gig eine Checkliste geben.' },
    { id: 'evAssign', icon: '📅', title: 'Termin zuweisen', text: 'Einem bestehenden Termin eine Checkliste geben.' },
    { id: 'gigNew', icon: '➕', title: 'Gig erstellen', text: 'Neuen Gig anlegen – mit Checkliste.' },
    { id: 'evNew', icon: '🗓️', title: 'Termin erstellen', text: 'Neuen Termin anlegen – mit Checkliste.' },
    { id: 'only', icon: '☑️', title: 'Nur Checkliste erstellen', text: 'Eigenständige Checkliste, auf Wunsch mit Deadline.' },
  ];
  function clnPerm(id) {
    const lv = r => levelFor(currentBand, r) === 'edit';
    switch (id) {
      case 'gigAssign': return lv('page3') && canRoles(currentBand) ? null : 'Keine Berechtigung: Einem Gig eine Checkliste zuweisen dürfen nur der Admin und die Organisation (mit Recht „Bearbeiten“ für Gigs).';
      case 'evAssign': return lv('page2') ? null : 'Keine Berechtigung: Dafür brauchst du das Recht „Bearbeiten“ für den Kalender. Bitte den Admin darum.';
      case 'gigNew': return lv('page3') ? null : GIG_CREATE_DENIED;
      case 'evNew': return lv('page2') ? null : CAL_DENIED;
      default: return lv('page4') ? null : CL_READ;
    }
  }
  let cln = { opt: null, edit: null, preEv: null };
  function openClNew(o = {}) {
    cln = { opt: o.opt || null, edit: o.edit || null, preEv: o.evId || null, armed: false };
    if (cln.edit) cln.opt = 'only';
    $('clnTitle').textContent = cln.edit ? 'Checkliste bearbeiten' : 'Checkliste erstellen';
    setMsg($('clnMsg'), '');
    renderClNew();
    $('clNewModal').classList.remove('hidden');
  }
  function closeClNew() { $('clNewModal').classList.add('hidden'); }
  function evOptionLabel(ev) {
    const d = parseKey(ev.date);
    const rep = ev.repeat && ev.repeat.freq && ev.repeat.freq !== 'none';
    return `${CAL_WD[wdIdx(d)]} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)} · ${ev.title || 'Ohne Titel'}${rep ? ' (Serie)' : ''}`;
  }
  function renderClNew() {
    const opts = $('clnOpts'); opts.innerHTML = '';
    opts.classList.toggle('hidden', !!cln.edit);
    CLN_OPTS.forEach(o => {
      const denied = clnPerm(o.id);
      const b = el('button', 'cln-opt' + (cln.opt === o.id ? ' on' : '') + (denied ? ' locked' : '')); b.type = 'button';
      const ic = el('span', 'cln-ic' + (o.icon === 'stage' ? ' svg' : ''));
      if (o.icon === 'stage') ic.innerHTML = STAGE_SVG; else ic.textContent = o.icon;
      b.append(ic, el('span', 'cln-t', o.title), el('span', 'cln-d', o.text));
      b.addEventListener('click', e => {
        if (denied) return previewBlocked(e, denied);
        cln.opt = o.id; setMsg($('clnMsg'), ''); renderClNew();
      });
      opts.appendChild(b);
    });
    const pane = $('clnPane'); pane.innerHTML = '';
    const go = $('clnGo'), del = $('clnDel');
    del.classList.toggle('hidden', !cln.edit); del.textContent = 'Löschen'; cln.armed = false;
    go.classList.toggle('hidden', !cln.opt);
    if (!cln.opt) { pane.appendChild(el('div', 'mnote', 'Wähle oben, wofür die Checkliste sein soll.')); return; }
    const today = dKey(new Date());
    if (cln.opt === 'gigAssign' || cln.opt === 'evAssign') {
      const gig = cln.opt === 'gigAssign';
      const cand = calEvents.filter(ev => ev.kind !== 'checklist' && !ev.checklist && (gig ? ev.category === 'auftritt' : ev.category !== 'auftritt')
        && (ev.date >= today || (ev.repeat && ev.repeat.freq && ev.repeat.freq !== 'none'))).sort((a, b) => a.date.localeCompare(b.date));
      const f = el('div', 'field');
      const lab = el('label', null, gig ? 'Gig' : 'Termin'); lab.htmlFor = 'clnSel';
      const sel = el('select'); sel.id = 'clnSel';
      cand.forEach(ev => { const op = new Option(evOptionLabel(ev), ev.id); sel.appendChild(op); });
      if (cln.preEv && cand.some(ev => ev.id === cln.preEv)) sel.value = cln.preEv;
      f.append(lab, sel);
      if (!cand.length) pane.appendChild(el('div', 'mnote', gig ? 'Alle kommenden Gigs haben bereits eine Checkliste – oder es gibt noch keine.' : 'Alle kommenden Termine haben bereits eine Checkliste – oder es gibt noch keine.'));
      else pane.appendChild(f);
      go.textContent = 'Zuweisen'; go.disabled = !cand.length;
    } else if (cln.opt === 'gigNew' || cln.opt === 'evNew') {
      pane.appendChild(el('div', 'mnote', cln.opt === 'gigNew' ? 'Es öffnet sich das Fenster „Gig erstellen“. Der Haken „Checkliste“ ist dort bereits gesetzt.' : 'Es öffnet sich das Fenster „Neuer Termin“. Der Haken „Checkliste“ ist dort bereits gesetzt.'));
      go.textContent = 'Weiter'; go.disabled = false;
    } else {
      const ev = cln.edit;
      const f = el('div', 'field');
      const lab = el('label', null, 'Name der Checkliste'); lab.htmlFor = 'clnName';
      const t = el('input'); t.type = 'text'; t.id = 'clnName'; t.maxLength = 80; t.placeholder = 'z. B. Material für das Bandweekend'; t.value = ev ? ev.title || '' : '';
      f.append(lab, t); pane.appendChild(f);
      const dl = el('label', 'ev-cl-toggle cln-dl');
      const cb = el('input'); cb.type = 'checkbox'; cb.id = 'clnDl'; cb.checked = !!(ev && ev.date);
      const txt = el('span', 'ev-cl-text'); txt.append(el('strong', null, '⏰ Deadline hinzufügen'), el('small', null, 'Die Deadline erscheint im Kalender.'));
      dl.append(cb, el('span', 'ev-cl-box', '✓'), txt);
      pane.appendChild(dl);
      const grid = el('div', 'ev-grid cln-dl-grid' + (cb.checked ? '' : ' hidden'));
      const f1 = el('div', 'field'); const l1 = el('label', null, 'Datum'); l1.htmlFor = 'clnDate';
      const di = el('input'); di.type = 'date'; di.id = 'clnDate'; di.value = ev && ev.date ? ev.date : dKey(addDays(new Date(), 7));
      f1.append(l1, di);
      const f2 = el('div', 'field'); const l2 = el('label', null, 'Uhrzeit (optional)'); l2.htmlFor = 'clnTime';
      const ti = el('input'); ti.type = 'time'; ti.id = 'clnTime'; ti.value = ev && ev.start ? ev.start : '';
      f2.append(l2, ti);
      grid.append(f1, f2); pane.appendChild(grid);
      cb.addEventListener('change', () => grid.classList.toggle('hidden', !cb.checked));
      go.textContent = ev ? 'Speichern' : 'Erstellen'; go.disabled = false;
      setTimeout(() => t.focus(), 30);
    }
  }
  $('clnClose').addEventListener('click', closeClNew);
  $('clnCancel').addEventListener('click', closeClNew);
  $('clNewModal').addEventListener('click', e => { if (e.target === $('clNewModal')) closeClNew(); });
  $('clnGo').addEventListener('click', async e => {
    const opt = cln.opt; if (!opt) return;
    const denied = cln.edit ? (clSoloCanEdit(cln.edit) ? null : CL_SOLO_DENIED) : clnPerm(opt);
    if (denied) return previewBlocked(e, denied);
    if (viewAs) return previewBlocked(e);
    const msg = $('clnMsg');
    const col = db.collection(`calendar/${currentBand}/events`);
    const now = new Date().toISOString();
    if (opt === 'gigNew' || opt === 'evNew') {
      closeClNew();
      openEventModal(opt === 'gigNew' ? { date: new Date(), category: 'auftritt', gigOnly: true, checklist: true } : { date: new Date(), checklist: true });
      return;
    }
    $('clnGo').disabled = true;
    try {
      if (opt === 'gigAssign' || opt === 'evAssign') {
        const id = $('clnSel') && $('clnSel').value; if (!id) return;
        const ref = col.doc(id); const sn = await ref.get();
        if (!sn.exists) throw new Error('Der Termin existiert nicht mehr.');
        await ref.set({ ...sn.data(), checklist: true, updatedBy: uid, updatedAt: now });
        await reloadEventsOnce();
        closeClNew();
        const ev = calEvents.find(x => x.id === id) || { id, ...sn.data() };
        const today = dOnly(new Date());
        const occ = occurrences(ev, today, addDays(today, 730))[0] || parseKey(ev.date);
        flash('Checkliste zugewiesen ✓');
        jumpToChecklist(id + '|' + dKey(occ), occ);
      } else {
        const title = $('clnName').value.trim();
        if (!title) { setMsg(msg, 'Bitte einen Namen eingeben.', 'error'); $('clnName').focus(); return; }
        const hasDl = $('clnDl').checked;
        const date = hasDl ? $('clnDate').value : '';
        if (hasDl && !date) { setMsg(msg, 'Bitte ein Datum für die Deadline wählen.', 'error'); return; }
        const time = hasDl ? $('clnTime').value : '';
        const base = { kind: 'checklist', title, checklist: true, date, start: time, end: '', allDay: !time, category: '__deadline', repeat: { freq: 'none' }, updatedBy: uid, updatedAt: now };
        let id;
        if (cln.edit) {
          id = cln.edit.id;
          const ref = col.doc(id); const sn = await ref.get();
          await ref.set({ ...(sn.exists ? sn.data() : {}), ...base });
          await reloadEventsOnce();
          flash('Checkliste gespeichert ✓');
        } else {
          id = await writeEvent(null, { ...base, checklists: {}, createdBy: uid, createdAt: now });
          flash(hasDl ? 'Checkliste mit Deadline erstellt ✓' : 'Checkliste erstellt ✓');
        }
        closeClNew();
        jumpToChecklist(id + '|_', date ? parseKey(date) : null);
      }
    } catch (err) { setMsg(msg, friendlyError(err), 'error'); }
    finally { $('clnGo').disabled = false; }
  });
  $('clnDel').addEventListener('click', async e => {
    const ev = cln.edit; if (!ev) return;
    if (!clSoloCanEdit(ev)) return previewBlocked(e, CL_SOLO_DENIED);
    if (viewAs) return previewBlocked(e);
    if (!cln.armed) { cln.armed = true; $('clnDel').textContent = 'Wirklich löschen?'; return; }
    try {
      await db.collection(`calendar/${currentBand}/events`).doc(ev.id).delete();
      await reloadEventsOnce();
      closeClNew(); flash('Checkliste gelöscht');
    } catch (err) { setMsg($('clnMsg'), friendlyError(err), 'error'); }
  });
  $('clpAdd').addEventListener('click', e => {
    if (viewAs) return previewBlocked(e);
    openClNew();
  });
  $('clpExpand').addEventListener('click', () => { clpItems().forEach(it => clpOpen.add(it.ev.id + '|' + clDk(it.ev, it.date))); document.querySelectorAll('#clpList .gig').forEach(g => g.classList.add('open')); });
  $('clpCollapse').addEventListener('click', () => { clpOpen.clear(); document.querySelectorAll('#clpList .gig').forEach(g => g.classList.remove('open')); });
  document.addEventListener('click', () => { if (!clMenu) return; clMenu = null; document.querySelectorAll('.cl-menu.open').forEach(m => m.classList.remove('open')); });
  const canEditGigs = () => canEditCalendar() && canRoles(currentBand);
  const GIG_DENIED = 'Keine Berechtigung: Gigs bearbeiten dürfen nur der Admin und Mitglieder mit der Rolle „Organisation“.';
  function gigCard(it, past) {
    const ev = it.ev, d = it.date;
    const key = ev.id + '|' + dKey(d);
    const c = catOf(ev.category);
    const card = el('div', 'gig' + (gigsOpen.has(key) ? ' open' : '') + (past ? ' past' : ''));
    card.dataset.key = key;
    card.style.setProperty('--c', c.color);
    const head = el('button', 'gig-head'); head.type = 'button';
    const date = el('div', 'gig-date');
    date.append(el('span', 'gd-wd', CAL_WD[wdIdx(d)]), el('span', 'gd-d', String(d.getDate())), el('span', 'gd-m', MONTH_SHORT[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2)));
    const info = el('div', 'gig-info');
    info.append(el('div', 'gig-title', ev.title || 'Ohne Titel'));
    info.append(el('div', 'gig-sub', [timeLabel(ev), ev.location].filter(Boolean).join(' · ')));
    const badge = el('span', 'gig-badge' + (relDays(d) === 'Heute' ? ' today' : ''), relDays(d));
    const chev = el('span', 'mchev'); chev.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
    head.append(date, info, badge, chev);
    head.addEventListener('click', () => {
      if (gigsOpen.has(key)) gigsOpen.delete(key); else gigsOpen.add(key);
      card.classList.toggle('open', gigsOpen.has(key));
    });
    const body = el('div', 'gig-body');
    body.dataset.key = key;
    // Klappbare Abschnitte
    const section = (title, summary, content, open) => {
      const d = el('details', 'gsec'); if (open) d.open = true;
      const s = el('summary'); s.append(el('span', 'gsec-t', title)); if (summary) s.append(el('span', 'gsec-s', summary));
      d.append(s, content); body.appendChild(d);
    };
    const rows = list => {
      const dl = el('div', 'gig-details');
      list.filter(([, v]) => v).forEach(([k, v]) => {
        const r = el('div', 'gig-row'); const vv = el('span', 'gv');
        if (v instanceof Node) vv.appendChild(v); else vv.textContent = v;
        r.append(el('span', 'gk', k), vv); dl.appendChild(r);
      });
      return dl;
    };
    const sc = ev.schedule || {};
    const plan = [['Get In', sc.getin], ['Aufbau', sc.aufbau], ['Soundcheck', sc.soundcheck], ['Linecheck', sc.linecheck],
      ['Gig', ev.allDay ? 'Ganztägig' : ev.start], ['Gig Ende', ev.allDay ? '' : ev.end]]
      .filter(([, v]) => v).map(([k, v]) => [k, /^\d\d:\d\d$/.test(v) ? v + ' Uhr' : v]);
    const sumPlan = [sc.getin ? 'Get In ' + sc.getin : '', ev.start && !ev.allDay ? 'Gig ' + ev.start : ''].filter(Boolean).join(' · ');
    section('Zeitplan', sumPlan, rows([['Datum', fmtLong(d)], ...plan]), true);
    // Line-up: alle Bands dieses Gigs aus der Timetable
    ttSub();
    {
      const lu = ttEntries(ev.id);
      if (lu.length) {
        const box = el('div', 'gig-lineup'), own = ((bands[currentBand] && bands[currentBand].name) || '').toLowerCase();
        lu.forEach(x => {
          const r = el('button', 'lu-row' + (ttName(x).toLowerCase() === own ? ' own' : '')); r.type = 'button';
          r.append(el('span', 'lu-t', x.time + (x.end ? ' – ' + x.end : '')), el('span', 'lu-b', ttName(x)));
          const sl = x.setlistId ? slLists.find(l => l.id === x.setlistId) : null;
          if (sl) {
            const pub = sl.vis === 'public', songs = (sl.items || []).filter(i => i.type === 'song');
            const mayIntern = levelFor(currentBand, 'page6') !== 'hidden';
            r.append(el('span', 'lu-v ' + (pub ? 'pub' : 'int'), pub ? '🌐 ' + songs.length + ' Songs' : '🔒 intern'));
            if (pub || mayIntern) r.title = 'Setlist „' + (sl.name || '') + '“: ' + songs.map(i => i.title).join(', ');
          }
          r.title = 'Zur Timetable'; r.addEventListener('click', e => { if (levelFor(currentBand, 'page8') === 'hidden') return previewBlocked(e, 'Keine Berechtigung: Die Registerkarte „Timetable“ ist für dich ausgeblendet.'); ttSel = ev.id; showPage('page8'); });
          const other = (x.bandId && x.bandId !== currentBand && bands[x.bandId]) ? x.bandId : Object.keys(bands).find(id => id !== currentBand && (bands[id].name || '').trim().toLowerCase() === ttName(x).toLowerCase());
          if (other) {
            const w = el('div', 'lu-wrap'), go = el('button', 'btn small ghost lu-go', '↗ Band öffnen'); go.type = 'button';
            go.title = 'Zu „' + bands[other].name + '“ wechseln';
            go.addEventListener('click', () => { $('bandSwitch').value = other; $('bandSwitch').dispatchEvent(new Event('change')); });
            w.append(r, go); box.appendChild(w);
          } else box.appendChild(r);
        });
        section('Line-up', lu.length === 1 ? '1 Band' : lu.length + ' Bands', box, false);
      }
    }
    // Teilnehmer (leer = alle)
    {
      const att = Array.isArray(ev.attendees) ? ev.attendees : [], bid = currentBand;
      if (att.length) {
        const p = el('div', 'gig-text', 'Wird geladen …');
        section('Teilnehmer', att.length + (att.length === 1 ? ' Person' : ' Personen'), p, false);
        (async () => {
          await loadBandMembers(bid);
          const names = att.map(u => { const m = (bandMembersCache[bid] || []).find(x => x.uid === u); return m ? (m.name || 'Unbekannt') : (u === uid ? profile.name : ''); }).filter(Boolean);
          p.textContent = names.length ? names.join(', ') : 'Keine aktiven Mitglieder ausgewählt.';
        })();
      }
    }
    // Ernährung der Band (anonyme Zusammenfassung, nur von Personen mit Haken „für meine Bands verwenden“)
    {
      const bid = currentBand, p = el('div', 'gig-text', 'Wird geladen …');
      const sec = el('details', 'gsec hidden'); const sm = el('summary'); sm.append(el('span', 'gsec-t', 'Ernährung der Band')); sec.append(sm, p); body.appendChild(sec);
      (async () => {
        await loadBandMembers(bid);
        const foods = [];
        await Promise.all((bandMembersCache[bid] || []).map(async m => {
          if (m.uid === uid) { if (profile.food && profile.food.share) foods.push(profile.food); return; }
          try { const c = await db.doc('foodshare/' + m.uid).get(); if (c.exists) foods.push(c.data()); } catch (e) {}
        }));
        if (!foods.length) return;
        const cnt = k => { const o = {}; foods.forEach(f => (f[k] || []).forEach(v => { o[v] = (o[v] || 0) + 1; })); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([v, n]) => n + '× ' + v); };
        const lines = [], d = cnt('diet'), al = cnt('allergens'), notes = foods.map(f => f.note).filter(Boolean);
        if (d.length) lines.push('Ernährung: ' + d.join(', '));
        if (al.length) lines.push('Allergien: ' + al.join(', '));
        if (notes.length) lines.push('Hinweise: ' + notes.join(' · '));
        if (!lines.length) return;
        p.textContent = ''; lines.forEach(l => p.append(el('div', null, l)));
        sm.append(el('span', 'gsec-s', foods.length + (foods.length === 1 ? ' Person' : ' Personen')));
        sec.classList.remove('hidden');
      })();
    }
    // Google Maps: eigener Link oder automatisch aus Location + Adresse; dazu Route planen
    const place = [ev.location, (ev.address || '').replace(/\n/g, ', ')].filter(Boolean).join(', ');
    let maps = null;
    if (place || ev.mapsUrl) {
      maps = el('span', 'maps-links');
      const a = el('a', 'map-btn', '📍 In Google Maps öffnen'); a.target = '_blank'; a.rel = 'noopener';
      a.href = ev.mapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place);
      maps.appendChild(a);
      if (place) {
        const r = el('a', 'map-btn', '🚗 Route planen'); r.target = '_blank'; r.rel = 'noopener';
        r.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(place);
        maps.appendChild(r);
      }
    }
    if (ev.location || ev.address || ev.parking || ev.mapsUrl) section('Location & Anfahrt', ev.location || '', rows([['Location', ev.location], ['Adresse', ev.address], ['Parkieren', ev.parking], ['Google Maps', maps]]), false);
    if (ev.catering || ev.cateringTime) { const p = el('div', 'gig-text', (ev.cateringTime ? ev.cateringTime + ' Uhr' + (ev.catering ? ' – ' : '') : '') + (ev.catering || '')); section('Verpflegung', ev.cateringTime ? ev.cateringTime + ' Uhr' : '', p, false); }
    const contacts = Array.isArray(ev.contacts) ? ev.contacts.filter(c => c && (c.name || c.phone || c.email)) : [];
    if (contacts.length) {
      const box = el('div', 'gig-contacts');
      contacts.forEach(c => {
        const card = el('div', 'gig-contact');
        const top = el('div', 'gc-top');
        top.append(el('span', 'gc-name', c.name || 'Kontakt'));
        if (c.role) top.append(el('span', 'gc-role', c.role));
        card.appendChild(top);
        const ln = el('div', 'gc-links');
        if (c.phone) { const a = el('a', 'map-btn', '📞 ' + c.phone); a.href = 'tel:' + c.phone.replace(/[^+\d]/g, ''); ln.appendChild(a); }
        if (c.email) { const a = el('a', 'map-btn', '✉️ ' + c.email); a.href = 'mailto:' + c.email; ln.appendChild(a); }
        if (ln.childNodes.length) card.appendChild(ln);
        box.appendChild(card);
      });
      section('Kontakt', contacts.length === 1 ? (contacts[0].name || '1 Kontakt') : `${contacts.length} Kontakte`, box, false);
    }
    const links = Array.isArray(ev.links) ? ev.links.filter(Boolean) : [];
    if (links.length) {
      const box = el('div', 'gig-links');
      links.forEach(u => { const a = el('a', 'gig-link', u.replace(/^https?:\/\//, '').replace(/\/$/, '')); a.href = u; a.target = '_blank'; a.rel = 'noopener'; box.appendChild(a); });
      section('Links', `${links.length}`, box, false);
    }
    // Dokumente – mit Hinzufügen/Entfernen direkt im Gig
    const docs = Array.isArray(ev.docs) ? ev.docs : [];
    const canDocs = canEditGigs();   // nur Admin und Organisation
    {
      const box = el('div', 'gig-docs');
      if (!docs.length) box.appendChild(el('div', 'mnote', 'Noch keine Dokumente.'));
      docs.forEach(dc => box.appendChild(docRow(dc, async e => {
        if (!canDocs) return previewBlocked(e, DOC_DENIED_RM);
        if (viewAs) return previewBlocked();
        const { id, ...rest } = ev;
        try {
          await writeEvent(id, { ...rest, docs: docs.filter(x => x.id !== dc.id), updatedBy: uid, updatedAt: new Date().toISOString() });
          deleteAsset(dc.id); gigsOpen.add(key); flash('Dokument entfernt');
        } catch (e) { flash(friendlyError(e), true); }
      }, !canDocs)));
      {
        const msg = el('div', 'msg');
        const inp = el('input'); inp.type = 'file'; inp.multiple = true; inp.className = 'visually-hidden'; inp.id = 'gd_' + key.replace(/[^a-z0-9]/gi, '_');
        inp.accept = $('evDocFile').accept;
        const lab = el('label', 'btn small ghost doc-add' + (canDocs ? '' : ' pv-locked'), '+ Dokument hinzufügen'); lab.htmlFor = inp.id;
        lab.addEventListener('click', e => {
          if (!canDocs) { e.preventDefault(); return previewBlocked(e, DOC_DENIED); }
          if (viewAs) { e.preventDefault(); previewBlocked(); }
        });
        inp.addEventListener('change', async () => {
          const files = [...(inp.files || [])]; inp.value = '';
          if (!files.length) return;
          const added = await uploadFiles(files, msg);
          if (!added.length) return;
          const { id, ...rest } = ev;
          try {
            await writeEvent(id, { ...rest, docs: [...docs, ...added], updatedBy: uid, updatedAt: new Date().toISOString() });
            gigsOpen.add(key); flash(added.length > 1 ? 'Dokumente hinzugefügt ✓' : 'Dokument hinzugefügt ✓');
          } catch (e) { added.forEach(d => deleteAsset(d.id)); setMsg(msg, friendlyError(e), 'error'); }
        });
        box.append(lab, inp, msg);
      }
      section('Dokumente', docs.length ? String(docs.length) : '', box, false);
      gigDocsOpen(body);
    }
    if (ev.notes) section('Notizen', '', el('div', 'gig-text', ev.notes), false);
    if (ev.repeat && ev.repeat.freq !== 'none') section('Wiederholung', '', el('div', 'gig-text', repeatText(ev.repeat)), false);
    const actions = el('div', 'gig-actions');
    const cal = el('button', 'btn small ghost', 'Im Kalender anzeigen'); cal.type = 'button';
    cal.addEventListener('click', () => { calSel = dOnly(d); calDate = dOnly(d); calView = 'month'; showPage('page2'); });
    // Bearbeiten: nur Admin und Rolle „Organisation“ – sonst gesperrt mit roter Meldung
    const edit = el('button', 'btn small' + (canEditGigs() ? '' : ' pv-locked'), 'Bearbeiten'); edit.type = 'button';
    edit.addEventListener('click', e => {
      if (!canEditGigs()) return previewBlocked(e, GIG_DENIED);
      openEventModal({ ev, occ: d, gigOnly: true });
    });
    // Checkliste: unten neben „Im Kalender anzeigen“
    {
      const linked = !!ev.checklist;
      const st = linked ? clStats(ev, dKey(d)) : null;
      const hidden = levelFor(currentBand, 'page4') === 'hidden';
      const cl = el('button', 'btn small ghost cl-act' + (hidden ? ' pv-locked' : ''), linked ? `☑ Zur Checkliste${st.all ? ` (${st.done}/${st.all})` : ''}` : '☑ Checkliste erstellen'); cl.type = 'button';
      cl.addEventListener('click', e => {
        if (hidden) return previewBlocked(e, 'Keine Berechtigung: Die Registerkarte „Checkliste“ ist für dich ausgeblendet. Bitte den Admin um Zugriff.');
        if (linked) return jumpToChecklist(key, d);
        showPage('page4');
        if (viewAs) return;
        openClNew({ opt: clnPerm('gigAssign') ? null : 'gigAssign', evId: ev.id });
      });
      slSub();
      const linkedSl = slLists.find(l => l.gigId === ev.id), slHid = levelFor(currentBand, 'page6') === 'hidden';
      const sb = el('button', 'btn small ghost' + (!linkedSl || slHid ? ' pv-locked' : ''), '🎼 Zur Setlist'); sb.type = 'button';
      sb.addEventListener('click', e => {
        if (slHid) return previewBlocked(e, 'Keine Berechtigung: Die Registerkarte „Setlist“ ist für dich ausgeblendet. Bitte den Admin um Zugriff.');
        if (!linkedSl) return previewBlocked(e, 'Noch keine Setlist verknüpft. Weise zuerst im Reiter „Setlist“ dieser Setlist den Gig zu.');
        slJump = linkedSl.id; showPage('page6');
      });
      if (!linkedSl) {
        const warn = el('div', 'gig-msg-red', 'Noch keine Setlist verknüpft'), hint = el('div', 'note-info', 'Weise zuerst im Reiter „Setlist“ eine Setlist hinzu.');
        body.prepend(hint); body.prepend(warn);
      }
      ttSub();
      const nTT = (ttMap[ev.id] || { entries: [] }).entries.length, ttHid = levelFor(currentBand, 'page8') === 'hidden';
      const tt = el('button', 'btn small ghost' + (ttHid ? ' pv-locked' : ''), '⏱ Timetable' + (nTT ? ` (${nTT})` : '')); tt.type = 'button';
      tt.addEventListener('click', e => {
        if (ttHid) return previewBlocked(e, 'Keine Berechtigung: Die Registerkarte „Timetable“ ist für dich ausgeblendet. Bitte den Admin um Zugriff.');
        ttSel = ev.id; showPage('page8');
      });
      actions.append(cal, sb, tt, cl, edit);
    }
    body.appendChild(actions);
    card.append(head, body);
    return card;
  }
  function renderGigs() {
    if (gigMembersBand !== currentBand) ensureGigMembers();
    const list = $('gigList'); list.innerHTML = '';
    const today = dOnly(new Date());
    const from = addDays(today, -730), to = addDays(today, 730);
    const all = [];
    calEvents.filter(ev => ev.category === 'auftritt').forEach(ev => occurrences(ev, from, to).forEach(d => all.push({ ev, date: d })));
    const byTime = (a, b) => a.date - b.date || (a.ev.start || '').localeCompare(b.ev.start || '');
    const upcoming = all.filter(x => x.date >= today).sort(byTime);
    const past = all.filter(x => x.date < today).sort((a, b) => -byTime(a, b));
    $('gigCount').textContent = upcoming.length === 1 ? '1 kommender Gig' : `${upcoming.length} kommende Gigs`;
    $('gigAdd').classList.toggle('pv-locked', !canEditCalendar() || !!viewAs);
    if (!upcoming.length) list.appendChild(el('div', 'empty small', 'Keine kommenden Gigs. Erstelle einen Termin mit der Kategorie „Gig“.'));
    // nach Monat gruppieren
    let lastMonth = '';
    upcoming.forEach(it => {
      const m = CAL_MONTHS[it.date.getMonth()] + ' ' + it.date.getFullYear();
      if (m !== lastMonth) { list.appendChild(el('div', 'gig-month', m)); lastMonth = m; }
      list.appendChild(gigCard(it, false));
    });
    if (past.length) {
      const t = el('button', 'gig-past-toggle', (gigsShowPast ? '▾ ' : '▸ ') + `Vergangene Gigs (${past.length})`); t.type = 'button';
      t.addEventListener('click', () => { gigsShowPast = !gigsShowPast; renderGigs(); });
      list.appendChild(t);
      if (gigsShowPast) past.forEach(it => list.appendChild(gigCard(it, true)));
    }
  }
  const GIG_CREATE_DENIED = 'Keine Berechtigung: Bitte eine berechtigte Person bitten, den Gig zu erstellen – oder den Admin, dir das Recht „Bearbeiten“ für Gigs zu geben.';
  $('gigAdd').addEventListener('click', e => {
    if (!canEditCalendar()) return previewBlocked(e, GIG_CREATE_DENIED);
    if (viewAs) return previewBlocked(e);
    openEventModal({ date: new Date(), category: 'auftritt', gigOnly: true });
  });
  $('gigExpand').addEventListener('click', () => gigsExpandAll(true));
  $('gigCollapse').addEventListener('click', () => gigsExpandAll(false));
  function gigsExpandAll(open) {
    const today = dOnly(new Date());
    calEvents.filter(ev => ev.category === 'auftritt').forEach(ev => occurrences(ev, addDays(today, -730), addDays(today, 730)).forEach(d => { const k = ev.id + '|' + dKey(d); if (open) gigsOpen.add(k); else gigsOpen.delete(k); }));
    document.querySelectorAll('#gigList .gig').forEach(g => g.classList.toggle('open', open));
  }


  // ================= Tipps (je nach Seite) =================
  function tipsFor(page) {
    const admin = isAdmin(currentBand), roles = canRoles(currentBand), cal = canEditCalendar();
    const T = (icon, title, text, show = true) => show ? { icon, title, text } : null;
    const t = {
      team: [
        T('👆', 'Mitglieder auf- und zuklappen', 'Tippe auf ein Mitglied, um Rollen, Kontakt und Rechte zu sehen. Oben rechts gibt es „Alle aufklappen“ und „Alle zuklappen“.'),
        T('🔑', 'Einladungscode', 'Kopiere den 6-stelligen Code der Band und gib ihn weiter. Neue Mitglieder geben ihn bei der Registrierung ein.'),
        T('📇', 'Kontaktangaben', 'Beim aufgeklappten Mitglied stehen E-Mail und Telefon – aber nur, wenn die Person sie für diese Band freigegeben hat (in ihren Einstellungen unter „Kontaktangaben“).'),
        T('🎭', 'Rollen zuweisen', 'Im aufgeklappten Mitglied klickst du die passenden Rollen an. Ein Mitglied kann mehrere Rollen haben.', roles),
        T('🧭', 'Rolle „Organisation“', 'Mitglieder mit dieser Rolle dürfen Rollen zuweisen, die verfügbaren Rollen, die Termin-Kategorien und das Bandlogo bearbeiten.', roles),
        T('🔒', 'Eigene Rolle „Organisation“', 'Deine eigene Rolle „Organisation“ kannst du nicht selbst entfernen – das muss der Admin oder ein anderes Mitglied mit „Organisation“ tun.', roles && !admin),
        T('📌', 'Feste Rollen', '„Gründer“ (nur zur Information), „Organisation“ und „Checkliste“ sind immer vorhanden und lassen sich nicht aus der Rollenliste löschen. Unter „Verfügbare Rollen“ steht bei „Rechte der Rollen“, was jede Rolle darf.', roles),
        T('⚖️', 'Rechte der Rollen', 'Unter „Verfügbare Rollen“ steht, was jede Rolle darf. Rollen mit denselben Rechten sind in einer Zeile gebündelt – besondere Rechte haben nur Admin, „Organisation“ und „Checkliste“; alle anderen Rollen dienen zur Information.', roles),
        T('☑️', 'Rolle „Checkliste“', 'Schaltet für das Mitglied „Bearbeiten“ in der Registerkarte „Checkliste“ frei – auch wenn dort sonst „Nur lesen“ oder „Ausgeblendet“ eingestellt ist.', roles),
        T('🔽', 'Fenster zuklappen', 'Ein Klick auf den Titel eines Fensters klappt es zu oder auf. Oben rechts gibt es „Alle aufklappen“ und „Alle zuklappen“. Der Zustand bleibt in diesem Browser gespeichert.'),
        T('🛡️', 'Register-Berechtigungen', 'Pro Mitglied legst du fest, ob es Kalender, Gigs, Checkliste und Finanzen bearbeiten, nur lesen oder gar nicht sehen darf. Finanzen sind ohne Einstellung nur lesbar. „Standard-Berechtigungen“ gelten für alle ohne eigene Einstellung – auch für neue Mitglieder.', admin),
        T('➕', 'Mitglied hinzufügen', 'Lege eine Person mit Namen und Rollen an. Nach dem Speichern bekommt sie einen persönlichen 8-stelligen Code, mit dem sie sich registriert – ihre Rollen werden übernommen.', admin),
        T('➖', 'Mitglied entfernen', 'Im aufgeklappten Mitglied „Aus der Band entfernen“. Die Person sieht die Band danach nicht mehr und kann nur mit einem neuen persönlichen Code wieder beitreten.', admin),
        T('🧨', 'Band auflösen', 'Ganz unten in „Verwaltung“. Zuerst müssen alle einfachen Mitglieder (und offene Einladungen) entfernt sein, dann setzen der Admin und alle mit „Organisation“ ihren OK-Haken. Erst danach lässt sich die Band nach der Rückfrage „Willst du die Band wirklich auflösen?“ endgültig löschen – mit allen Terminen, Gigs, Checklisten und Dokumenten. Ist der Admin nicht erreichbar, hilft der Support (Instagram/TikTok housi_666, Facebook Housi Guntern).', roles),
        T('👁️', 'In eine Rolle schlüpfen', 'Sieh dir die App aus Sicht eines Mitglieds an – auch von noch nicht registrierten. Oben erscheint ein blauer Hinweis; alles ist sichtbar, aber mit 🔒 gesperrt. Ein Klick darauf zeigt eine rote Meldung.', admin),
        T('🎨', 'Termin-Kategorien', 'Lege Namen und Farben der Kategorien fest. Die Farben erscheinen überall im Kalender. „Gig“ ist fest und kann nicht entfernt werden.', roles),
        T('🖼️', 'Bandlogo', 'Lade ein Bild (PNG, JPG, WebP, GIF) oder eine SVG-Vektordatei hoch. Das Logo erscheint oben links für alle Mitglieder.', roles),
        T('🖼️', 'Bandlogo', 'Das Logo der Band siehst du hier und oben links. Ändern dürfen es nur der Admin und Mitglieder mit der Rolle „Organisation“ – sonst erscheint eine rote Meldung.', !roles),
        T('✏️', 'Bandname', 'Den Namen der Band änderst du im Bereich „Band“.', admin),
        T('💾', 'Speichern nicht vergessen', 'Änderungen gelten erst nach „Speichern“. Solange etwas offen ist, steht oben ein oranger Hinweis mit „Speichern“ und „Verwerfen“ – auch wenn du die Seite wechselst.', roles),
      ],
      overview: [
        T('🟢', 'Mitglieder online', 'Unten in der Übersicht siehst du alle Mitglieder, getrennt nach Online, Privat und Offline. Sortieren nach 🔤 Name, 🎖 Rolle (Admin, Organisation, Checkliste, übrige) oder 🕒 Zeit (online seit / zuletzt online). Nochmals klicken oder ↑/↓ dreht die Reihenfolge.'),
        T('🔢', 'Online-Anzeige', 'Unter dem Bandnamen oben links steht, wie viele Mitglieder gerade online sind. Ein Klick führt hierher.'),
        T('🏠', 'Übersicht', 'Hier siehst du auf einen Blick deine Band und deine Rollen.'),
        T('🎸', 'Band wechseln', 'Unten links „Zurück zum Startbildschirm“ – auf der persönlichen Übersicht wählst du eine andere Band.'),
        T('🪟', 'Fenster', 'Die Übersicht zeigt Band, deine Rollen, Uhr & Datum, deinen nächsten Gig, deinen nächsten Termin und deinen nächsten Checklisten-Punkt (was du übernommen hast). Ein Klick auf den Knopf im Fenster springt direkt dorthin. Pack ein Fenster und zieh es an einen anderen Platz – auf dem Handy kurz gedrückt halten. Die Anordnung wird in deinem Profil gespeichert.'),
        T('⚙', 'Anpassen', 'Oben rechts „⚙ Anpassen“: Fenster ein- und ausschalten. Als Info stehen dort die Zeitzone und – wenn du ihn freigibst – dein Standort. Zeitformat, Uhr (digital oder analog) und Datumsformat stellst du in den Einstellungen unter „Uhr & Datum“ ein.'),
        T('🧭', 'Registerkarten', 'Kalender für alle Termine, Gigs für eure Auftritte mit allen Details, Checkliste für Aufgaben rund um Gigs und Termine, Finanzen für Einnahmen und Ausgaben, Verwaltung für Mitglieder, Rollen und Rechte.'),
      ],
      page2: [
        T('📤', 'Export', '„⤓ Exportieren“ oben öffnet das Export-Fenster: Kalenderdatei (.ics) für Handy, Google oder Outlook, dazu PDF und CSV. Enthalten sind die Termine von 90 Tagen zurück bis ein Jahr voraus.'),
        T('🗓️', 'Ansicht wählen', 'Oben zwischen Tag, Woche, Monat und Jahr umschalten – antippen oder die Markierung mit dem Finger seitlich schieben – oder mit den Tasten D, W, M und J. Die zuletzt gewählte Ansicht bleibt gespeichert.'),
        T('↔️', 'Blättern', 'Mit den Pfeilen ‹ ›, den Pfeiltasten ← → oder seitlich über den Kalender wischen. „Heute“ (Taste T) springt zurück.'),
        T('📅', 'Jahresansicht', 'Ein Klick wählt einen Tag aus – unten siehst du seine Termine. Ein Doppelklick auf einen Tag oder einen Monat öffnet den Monat.'),
        T('🌈', 'Farbige Tage', 'In der Jahresansicht sind Tage mit Terminen in der Farbe ihrer Kategorie eingefärbt. Wechselt die Farbe langsam, gibt es an diesem Tag Termine aus mehreren Kategorien.'),
        T('🗂️', 'Monatsansicht', 'Termine stehen als farbige Einträge im Tag. Ein Klick auf einen Tag wählt ihn aus – unten siehst du seine Termine. Ein Doppelklick auf den Tag oder ein Klick auf die Kalenderwoche (KW) öffnet die Woche; ein Klick auf einen Termin öffnet ihn.'),
        T('📆', 'Tagesansicht', 'Zeigt einen Tag von 00:00 bis 24:00 Uhr – pro Kategorie eine eigene Spalte, von links nach rechts nach der frühesten Uhrzeit sortiert. Bei Gigs erscheint automatisch der Zeitplan – Get In, Aufbau, Soundcheck, Linecheck und Gig – als einzelne Abschnitte. Ein Klick auf einen Abschnitt öffnet den Gig. Mit ‹ › blätterst du Tag für Tag (Taste D öffnet die Tagesansicht).'),
        T('🔍', 'Zoomen', 'In der Tages- und Wochenansicht zoomst du mit den Knöpfen − und + oben (ein Klick auf die Prozentzahl setzt zurück), mit Shift + Mausrad oder auf dem Handy mit zwei Fingern: senkrecht auseinanderziehen macht die Stunden höher, waagrecht die Wochentage breiter. Der Kalender selbst bleibt gleich gross – gezoomt wird nur der Inhalt, darin scrollst du. Die Uhrzeit unter dem Mauszeiger bleibt dabei an ihrem Platz; die Zoomstufe bleibt in diesem Browser gespeichert.'),
        T('⏰', 'Wochenansicht', 'Zeigt die ganze Woche – auch auf dem Handy passen alle 7 Tage in die Breite – und den ganzen Tag von 00:00 bis 24:00 Uhr. Termine stehen zur richtigen Uhrzeit, ganztägige oben. Die rote Linie zeigt die aktuelle Uhrzeit. Ein Klick auf einen Wochentag wählt ihn aus, ein Doppelklick öffnet die Tagesansicht.'),
        T('🖱️', 'Schnell erstellen', 'In der Tages- und Wochenansicht: Doppelklick auf eine Uhrzeit erstellt dort einen neuen Termin.', cal),
        T('➕', 'Termin erstellen', '„+ Termin“ oben oder „+ Termin an diesem Tag“ unten. Wähle Titel, Kategorie, Datum, Zeit (oder ganztägig), Ort und Notizen. Bei der Kategorie „Gig“ kommen Zeitplan, Verpflegung, Kontakt, Links und Dokumente dazu.', cal),
        T('☑️', 'Checkliste', 'Im Fenster „Termin erstellen“ bzw. „Bearbeiten“ schaltet der Haken „Checkliste“ eine Checkliste für diesen Termin oder Gig frei. Sie erscheint dann in der Registerkarte „Checkliste“. Rote Einträge mit ⏰ sind Deadlines von Checklisten – ein Klick springt zur Checkliste.', cal),
        T('↻', 'Wiederholen', 'Täglich, wöchentlich (mit Wochentagen), monatlich oder jährlich – mit eigenem Abstand wie „alle 2 Wochen“. Endet nie, an einem Datum oder nach einer Anzahl Terminen.', cal),
        T('🗑️', 'Löschen', 'Bei wiederkehrenden Terminen wählst du „Nur diesen Termin“ oder „Ganze Serie“. Änderungen an einer Serie gelten für alle Termine.', cal),
        T('👀', 'Nur ansehen', 'Du hast für den Kalender nur Leserechte – Termine kannst du öffnen, aber nicht ändern.', !cal),
      ],
      page3: [
        T('📤', 'Export', '„⤓ Exportieren“ oben öffnet das Export-Fenster: alle Gigs als Kalenderdatei (.ics), PDF oder CSV.'),
        T('🎤', 'Alle Gigs', 'Hier stehen alle Termine der Kategorie „Gig“ einzeln, nach Monaten sortiert. Wiederkehrende Gigs erscheinen mit jedem Datum.'),
        T('👆', 'Auf- und zuklappen', 'Tippe auf einen Gig für Zeitplan, Location, Kontakt, Links, Dokumente und Notizen. Oben gibt es „Alle aufklappen“ und „Alle zuklappen“.'),
        T('⏳', 'Countdown', 'Rechts siehst du, wann der Gig ist – „Heute“, „Morgen“ oder „in X Tagen“.'),
        T('🗓️', 'Im Kalender anzeigen', 'Springt direkt zum Tag des Gigs im Kalender. In der Tagesansicht siehst du dort den ganzen Zeitplan.'),
        T('✏️', 'Bearbeiten', 'Gigs ändern oder löschen dürfen nur der Admin und Mitglieder mit der Rolle „Organisation“. Für alle anderen ist „Bearbeiten“ gesperrt (🔒).'),
        T('➕', 'Gig erstellen', '„Gig erstellen“ legt einen neuen Gig an – hier sind nur Gigs möglich. Der Zeitplan hat Get In, Aufbau, Soundcheck, Linecheck, Gig und Gig Ende; dazu Location & Anfahrt, Verpflegung, Kontakt, Links, Notizen und der Haken „Checkliste“ – alles in klappbaren Abschnitten.', cal),
        T('📂', 'Abschnitte', 'Im aufgeklappten Gig sind Zeitplan, Location & Anfahrt, Verpflegung, Kontakt, Links, Notizen und Wiederholung einzeln auf- und zuklappbar.'),
        T('☑️', 'Checkliste', 'Unten im aufgeklappten Gig, neben „Im Kalender anzeigen“: „☑ Zur Checkliste (2/5)“ springt zur Checkliste. Ist noch keine verknüpft, heisst der Knopf „☑ Checkliste erstellen“ und öffnet die Registerkarte „Checkliste“ mit diesem Gig bereits ausgewählt.'),
        T('📞', 'Kontakt', 'Im Abschnitt „Kontakt“ stehen die Ansprechpersonen des Gigs mit Funktion. Telefon und E-Mail sind direkt anklickbar zum Anrufen oder Mailen. Kontakte trägst du beim Erstellen oder Bearbeiten des Gigs ein.'),
        T('📎', 'Dokumente', 'Im Abschnitt „Dokumente“ eines Gigs öffnet ein Klick auf den Namen die Datei. Hinzufügen (PDF, Bilder, Text, CSV, Video – max. 20 MB) und Entfernen dürfen nur der Admin und Mitglieder mit der Rolle „Organisation“.'),
        T('🗺️', 'Adresse & Karte', 'Unter „Location & Anfahrt“ öffnet „In Google Maps öffnen“ den Ort (eigener Maps-Link oder automatisch aus Location und Adresse); „Route planen“ startet die Navigation.'),
        T('🕰️', 'Vergangene Gigs', 'Ganz unten aufklappbar unter „Vergangene Gigs“.'),
      ],
      page4: [
        T('📤', 'Export', '„⤓ Exportieren“ oben öffnet das Export-Fenster: kommende Checklisten und solche ohne Datum als PDF zum Abhaken, als Text oder CSV.'),
        T('⠿', 'Reihenfolge', 'Pack einen Reiter (an seiner Kopfzeile) oder einen Unterreiter und zieh ihn an eine andere Stelle – wie bei den Registerkarten. Auf dem Handy kurz gedrückt halten, dann ziehen. Die Reihenfolge gilt nur für dich, die anderen sehen ihre eigene. Verschieben ist nur bei der Sortierung „Manuell“ eingeblendet.'),
        T('⇅', 'Sortieren', 'Oben rechts über „⇅“ wählst du, wie Checklisten, Reiter und Unterreiter für dich geordnet werden: Persönlicher Status, Bandstatus, Termin (kommende zuerst), Alphabet oder Manuell. „Auf … anwenden“ gilt nur für diese Band, „Auf alle Bands anwenden“ überall. Es gilt immer die zuletzt getroffene Wahl – hier oder in den Einstellungen. Bist du nur in einer Band, führt „Zu deinen Bands“ zum Beitreten oder Gründen einer weiteren.'),
        T('➕', 'Checkliste erstellen', 'Oben „Checkliste erstellen“ (oder unten bei einem Gig): einem bestehenden Gig oder Termin zuweisen, einen neuen Gig oder Termin mit Checkliste anlegen – oder nur eine Checkliste erstellen, auf Wunsch mit Deadline.'),
        T('⏰', 'Deadline', 'Eine eigenständige Checkliste kann eine Deadline haben (Datum, optional Uhrzeit). Sie erscheint rot im Kalender – ein Klick darauf springt zur Checkliste. „Bearbeiten“ ändert Name und Deadline oder löscht die Checkliste.'),
        T('☑️', 'Checkliste freischalten', 'Hier erscheinen alle Termine und Gigs, bei denen im Kalender beim Erstellen oder Bearbeiten der Haken „Checkliste“ gesetzt ist. Rechts siehst du den Stand, z. B. „3/5“.'),
        T('✅', 'Checkliste', 'Jeder freigeschaltete Termin oder Gig hat eine eigene Checkliste mit Reitern (z. B. „Technik“) und Unterreitern (z. B. „Gitarrenkabel“). Ein Reiter mit Unterreitern wird automatisch abgehakt, sobald alle Unterreiter erledigt sind. Alle Mitglieder dürfen Reiter und Unterreiter erstellen und die selbst erstellten bearbeiten und löschen. Der Admin und die Organisation dürfen alle ändern.'),
        T('🙋', 'Ich erledige das', roles ? 'Mit „Ich erledige das“ übernimmst du einen Reiter oder Unterreiter selbst. Über das Klappmenü „Mitglieder zuweisen“ hakst du Mitglieder an oder ab – auch solche, die sich noch nicht registriert haben. Mit ✕ entfernst du sie ebenfalls. Abhaken dürfen eingetragene Personen, der Admin und die Organisation.' : 'Mit „Ich erledige das“ übernimmst du einen Reiter oder Unterreiter, mit ✕ trägst du dich wieder aus. Andere Mitglieder können nur der Admin oder die Organisation eintragen. Abhaken kannst du, wo du eingetragen bist oder was du selbst erstellt hast.'),
        T('🎤', 'Zum Gig', 'Bei Gigs springt „Zum Gig“ in die Registerkarte „Gigs“ und klappt den passenden Gig auf. „Im Kalender anzeigen“ springt zum Tag im Kalender.'),
        T('👀', 'Nur lesen', 'Du hast für die Checkliste nur Leserechte – du siehst alles, kannst aber nichts ändern.', levelFor(currentBand, 'page4') === 'read'),
        T('🕰️', 'Vergangene', 'Checklisten vergangener Termine sind ganz unten unter „Vergangene“ aufklappbar.'),
      ],
      page6: [
        T('🎼', 'Setlists', 'Die Seite zeigt alle Setlists der Band als Karten. Ein Klick öffnet die Setlist mit ihren Songs. Oben sortierst du nach Name, Gig-Datum, Dauer, Anzahl Songs oder zuletzt geändert.'),
        T('➕', 'Elemente', '„Song hinzufügen oder erstellen“, dazu Intro, Outro, Zwischenteil, Pause und Ansage. Am Griff ⠿ verschiebst du, ein Klick auf das Element bearbeitet es. Mit Beginn-Uhrzeit siehst du pro Element die Zeit, mit Soll-Länge die Abweichung.'),
        T('⚠️', 'Doppelwarnung', 'Kommt ein Titel doppelt vor, wird der Knopf rot. Ein Klick schaltet die Warnung aus („KEINE WARNUNG“); bei einem neuen doppelten Titel erscheint sie wieder. Ausnahmen (Intro, Break …) stellt der Admin in der Verwaltung ein.'),
        T('📤', 'Export', '„⤓ Exportieren“ oben öffnet das Export-Fenster: PDF, Drucken (grosse Schrift für die Bühne), Word, Text, CSV oder JSON. Jedes Format sagt kurz, wofür es gut ist.'),
        T('🎤', 'Bühnenmodus', 'Unten „Bühnenmodus“: Vollbild mit grosser Schrift. Play, Pause und Stopp steuern die Uhr (Eintrag und ganzes Set); Leertaste = Play/Pause, S = Stopp, Pfeile oder Wischen schalten weiter.'),
        T('📥', 'Import', '„JSON importieren“ in der Übersicht aller Setlists liest eine StageMate-Sicherung als neue Setlist ein.'),
        T('↩️', 'Zurück', 'Unten rechts „Zurück“ oder oben ‹ führt zur vorherigen Seite.'),
      ],
      page7: [
        T('🎵', 'Songs', 'Alle Songs der Band an einem Ort: Titel, Interpret, Veröffentlichung (Album, EP oder Single mit Name, Pflicht), Jahr, Genre, Länge, Tonart, BPM. Mit „+ Neuer Song“ legst du einen an.'),
        T('⇅', 'Suchen und sortieren', 'Oben suchst du und sortierst nach Titel, Interpret, Album, Jahr, Genre oder Länge.'),
        T('➡️', 'In die Setlist', 'Auf der Seite „Setlist“ übernimmst du Songs mit „Song hinzufügen oder erstellen“.'),
        T('📤', 'Export', '„⤓ Exportieren“ oben öffnet das Export-Fenster: Songliste als PDF oder CSV.'),
      ],
      page8: [
        T('⏱️', 'Timetable', 'Der Ablauf der Band an einem Gig-Tag: Uhrzeit und Titel, z. B. Get In, Soundcheck, Essen, Auftritt, Abbau. Oben wählst du den Gig.'),
        T('➕', 'Einträge', '„+ Eintrag“ öffnet das Eingabefenster. Pflicht sind Bandname und Startzeit; Ende oder Dauer, Songzahl und Setlist sind optional. Mit „Import“ liest du eine Textdatei (Zeile „19:00 - 19:45 Bandname“) oder CSV (Uhrzeit;Band;Ende;Dauer;Songs;Notiz) ein.'),
        T('📅', 'Kalender', 'In der Tagesansicht des Kalenders blendet der Knopf „Timetable“ die Einträge des Gigs ein oder aus.'),
        T('📤', 'Export', '„⤓ Exportieren“ oben öffnet das Export-Fenster: PDF, Text oder CSV.'),
      ],
      page5: [
        T('💰', 'Finanzen', 'Hier erfasst ihr Einnahmen und Ausgaben der Band. Oben siehst du Einnahmen, Ausgaben und den Saldo des gewählten Jahres, darunter die Aufteilung nach Kategorie.'),
        T('➕', 'Eintrag erfassen', '„+ Einnahme“ oder „− Ausgabe“: Betrag in CHF, Datum, optional die Zeit, Bezeichnung, Kategorie, optional einen Gig verknüpfen und eine Notiz. Ein Klick auf einen Eintrag öffnet ihn zum Bearbeiten oder Löschen.', finCanEdit()),
        T('📅', 'Jahr wählen', 'Oben links wählst du das Jahr. Die Einträge sind nach Monat gruppiert, die neusten oben.'),
        T('📤', 'Export', '„⤓ Exportieren“ oben öffnet das Export-Fenster: PDF mit Summen oder CSV für Excel, jeweils für das gewählte Jahr. Der Dateiname enthält Band und Jahr.'),
        T('🔒', 'Rechte', 'Ohne besondere Einstellung dürfen Mitglieder die Finanzen nur ansehen. Bearbeiten kann, wer vom Admin unter „Verwaltung“ das Recht „Bearbeiten“ für Finanzen bekommt – der Admin selbst immer.'),
        T('👀', 'Nur lesen', 'Du hast für die Finanzen nur Leserechte – du siehst alles, kannst aber nichts ändern.', !finCanEdit()),
      ],
      profile: [
        T('🎸', 'Zu deinen Bands', 'Bist du nur in einer Band, führt „Zu deinen Bands“ im Sortiermenü der Checkliste hierher – der Bereich zum Beitreten oder Gründen leuchtet kurz auf.'),
        T('🖼️', 'Profilbild', 'Bild hinzufügen, ändern oder löschen. Es wird zugeschnitten und erst mit „Speichern“ übernommen. Ob andere es sehen, stellst du unter Einstellungen → Sichtbarkeit ein.'),
        T('👤', 'Persönliche Angaben', 'Nickname, Vorname, Nachname und Telefon. In der Web-Version fragt StageMate beim Speichern nach deinem Passwort. Der Nickname muss eindeutig sein.'),
        T('🆔', 'PUID', 'Deine feste ID. „PUID anzeigen“ blendet sie ein, ein zweiter Klick wieder aus.'),
        T('🔽', 'Bereiche zuklappen', 'Ein Klick auf „Persönliche Angaben“ oder „Weitere Band hinzufügen“ klappt den Bereich zu oder auf.'),
        T('👁', 'Sichtbarkeit', '„Sichtbarkeitseinstellungen“ unten im Profil führt direkt zu allen Sichtbarkeiten in den Einstellungen.'),
        T('📜', 'Rechtliches', 'Nutzungsbedingungen und Datenschutzerklärung findest du unten im Profil und in den Einstellungen.'),
        T('🔐', 'Konto', 'Web-Version: Passwort ändern oder Konto löschen. Gründer/Admins lösen vorher ihre Band auf.'),
        T('🎭', 'Rollen', 'Deine Rollen legen der Admin und Mitglieder mit „Organisation“ fest – im Profil werden sie nicht geändert.'),
        T('🎸', 'Weitere Band', '„Band beitreten“ mit dem Band-Code (6 Zeichen) oder deinem persönlichen Code (8 Zeichen) – oder „Neue Band gründen“. Wer gründet, ist Admin.'),
        T('💾', 'Speichern', 'Offene Änderungen zeigt der orange Hinweis oben – dort kannst du speichern oder verwerfen.'),
      ],
      home: [
        T('🏠', 'Persönliche Übersicht', 'Hier landest du nach dem Anmelden. Sie gehört nur dir: keine Seitenleiste, keine Band. Oben die Kopfzeile mit Uhr, Tipps, Support und Abmelden.'),
        T('🎸', 'Band öffnen', 'Die Bandseite öffnest du nur hier: Klick auf eine Band unter „Deine Bands“. Die zuletzt geöffnete steht zuoberst.'),
        T('🧩', 'Anzeigen verschieben', 'Jede Anzeige (Bands, nächster Gig, Termine, Checklisten-Punkte, Profil, Einstellungen) hat links oben einen Griff ⠿. Packen und an einen anderen Platz ziehen – die anderen rücken sanft nach, Lücken werden automatisch nach oben geschlossen. Die Anordnung bleibt in diesem Browser gespeichert; „Anordnung zurücksetzen“ stellt die Grundaufteilung wieder her.'),
        T('⚡', 'Springe zu', 'Direkt zur Gig-, Termin-, Setlist- oder Checklisten-Seite einer Band springen: Band wählen (bei mehreren Bands), dann öffnet sich die passende Seite.'),
        T('🎤', 'Dein nächster Gig', 'Zeigt den nächsten Gig aus allen deinen Bands (bis ein Jahr voraus) mit Countdown, Ort und Zeitplan. „Gig öffnen“ springt direkt zum Gig in der Band.'),
        T('📅', 'Deine Termine', '„Deine nächsten Termine“ zeigt Gigs und Termine aller deiner Bands der nächsten 60 Tage. Ein Klick öffnet den Termin in der Band.'),
        T('☑️', 'Deine Checklisten-Punkte', 'Alle offenen Punkte, die du in irgendeiner Band übernommen hast – mit Band, was und wann.'),
        T('➕', 'Band beitreten, gründen, suchen', 'Unter „Deine Bands“: „Band beitreten“ mit Code, „Band gründen“ oder „Band suchen“ nach Name oder Tag.'),
        T('🟣', 'Dein Status', 'Oben rechts wählst du deinen Status: Automatisch (hier Privat, auf der Bandseite Online), Online, Privat oder Offline. Hier auf der Übersicht bist du in keiner Band online.'),
        T('👤', 'Profil und Einstellungen', 'Gibt es nur hier auf der persönlichen Übersicht – nicht auf der Bandseite.'),
        T('↩️', 'Zurück hierher', 'Auf einer Bandseite führt „Zurück zum Startbildschirm“ unten links wieder hierher. So wechselst du die Band.'),
      ],
      settings: [
        T('🔽', 'Fenster zuklappen', 'Ein Klick auf den Titel eines Bereichs klappt ihn zu oder auf. Oben rechts gibt es „Alle aufklappen“ und „Alle zuklappen“. Der Zustand bleibt in diesem Browser gespeichert.'),
        T('🖕', 'Mauszeiger', 'Wähle Mittelfinger, Zeigefinger, Rockhand, Fadenkreuz oder den normalen Mauszeiger. Die Wahl wird sofort angezeigt und gilt nach dem Speichern für diesen Browser. Der gewählte Zeiger bleibt überall gleich – auch über Knöpfen und Registerkarten; in Eingabefeldern bleibt der Text-Cursor.'),
        T('🕒', 'Uhr & Datum', 'Zeitformat (24 oder 12 Stunden), Uhr (digital oder analog) und Datumsformat für die Übersicht. Die Zeitzone wird vom Gerät übernommen.'),
        T('👁', 'Sichtbarkeit', 'Alle persönlichen Sichtbarkeiten an einem Ort: Profilbild (aus = andere sehen es verschwommen mit Schloss) und pro Band E-Mail und Telefon. Logo, Name und Tag der Band stellt der Admin unter „Verwaltung → Band“ ein – auf einer Bandseite führt „Zur Verwaltung“ direkt dorthin.'),
        T('📜', 'Rechtliches', 'Ganz unten: Nutzungsbedingungen und Datenschutzerklärung.'),
        T('⇅', 'Checkliste sortieren', 'Ordnet Checklisten, Reiter und Unterreiter für dich: nach persönlichem Status, Bandstatus, Termin (kommende zuerst), Alphabet oder manuell. Gilt nach dem Speichern für alle Bands – bis du in der Registerkarte „Checkliste“ über „⇅“ später für eine Band eine eigene wählst. Bands mit eigener Sortierung stehen darunter und lassen sich „zurücksetzen“. Nur bei „Manuell“ kannst du Reiter selbst verschieben.'),
        T('🌓', 'Darstellung', 'Hell, Dunkel oder Automatisch (folgt der Einstellung deines Geräts). Die Wahl wird gleich als Vorschau angezeigt und gilt nach dem Speichern für diesen Browser.'),
        T('💾', 'Speichern', 'Änderungen in den Einstellungen gelten erst nach „Speichern“ – wie in der Verwaltung. Solange etwas offen ist, steht oben ein oranger Hinweis mit „Speichern“ und „Verwerfen“, auch wenn du die Seite wechselst.'),
      ],
    };
    const names = { home: 'Startbildschirm', team: 'Verwaltung', overview: 'Übersicht', page2: 'Kalender', page3: 'Gigs', page4: 'Checkliste', page5: 'Finanzen', page6: 'Setlist', page7: 'Songs', page8: 'Timetable', profile: 'Profil & Bands', settings: 'Einstellungen' };
    return { name: names[page] || 'diese Seite', list: (t[page] || []).filter(Boolean) };
  }
  function infoTop(text) {
    let n = $('infoTop'); if (!n) { n = el('div', 'info-top'); n.id = 'infoTop'; document.body.appendChild(n); }
    n.textContent = text; n.classList.add('show'); clearTimeout(infoTop.t); infoTop.t = setTimeout(() => n.classList.remove('show'), 3500);
  }
  function openTips() {
    $('tipsTitle').textContent = 'Tipps';
    const body = $('tipsBody'); body.innerHTML = '';
    body.append(el('div', 'note-info tips-ai', '🤖 Dieses Tool wurde mit Claude (KI) erstellt.'));
    const tools = el('div', 'fold-tools tips-tools');
    const tut = el('button', 'btn small ghost pv-locked tut-btn', '🔒 Tutorial'); tut.type = 'button';
    tut.addEventListener('click', () => infoTop('Tutorials sind für die Prerelease-Phase (v0.9.0) geplant.'));
    tools.append(tut);
    const allOpen = el('button', 'linkish-btn', 'Alle aufklappen'), allClose = el('button', 'linkish-btn', 'Alle zuklappen');
    [allOpen, allClose].forEach(x => { x.type = 'button'; });
    allOpen.addEventListener('click', () => body.querySelectorAll('details').forEach(d => { d.open = true; }));
    allClose.addEventListener('click', () => body.querySelectorAll('details').forEach(d => { d.open = false; }));
    tools.append(allOpen, allClose); body.append(tools);
    const cat = (title, icon, items, open) => {
      const d = el('details', 'tips-cat'); d.open = !!open;
      const sm = el('summary'); sm.append(el('span', 'tc-ico', icon), el('span', 'tc-t', title), el('span', 'tc-n', String(items.length)));
      const inner = el('div', 'tc-body');
      items.forEach(it => {
        const row = el('div', 'tip');
        row.append(el('div', 'tip-ico', it.icon));
        const tx = el('div'); tx.append(el('div', 'tip-title', it.title), el('div', 'tip-text', it.text));
        row.appendChild(tx); inner.appendChild(row);
      });
      d.append(sm, inner); body.append(d);
    };
    const ICONS = { home: '🏠', overview: '🧭', team: '👥', page2: '📅', page3: '🎤', page4: '☑️', page5: '💰', page6: '🎼', page7: '🎵', page8: '⏱️', profile: '👤', settings: '⚙️' };
    const cur = tipsFor(currentPage);
    cat('Diese Seite: ' + cur.name, '📍', cur.list.length ? cur.list : [{ icon: 'ℹ️', title: 'Keine Tipps', text: 'Für diese Seite gibt es noch keine Tipps.' }], true);
    const pages = inHub ? ['home', 'profile', 'settings'] : ['home', 'overview', 'team', 'page2', 'page3', 'page4', 'page5', 'page6', 'page7', 'page8', 'profile', 'settings'];
    pages.filter(p => p !== currentPage).forEach(p => { const t = tipsFor(p); if (t.list.length) cat(t.name, ICONS[p], t.list, false); });
    const general = [
      { icon: '🗂️', title: 'Registerkarten zuklappen', text: 'Über den Registerkarten steht „Registerkarten ▾“ – ein Klick klappt die Liste zu oder auf. Der Zustand bleibt in diesem Browser gespeichert.' },
      { icon: '↕️', title: 'Registerkarten sortieren', text: 'Halte eine Registerkarte in der Seitenleiste gedrückt und ziehe sie an die gewünschte Stelle. Die Reihenfolge wird in deinem Profil gespeichert.' },
      { icon: '🎸', title: 'Band wechseln', text: 'Unten links „Zurück zum Startbildschirm“ – dort wählst du eine andere Band, trittst einer weiteren bei oder gründest eine.' },
      { icon: '🕒', title: 'Uhr und Datum', text: 'Auf der Bandseite oben links unter dem Bandnamen, auf der persönlichen Übersicht in der Kopfzeile laufen Uhr und Datum (tt.mm.jj, mm.tt.jj oder jj.mm.tt). Format und Uhr (digital oder analog) stellst du unter Einstellungen → Uhr & Datum ein.' },
      { icon: '🟢', title: 'Online-Anzeige', text: 'Unter dem Bandnamen steht, wie viele Mitglieder gerade online sind. Ein Klick öffnet die Übersicht mit allen Mitgliedern.' },
      { icon: '◀️', title: 'Seitenleiste einklappen', text: 'Ganz unten „Einklappen“ – dann bleiben nur die Symbole sichtbar.' },
      { icon: '📱', title: 'Auf dem Handy', text: 'Vom linken Rand nach rechts wischen öffnet die Seitenleiste, nach links wischen oder daneben tippen schliesst sie. Solange sie offen ist, ist der Rest gesperrt.' },
      { icon: '💡', title: 'Tipps', text: 'Der Knopf „Tipps“ (auf der Bandseite unten links, auf der persönlichen Übersicht oben in der Kopfzeile) zeigt immer die Tipps zur Seite, auf der du gerade bist.' },
      { icon: '⚙️', title: 'Einstellungen', text: 'Auf der persönlichen Übersicht: Darstellung (Hell, Dunkel, Automatisch), Mauszeiger, Uhr & Datum, Sichtbarkeit und die Sortierung der Checkliste.' },
      { icon: '🟣', title: 'Status', text: 'Oben rechts: Automatisch (Übersicht = Privat, Bandseite = Online), Online, Privat oder Offline. Bei „Offline“ sehen dich deine Bands als offline.' },
      { icon: '🚧', title: 'Alpha', text: 'StageMate ist in der Alpha-Phase und verändert sich laufend. Geplant: Beta ab 0.7.0, Prerelease ab 0.9.0, Release mit 1.0.0. Die Versionsnummer steht ganz unten links; der Hinweis erscheint auf dem Anmeldebildschirm und lässt sich über das Abzeichen „Alpha“ wieder öffnen.' },
      { icon: '💡', title: 'Vorschau', text: 'Bei Uhr & Datum, Profilbild, Kontaktangaben, Band-Sichtbarkeit und Band-Tag steht eine kleine Glühbirne. Darüberfahren oder antippen zeigt, wie es aussehen wird.' },
      { icon: '⏪', title: 'Vor und Zurück', text: 'Oben links neben dem Seitentitel: ‹ führt zur vorherigen Seite, › wieder vorwärts – wie im Browser.' },
      { icon: '🔤', title: 'Zeichen in Texten', text: 'In Namen, Titeln und Notizen sind Emojis nicht erlaubt; beim Versuch erscheint oben eine rote Meldung. Nötigenfalls Sonderzeichen wie - / & + verwenden. Umlaute (Ä Ö Ü) funktionieren überall, auch in Word-, PDF- und Textexporten.' },
      { icon: '💬', title: 'Support', text: 'Unten links „Support“ öffnet ein Fenster mit den Links zu Instagram und TikTok (housi_666) – für Fragen, Probleme oder Ideen.' },
      { icon: '🔍', title: 'Bilder gross ansehen', text: 'Ein Klick auf ein Profilbild oder Bandlogo zeigt es gross an. Verborgene Bilder sind verschwommen und mit einem Schloss markiert.' },
      { icon: '🙈', title: 'Profilbild verbergen', text: 'Unter Einstellungen → Sichtbarkeit „Profilbild für andere sichtbar“ ausschalten. Andere sehen dann nur noch ein verschwommenes Bild mit Schloss.' },
      { icon: '💰', title: 'Finanzen', text: 'Einnahmen und Ausgaben der Band erfassen (Gage, Merch, Proberaum …), pro Jahr mit Summen und CSV-Export. Bearbeiten dürfen Admin und Mitglieder mit der Rolle „Finanzen“; alle anderen sehen nur.' },
      { icon: '🏠', title: 'Ablauf', text: 'Anmelden → persönliche Übersicht → Band wählen → Bandseite. Über „Zurück zum Startbildschirm“ kommst du wieder auf die Übersicht.' },
      { icon: '📝', title: 'Changelog', text: 'Neben „Nutzungsbedingungen“ und „Datenschutz“ öffnet „Changelog“ alle Änderungen – verschachtelt nach Version (0 → 0.3 → v0.3.6), jede Version einzeln aufklappbar.' },
      { icon: '👁', title: 'Passwort ansehen', text: 'Das Auge im Passwortfeld gedrückt halten – solange du drückst, siehst du das Passwort im Klartext.' },
      { icon: '🔐', title: 'Konto', text: 'Web-Version: Auf der persönlichen Übersicht unter „Profil“ → „Konto“ änderst du dein Passwort oder löschst dein Konto. Gründer/Admins lösen vorher ihre Band auf.' },
      { icon: '📜', title: 'Nutzungsbedingungen & Datenschutz', text: 'Findest du im Profil, in den Einstellungen, auf der Anmeldeseite und im Support-Fenster. Bei einer neuen Fassung musst du sie beim nächsten Anmelden erneut akzeptieren.' },
    ];
    cat('Allgemein', '💡', general, false);
    $('tipsModal').classList.remove('hidden');
  }
  $('tipsBtn').addEventListener('click', openTips);
  $('supportBtn').addEventListener('click', () => $('supportModal').classList.remove('hidden'));
  $('supportClose').addEventListener('click', () => $('supportModal').classList.add('hidden'));
  $('supportModal').addEventListener('click', e => { if (e.target === $('supportModal')) $('supportModal').classList.add('hidden'); });
  $('tipsClose').addEventListener('click', () => $('tipsModal').classList.add('hidden'));
  $('tipsModal').addEventListener('click', e => { if (e.target === $('tipsModal')) $('tipsModal').classList.add('hidden'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('tipsModal').classList.add('hidden'); });


  // ================= Abmelden / Seitenleiste =================
  $('logoutBtn').addEventListener('click', async () => {
    ls.sdel('bandLoggedIn'); ls.sdel('smView');
    stopPresence(); inHub = false; $('app').classList.remove('hub-mode'); placeUI('pages');
    if (await Data.signOut()) return;   // Web-Version: Konto abmelden, Seite lädt neu
    hideBandsOverview();
    viewAs = null; renderViewAs();
    discardDraft(); setDraft = null; applyTheme(); applyCursor();
    tipsHintDone = false;   // beim nächsten Anmelden erscheint der Tipps-Hinweis wieder
    $('app').classList.add('hidden');
    $('auth').classList.remove('hidden');
    currentPage = 'overview';
    $('registerSlot').appendChild(form);
    prepareForm();
    showTab('login');
  });

  const sidebar = $('sidebar');
  // Handy: Seitenleiste liegt über dem Inhalt. Ist sie offen, ist der Inhalt gesperrt;
  // ein Tippen daneben klappt sie wieder ein.
  const mobileMq = window.matchMedia ? matchMedia('(max-width: 760px)') : { matches: false };
  const isMobile = () => !!mobileMq.matches;
  // Handy: drei Stufen – 'open' (offen), 'icons' (nur Symbole), 'hidden' (ganz weg, nur ein Pfeil am Rand)
  function syncSidebar() {
    const mob = isMobile();
    if (!mob) $('app').classList.remove('side-hidden');
    $('app').classList.toggle('side-open', mob && !inHub && !sidebar.classList.contains('collapsed'));
    const t = $('toggle'), lbl = t.querySelector('.label');
    const txt = mob && sidebar.classList.contains('collapsed') ? 'Ganz ausblenden' : 'Einklappen';
    if (lbl) lbl.textContent = txt;
    t.title = mob && sidebar.classList.contains('collapsed') ? 'Seitenleiste ganz ausblenden (Pfeil am linken Rand holt sie zurück)' : 'Seitenleiste ein-/ausklappen';
  }
  const mobState = () => $('app').classList.contains('side-hidden') ? 'hidden' : sidebar.classList.contains('collapsed') ? 'icons' : 'open';
  function setMobState(st) {
    sidebar.classList.toggle('collapsed', st !== 'open');
    $('app').classList.toggle('side-hidden', st === 'hidden');
    if (st !== 'open') $('bandSwitchWrap').classList.remove('open');
    ls.set('sideMobile', st === 'hidden' ? 'hidden' : 'icons');
    syncSidebar();
  }
  function setCollapsed(c) {
    if (isMobile()) return setMobState(c ? (mobState() === 'hidden' ? 'hidden' : 'icons') : 'open');
    sidebar.classList.toggle('collapsed', c);
    ls.set('sidebarCollapsed', c ? '1' : '0');
    if (c) { $('bandSwitchWrap').classList.remove('open'); }
    syncSidebar();
  }
  function applyMobileStart() { if (isMobile()) setMobState(ls.get('sideMobile') === 'hidden' ? 'hidden' : 'icons'); }
  if (isMobile()) applyMobileStart(); else if (ls.get('sidebarCollapsed') === '1') sidebar.classList.add('collapsed');
  syncSidebar();
  $('toggle').addEventListener('click', () => {
    if (!isMobile()) return setCollapsed(!sidebar.classList.contains('collapsed'));
    setMobState(mobState() === 'open' ? 'icons' : 'hidden');   // offen -> Symbole -> ganz weg
  });
  $('sideTab').addEventListener('click', () => setMobState('open'));
  $('sideBackdrop').addEventListener('click', () => setCollapsed(true));
  $('sideBackdrop').addEventListener('touchstart', e => { e.preventDefault(); setCollapsed(true); }, { passive: false });
  // Auf dem Handy nach der Wahl einer Seite automatisch einklappen
  document.querySelectorAll('.sidebar [data-page]').forEach(b => b.addEventListener('click', () => { if (isMobile() && Date.now() - lastNavDrag > 400) setCollapsed(true); }));
  // Wischen auf dem Handy: vom linken Rand nach rechts = eine Stufe auf, nach links = eine Stufe zu
  (() => {
    let sx = 0, sy = 0, fromRail = false, tracking = false;
    document.addEventListener('touchstart', e => {
      if (!isMobile() || inHub || $('app').classList.contains('hidden') || e.touches.length !== 1) { tracking = false; return; }
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; tracking = true;
      fromRail = sx < 90;   // auf der schmalen Leiste oder am linken Rand begonnen
    }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!tracking) return; tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const st = mobState();
      if (dx < 0) { if (st === 'open') setMobState('icons'); else if (st === 'icons' && fromRail) setMobState('hidden'); }
      else if (fromRail) setMobState(st === 'hidden' ? 'icons' : 'open');
    }, { passive: true });
  })();
  if (mobileMq.addEventListener) mobileMq.addEventListener('change', () => { if (isMobile()) applyMobileStart(); else { $('app').classList.remove('side-hidden'); sidebar.classList.toggle('collapsed', ls.get('sidebarCollapsed') === '1'); } syncSidebar(); });

  // ================= Entwickler-Zugang =================
  // Web-Version: eigene Firebase-Sitzung. Die ID wird zur E-Mail (housi:666 -> housi666@stagemate.dev);
  //   Zugriff auf alle Daten nur, wenn developers/<uid> in Firestore existiert (Firestore-Regeln).
  // Claude-/Lokal-Version: nur eigene Testdaten; Prüfung über eine SHA-256-Prüfsumme (kein Klartext im Code).
  const DEV_HASH = 'bc0ee41a421c6d279aefe913311d765b172d7a1fb60e314023e6744e1a298d4c';
  const devEmail = id => String(id || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') + '@stagemate.dev';
  let devDb = null, devData = null, devTab = 'bands';
  async function sha256(t) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function syncDevBtn() {
    const onAuth = !$('auth').classList.contains('hidden'), onHub = !$('app').classList.contains('hidden') && inHub;
    $('devBtn').classList.add('hidden');
  }
  syncDevBtn();
  function openDevModal() { $('devModal').classList.remove('hidden'); setMsg($('devMsg'), ''); $('devPw').value = ''; setTimeout(() => $('devId').focus(), 30); }
  // Versteckter Zugang: Ctrl+Shift+D, URL-Endung #dev oder 7x auf das Housi-Zeichen klicken (ab dem 4. Klick läuft ein Zähler, wie beim Android-Entwicklermodus)
  const devAllowed = () => !$('devPanel') || $('devPanel').classList.contains('hidden');
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd') && devAllowed()) { e.preventDefault(); openDevModal(); } });
  if (location.hash === '#dev') { history.replaceState(null, '', location.pathname + location.search); setTimeout(openDevModal, 600); }
  { const NEED = 7; let n = 0, last = 0, hm = document.querySelector('.housi-mark');
    if (hm) document.addEventListener('click', ev => {
      const r = hm.getBoundingClientRect(); if (!r.width || ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
      if (!devAllowed()) return;
      const t = Date.now(); n = (t - last > 2000) ? 1 : n + 1; last = t;
      if (n >= NEED) { n = 0; openDevModal(); return; }
      if (n >= NEED - 3) { const left = NEED - n; flash(`Noch ${left} ${left === 1 ? 'Klick' : 'Klicks'} bis zur Entwickler-Anmeldung`); }
    }); }
  const closeDevModal = () => $('devModal').classList.add('hidden');
  
  ['devX', 'devCancel'].forEach(k => $(k).addEventListener('click', closeDevModal));
  $('devId').addEventListener('input', () => { $('devMailHint').textContent = Data.usesFirebase && $('devId').value.trim() ? 'Firebase-Konto: ' + devEmail($('devId').value) : ''; });
  $('devPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('devGo').click(); });
  $('devGo').addEventListener('click', async () => {
    const id = $('devId').value.trim(), pw = $('devPw').value;
    if (!id || !pw) return setMsg($('devMsg'), 'Bitte ID und Passwort eingeben.', 'error');
    $('devGo').disabled = true; setMsg($('devMsg'), 'Prüfe …');
    try {
      if (Data.usesFirebase) {   // Web-Version – gilt auch auf der Anmeldeseite, bevor das eigene Konto verbunden ist
        const r = await Data.devSignIn(devEmail(id), pw);
        if (!r.ok) {
          const mail = devEmail(id);
          let t = r.error;
          if (r.uid) t = `Anmeldung bei Firebase ok, aber das Konto ist nicht als Entwickler freigegeben. Lege in Firestore die Sammlung „developers“ mit einem Dokument an, dessen ID genau diese UID ist: ${r.uid}`;
          else if (['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found', 'auth/wrong-password'].includes(r.code))
            t = `Firebase kennt das Konto ${mail} nicht oder das Passwort ist anders. Prüfe in der Firebase-Konsole unter Authentication, ob es genau dieses Konto gibt (sonst „Nutzer hinzufügen“), oder setze dort das Passwort neu.`;
          else if (r.code === 'auth/user-disabled') t = `Das Konto ${mail} ist in Firebase deaktiviert.`;
          return setMsg($('devMsg'), t + (r.code ? ` [${r.code}]` : ''), 'error');
        }
        devDb = r.db; devUid = r.uid; $('devWho').textContent = `${devEmail(id)} · Firebase`;
      } else {
        if (await sha256(id + '|' + pw) !== DEV_HASH) return setMsg($('devMsg'), 'ID oder Passwort stimmt nicht.', 'error');
        if (!rawDb) return setMsg($('devMsg'), 'Der Speicher ist noch nicht verbunden. Bitte kurz warten und nochmals versuchen.', 'error');
        devDb = rawDb; devUid = uid; $('devWho').textContent = `${id} · lokale Daten (${Data.backend})`;
      }
      closeDevModal(); $('devPw').value = '';
      $('devPanel').classList.remove('hidden'); syncDevBtn();
      devLoad();
    } catch (e) { setMsg($('devMsg'), 'Das hat nicht geklappt: ' + (e && e.message || e), 'error'); }
    finally { $('devGo').disabled = false; }
  });
  $('devClose').addEventListener('click', async () => {
    if (Data.usesFirebase) await Data.devSignOut();
    devDb = null; devData = null; $('devBody').innerHTML = '';
    $('devPanel').classList.add('hidden'); syncDevBtn();
  });
  $('devReload').addEventListener('click', () => devLoad());
  document.querySelectorAll('#devTabs [data-dt]').forEach(b => b.addEventListener('click', () => {
    devTab = b.dataset.dt; document.querySelectorAll('#devTabs [data-dt]').forEach(x => x.classList.toggle('on', x === b)); devRender();
  }));
  let devSearchT = null;
  $('devSearch').addEventListener('input', () => { clearTimeout(devSearchT); devSearchT = setTimeout(devRender, 150); });
  async function devAll(path) {
    try {
      const q = await Promise.race([devDb.collection(path).get(), new Promise((_, rej) => setTimeout(() => rej({ code: 'Zeitüberschreitung (15 s)' }), 15000))]);
      return q.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    }
    catch (e) { console.warn('[Entwickler]', path, e); return { error: (e && (e.code || e.message)) || 'Fehler' }; }
  }
  let devUid = null;
  async function devLoad() {
    if (!devDb) return;
    const body = $('devBody'); body.innerHTML = ''; body.append(el('div', 'dev-note', 'Daten werden geladen …'));
    const [bands_, members, contacts, presence] = await Promise.all(['bands', 'members', 'contacts', 'presence'].map(devAll));
    devData = { bands: bands_, members, contacts, presence, events: {}, extra: {}, at: new Date() };
    devRender();
  }
  const devArr = x => Array.isArray(x) ? x : [];
  const devJson = o => { const pre = el('pre', 'dev-json'); pre.textContent = JSON.stringify(o, (k, v) => typeof v === 'string' && v.startsWith('data:image/') ? `[Bild, ${Math.round(v.length / 1024)} kB]` : v, 2); return pre; };
  const devErr = (name, x) => x && x.error ? el('div', 'msg error', `${name}: kein Zugriff (${x.error}). Firestore-Regeln für Entwickler veröffentlicht?`) : null;
  function devPres(id) {
    const p = devArr(devData.presence).find(x => x.id === id);
    if (!p) return ['noch nie online', ''];
    if (isPrivate(p)) return ['Privat', 'priv'];
    if (isOnline(p)) return ['online', 'on'];
    return ['zuletzt ' + whenText(p.lastSeen), ''];
  }
  function devRender() {
    const body = $('devBody'); body.innerHTML = '';
    if (!devData) return;
    const q = $('devSearch').value.trim().toLowerCase();
    const hit = (...xs) => !q || xs.some(x => String(x == null ? '' : x).toLowerCase().includes(q));
    const B = devArr(devData.bands), M = devArr(devData.members), C = devArr(devData.contacts);
    // Diagnose: was wurde geladen, wo gab es Fehler
    const diag = el('div', 'dev-diag');
    const cnt = k => devData[k] && devData[k].error ? `${k}: Fehler (${devData[k].error})` : `${k}: ${devArr(devData[k]).length}`;
    diag.append(el('b', null, 'Diagnose: '), `Speicher ${Data.usesFirebase ? 'Firebase (' + ((window.STAGEMATE_FIREBASE && window.STAGEMATE_FIREBASE.projectId) || '?') + ')' : Data.backend === 'claude' ? 'Claude-Artefakt (nur Daten dieses Artefakts)' : 'nur dieser Browser (lokal)'} · Entwickler-UID ${devUid || '–'} · ` + ['bands', 'members', 'contacts', 'presence'].map(cnt).join(' · '));
    body.append(diag);
    ['bands', 'members', 'contacts', 'presence'].forEach(k => { const e = devErr(k, devData[k]); if (e) body.append(e); });
    if (!devArr(devData.bands).length && !devArr(devData.members).length && !['bands', 'members'].some(k => devData[k] && devData[k].error))
      body.append(el('div', 'msg error', Data.usesFirebase
        ? 'In Firebase sind noch keine Bands und Benutzer gespeichert. Erzeuge zuerst die Testdaten (testdaten.html) oder registriere ein Konto in der Web-Version.'
        : 'In diesem Speicher sind keine Daten. Die Artefakt-Version sieht nur ihre eigenen Daten – für alle echten Daten den Entwickler-Zugang in der Web-Version (GitHub-Link) benutzen.'));
    const bandName = id => (B.find(b => b.id === id) || {}).name || id;
    const mail = id => (C.find(c => c.id === id) || {}).email || '';
    if (devTab === 'stats') {
      const now = Date.now(), P = devArr(devData.presence);
      const box = el('div', 'dev-stats');
      [['Bands', B.length], ['Benutzer', M.length], ['Gerade online', P.filter(p => isOnline(p) && !p.private).length], ['Privat (Startbildschirm)', P.filter(isPrivate).length],
       ['Aktiv letzte 7 Tage', P.filter(p => now - (p.lastSeen || 0) < 7 * 864e5).length], ['Ohne Band', M.filter(m => !devArr(m.bandIds).length).length]]
        .forEach(([t, n]) => { const d = el('div', 'dev-stat'); d.append(el('b', null, String(n)), el('span', null, t)); box.append(d); });
      body.append(box, el('div', 'dev-note', 'Stand: ' + devData.at.toLocaleString('de-CH')));
      const sc = el('button', 'btn', 'Emoji-Prüfung starten'), scOut = el('div', 'dev-scan');
      sc.addEventListener('click', async () => {
        sc.disabled = true; scOut.innerHTML = ''; scOut.append(el('div', 'dev-note', 'Prüfe alle Texte …'));
        const hits = [], bad = v => typeof v === 'string' && !v.startsWith('data:') && (EMOJI_RE.test(v) || v.search(BAD_CHARS_RE) >= 0);
        const chk = (where, id, o, fields) => fields.forEach(fl => { if (bad(o[fl])) hits.push([where, id, fl, o[fl]]); });
        B.forEach(b => chk('Band', b.id, b, ['name']));
        M.forEach(m => chk('Benutzer', m.id, m, ['name', 'nick', 'firstName', 'lastName']));
        let fails = 0;
        for (const b of B) {
          for (const [lbl, path, fl] of [['Termin', `calendar/${b.id}/events`, ['title', 'name', 'place', 'notes']], ['Song', `songs/${b.id}/items`, ['title', 'name', 'artist']],
              ['Setlist', `setlists/${b.id}/lists`, ['name', 'folder']], ['Timetable', `timetables/${b.id}/lists`, ['name']]]) {
            const d = await devAll(path);
            if (d.error) { fails++; continue; }
            d.forEach(x => chk(lbl + ' (' + (b.name || b.id) + ')', x.id, x, fl));
          }
        }
        sc.disabled = false; scOut.innerHTML = '';
        scOut.append(el('div', 'dev-note', hits.length ? `${hits.length} Treffer. Nur lesen, es wurde nichts geändert.` : 'Keine Emojis oder unerlaubten Zeichen gefunden.' + (fails ? ` (${fails} Bereiche nicht lesbar)` : '')));
        if (hits.length) {
          const tb = el('table'); tb.innerHTML = '<tr><th>Bereich</th><th>ID</th><th>Feld</th><th>Wert</th></tr>';
          hits.forEach(h => { const tr = el('tr'); h.forEach(v => tr.append(el('td', null, String(v)))); tb.append(tr); });
          scOut.append(tb);
        }
      });
      body.append(el('h4', null, 'Datenprüfung'), sc, scOut);
      return;
    }
    if (devTab === 'bands') {
      const list = B.filter(b => hit(b.name, b.tag, b.id, b.code, b.createdBy)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
      body.append(el('div', 'dev-note', `${list.length} von ${B.length} Bands`));
      list.forEach(b => {
        const mem = M.filter(m => devArr(m.bandIds).includes(b.id));
        const d = el('details', 'dev-row'), sm = el('summary');
        sm.append(el('b', null, b.name || '(ohne Name)'));
        if (b.tag) sm.append(tagChip(b.tag));
        sm.append(el('span', 'dev-chip', `${mem.length} Mitglieder`), el('span', 'dev-chip', 'Code ' + (b.code || '–')), el('span', 'dev-chip', 'ID ' + b.id));
        d.append(sm);
        const inn = el('div', 'dev-in'); d.append(inn);
        d.addEventListener('toggle', async () => {
          if (!d.open || inn.childElementCount) return;
          const admin = M.find(m => m.id === b.createdBy);
          inn.append(el('div', null, `Admin (Gründer): ${admin ? admin.name : (b.createdBy || '–')}`));
          inn.append(el('h4', null, 'Mitglieder'));
          const t = el('table'); t.innerHTML = '<tr><th>Name</th><th>PUID</th><th>Rollen</th><th>E-Mail</th><th>Status</th></tr>';
          mem.forEach(m => {
            const tr = el('tr'), ms = (m.memberships || {})[b.id] || {}, [st] = devPres(m.id);
            [m.name, m.puid || '–', devArr(ms.roles).join(', ') || '–', mail(m.id) || '–', st].forEach(v => tr.append(el('td', null, v)));
            t.append(tr);
          });
          inn.append(t);
          inn.append(el('h4', null, 'Termine und Gigs'));
          const evs = devData.events[b.id] || (devData.events[b.id] = await devAll(`calendar/${b.id}/events`));
          const ee = devErr('Termine', evs);
          if (ee) inn.append(ee);
          else if (!evs.length) inn.append(el('div', 'dev-note', 'Keine Termine.'));
          else {
            const t2 = el('table'); t2.innerHTML = '<tr><th>Datum</th><th>Titel</th><th>Art</th></tr>';
            evs.slice().sort((x, y) => String(x.start || x.date || '').localeCompare(String(y.start || y.date || ''))).forEach(ev => {
              const tr = el('tr'); [String(ev.start || ev.date || '–').slice(0, 16).replace('T', ' '), ev.title || ev.name || '–', ev.gig ? 'Gig' : (ev.cat || ev.category || 'Termin')].forEach(v => tr.append(el('td', null, v))); t2.append(tr);
            });
            inn.append(t2);
          }
          const extra = [['songs', 'Songs', `songs/${b.id}/items`, x => [x.title || x.name || '–', x.artist || x.band || '', x.key || '', x.bpm || '']],
            ['setlists', 'Setlists', `setlists/${b.id}/lists`, x => [x.name || '–', devArr(x.items).length + ' Einträge', x.vis || '', x.gigId || '']],
            ['timetables', 'Timetables', `timetables/${b.id}/lists`, x => [x.gigId || x.id, devArr(x.entries).length + ' Slots', devArr(x.entries).map(e => (e.time || '') + ' ' + (e.band || e.title || '')).join(' | '), '']]];
          for (const [k, title, path, row] of extra) {
            inn.append(el('h4', null, title));
            const key = b.id + '/' + k;
            const data = devData.extra[key] || (devData.extra[key] = await devAll(path));
            const er = devErr(title, data);
            if (er) { inn.append(er); continue; }
            if (!data.length) { inn.append(el('div', 'dev-note', 'Keine Einträge.')); continue; }
            const t3 = el('table');
            data.forEach(x => { const tr = el('tr'); row(x).forEach(v => tr.append(el('td', null, String(v)))); t3.append(tr); });
            inn.append(t3);
          }
          inn.append(el('h4', null, 'Rohdaten der Band'), devJson(b));
        });
        body.append(d);
      });
      if (!list.length) body.append(el('div', 'dev-note', 'Keine Bands gefunden.'));
      return;
    }
    // Benutzer
    const list = M.filter(m => hit(m.name, m.nick, m.firstName, m.lastName, m.puid, m.id, mail(m.id), ...devArr(m.bandIds).map(bandName))).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
    body.append(el('div', 'dev-note', `${list.length} von ${M.length} Benutzern`));
    list.forEach(m => {
      const d = el('details', 'dev-row'), sm = el('summary'), [st, cls] = devPres(m.id);
      sm.append(el('b', null, m.name || '(ohne Name)'), el('span', 'dev-chip', m.puid || 'ohne PUID'), el('span', 'dev-chip ' + cls, st));
      const bn = devArr(m.bandIds).map(bandName);
      sm.append(el('span', 'dev-chip', bn.length ? bn.join(' · ') : 'keine Band'));
      d.append(sm);
      const inn = el('div', 'dev-in'); d.append(inn);
      d.addEventListener('toggle', () => {
        if (!d.open || inn.childElementCount) return;
        const c = C.find(x => x.id === m.id) || {};
        inn.append(el('div', null, `UID: ${m.id}`), el('div', null, `E-Mail: ${c.email || '–'} · Telefon: ${c.phone || '–'}`));
        inn.append(el('h4', null, 'Profil (Rohdaten)'), devJson(m));
      });
      body.append(d);
    });
    if (!list.length) body.append(el('div', 'dev-note', 'Keine Benutzer gefunden.'));
  }

  // ================= Start =================
  async function init() {
    $('registerSlot').appendChild(form);
    renderAuth();
    const s0 = await Data.connect({ timeoutMs: 10000, onNeedLogin: () => showFbLogin(), onOffline: () => showFbLogin(true) });
    hideFbLogin();
    rawDb = s0.db; db = withContacts(s0.db); uid = s0.uid; suggestedName = s0.name || ''; suggestedEmail = s0.email || ''; if (s0.readOnly) readOnly = true;
    try {
      const s = await db.doc('members/' + uid).get();
      // Kopie: Objekte aus der Datenbank können schreibgeschützt sein
      profile = s.exists ? await loadOwnContact(clone(s.data())) : null;
      bands = profile && Array.isArray(profile.bandIds) ? await loadBands(profile.bandIds) : {};
    } catch (e) {
      if (s0.mode !== 'local') { const s1 = Data.useLocal(); rawDb = s1.db; db = withContacts(s1.db); uid = s1.uid; }
      profile = null; bands = {};
    }
    mode = Data.mode;
    finish();
  }

  // Browser (Chrome, Opera, Edge) anbieten, E-Mail und Passwort zu speichern; andere Browser erkennen das Formular selbst
  function rememberLogin(email, pw) {
    try { if (window.PasswordCredential && navigator.credentials) navigator.credentials.store(new PasswordCredential({ id: email, password: pw, name: email })).catch(() => {}); } catch (e) {}
  }
  // ----- E-Mail in einem Feld (v0.6.7): Browser und Passwort-Manager können Anmeldedaten speichern und einsetzen -----
  const EMAIL_PARTS = ['fbEmail'];
  const emailValue = () => ($('fbEmail').value || '').trim().toLowerCase();
  const emailValid = () => /^[^\s@]+@[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,12}$/i.test(emailValue());

  // ----- Konto-Anmeldung (nur Web-Version mit Firebase) -----
  let fbPane = null, fbTab = 'in';
  function showFbLogin(offline) {
    fbLoginShown = true;
    const card = document.querySelector('#auth .auth-side .card');
    if (!fbPane) {
      fbPane = el('div'); fbPane.id = 'fbAuthPane';
      fbPane.innerHTML = `
        <div class="tabs"><button type="button" class="tab active" data-fbtab="in">Anmelden</button><button type="button" class="tab" data-fbtab="up">Registrieren</button></div>
        <h2 id="fbTitle">Willkommen zurück</h2>
        <p class="hint" id="fbHint">Schon registriert? Melde dich mit deiner E-Mail-Adresse und deinem Passwort an. Neu hier? Dann oben auf „Registrieren“.</p>
        <form id="fbForm" novalidate>
          <div class="field"><label for="fbEmail">E-Mail</label><input id="fbEmail" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="name@beispiel.ch"></div>
          <div class="field"><label for="fbPw">Passwort</label><input id="fbPw" name="password" type="password" autocomplete="current-password"></div>
          <div class="field hidden" id="fbPw2Wrap"><label for="fbPw2">Passwort wiederholen</label><input id="fbPw2" type="password" autocomplete="new-password"></div>
          <button type="submit" class="btn" id="fbGo">Anmelden</button>
        </form>
        <button type="button" class="linkish-btn" id="fbReset" style="margin-top:12px">Passwort vergessen?</button>
        <div class="msg" id="fbMsg"></div>
        <div id="fbRegSlot" class="hidden"></div>`;
      card.prepend(fbPane);
      const setTab = t => {
        fbTab = t;
        fbPane.querySelectorAll('[data-fbtab]').forEach(b => b.classList.toggle('active', b.dataset.fbtab === t));
        const up = t === 'up';
        // Registrieren: das Profil-Formular (mit Passwort) erscheint direkt hier; Anmelden: nur E-Mail und Passwort
        ['fbTitle', 'fbHint', 'fbForm', 'fbReset', 'fbMsg'].forEach(id => $(id).classList.toggle('hidden', up));
        $('fbRegSlot').classList.toggle('hidden', !up);
        if (up) { $('fbRegSlot').appendChild(form); prepareForm(); } else $('registerSlot').appendChild(form);
        $('fbTitle').textContent = 'Willkommen zurück';
        $('fbHint').textContent = 'Schon registriert? Melde dich mit deiner E-Mail-Adresse und deinem Passwort an. Neu hier? Dann oben auf „Registrieren“.';
        $('fbPw2Wrap').classList.add('hidden');
        $('fbPw').autocomplete = 'current-password';
        // Angaben aus „Anmelden“ nicht in „Konto erstellen“ übernehmen (und umgekehrt)
        EMAIL_PARTS.forEach(id => { $(id).value = ''; });
        ['fbPw', 'fbPw2'].forEach(id => { $(id).value = ''; $(id).type = 'password'; });
        $('fbGo').textContent = 'Anmelden';
        setMsg($('fbMsg'), '');
      };
      fbPane.querySelectorAll('[data-fbtab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.fbtab)));
      enhancePw($('fbPw')); enhancePw($('fbPw2'));
      $('fbForm').addEventListener('submit', async e => {
        e.preventDefault();
        const email = emailValue(), pw = $('fbPw').value;
        if (!EMAIL_PARTS.every(id => $(id).value.trim()) || !pw) return setMsg($('fbMsg'), 'Bitte E-Mail und Passwort eingeben.', 'error');
        if (!emailValid()) return setMsg($('fbMsg'), 'Diese E-Mail-Adresse sieht nicht gültig aus.', 'error');
        $('fbGo').disabled = true; setMsg($('fbMsg'), 'Anmelden …');
        const r = await Data.signIn(email, pw);
        $('fbGo').disabled = false;
        if (!r.ok) setMsg($('fbMsg'), r.error, 'error');
        else { rememberLogin(email, pw); setMsg($('fbMsg'), 'Angemeldet – einen Moment …', 'ok'); }
      });
      $('fbReset').addEventListener('click', async () => {
        const email = emailValue();
        if (!emailValid()) return setMsg($('fbMsg'), 'Gib zuerst deine E-Mail-Adresse ein, dann nochmals auf «Passwort vergessen?» klicken.', 'error');
        const r = await Data.resetPassword(email);
        setMsg($('fbMsg'), r.ok ? 'Falls ein Konto existiert, ist eine E-Mail zum Zurücksetzen unterwegs. Schau auch im Spam-Ordner nach.' : r.error, r.ok ? 'ok' : 'error');
      });
    }
    card.classList.add('fb-mode');
    if (offline) {
      $('fbForm').classList.add('hidden'); $('fbReset').classList.add('hidden'); fbPane.querySelector('.tabs').classList.add('hidden');
      $('fbTitle').textContent = 'Keine Verbindung';
      $('fbHint').textContent = 'Der StageMate-Server ist gerade nicht erreichbar. Prüfe deine Internetverbindung und lade die Seite neu.';
    }
  }
  function hideFbLogin() {
    fbLoginShown = false;
    const card = document.querySelector('#auth .auth-side .card');
    if (card) card.classList.remove('fb-mode');
    if (fbPane) { $('registerSlot').appendChild(form); fbPane.remove(); fbPane = null; }
  }

  // Zufällige Testband (Codes TBA01X … TBA10X) für neue Testpersonen
  async function pickTestBand() {
    const codes = ['TBA01X', 'TBA02X', 'TBA03X', 'TBA04X', 'TBA05X', 'TBA06X', 'TBA07X', 'TBA08X', 'TBA09X', 'TBA10X'];
    for (let i = codes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [codes[i], codes[j]] = [codes[j], codes[i]]; }
    for (const c of codes) { try { const b = await findBandByCode(c); if (b) return b; } catch (e) {} }
    return null;
  }
  async function runPendingReg(pr) {
    activeTab = 'register'; renderAuth();
    setBandMode('none');
    if (pr.testBand) {
      const tb = await pickTestBand();
      if (tb) { joinBand = tb; joinEntry = null; $('fCode').value = tb.code; newRoles = new Set(['Organisation']); newBandMode = 'join'; }
      else setMsg($('regMsg'), 'Es wurde keine Testband gefunden. Du wirst ohne Band angelegt.', 'error');
    }
    submitProfile();
  }
  function finish() {
    if (pendingReg && !profile) { const pr = pendingReg; pendingReg = null; runPendingReg(pr); return; }
    pendingReg = null;
    prepareForm();
    showTab(profile ? 'login' : 'register');
    // Neue Fassung der Nutzungsbedingungen: zuerst akzeptieren
    if (profile && needsTerms()) { showTab('register'); setMsg($('regMsg'), 'Bitte akzeptiere die Nutzungsbedingungen, um weiterzumachen.', 'error'); return; }
    if (!profile) return;
    if (!bandIdsOf(profile).length && Data.backend !== 'firebase') return;
    // Neu geladen während der Sitzung: direkt zurück in die App
    if (ls.sget('bandLoggedIn') === '1') return ls.sget('smView') === 'hub' ? enterHub() : enterApp(ls.sget('smBand') || profile.lastBand);
    // Web-Version: nach der Konto-Anmeldung zuerst der Startbildschirm
    if (Data.backend === 'firebase') enterHub();
  }

  init();
})();
