/*! StageMate v0.6.5 · Build 84 · 2026-11-27 */
/* Glänzende Display-Knöpfe (Regelwerk): Farbe je Aufgabe, ein gemeinsamer Lichtstreifen für alle Knöpfe einer Seite. */
(function () {
  'use strict';
  // Farbe nach Aufgabe: Wörter im Knopftext oder Klassen entscheiden. Ein festes data-tone im HTML hat Vorrang.
  const RULES = [
    ['red',    /(löschen|entfernen|verlassen|auflösen|abmelden|sperren|zurücksetzen|stopp)/],
    ['slate',  /^(abbrechen|schliessen|zurück|verwerfen|nein|später|ablehnen|zuklappen|alle zuklappen|×|✕)/],
    ['green',  /(speichern|übernehmen|hinzufügen|erstellen|anlegen|aufnehmen|beitreten|gründen|bestätigen|registrieren|anmelden|akzeptieren|^ok$|^ja$|^\+|^neue|play|pause)/],
    ['blue',   /(export|csv|json|word|pdf|text|drucken|herunterladen|teilen|download|kopieren)/],
    ['violet', /(import|bühnenmodus|tutorial|entwickler|vorschau|in eine rolle)/],
    ['teal',   /(bearbeiten|✎|ändern|wählen|auswahl|sortieren|suchen|filter|anzeigen|öffnen|springe|zum )/]
  ];
  function toneOf(b) {
    if (b.classList.contains('danger') || b.classList.contains('danger-btn')) return 'red';
    const t = (b.textContent || '').trim().toLowerCase().replace(/^[^a-zäöü×✕+]+/i, m => m.includes('+') ? '+' : '');
    for (const [tone, re] of RULES) if (re.test(t)) return tone;
    return b.classList.contains('ghost') ? 'slate' : 'amber';
  }
  let queued = false;
  function run() {
    queued = false;
    const bs = document.querySelectorAll('.btn');
    const rects = [];
    bs.forEach(b => {
      if (!b.dataset.tone || b.dataset.toneAuto === '1') { const t = toneOf(b); if (b.dataset.tone !== t) b.dataset.tone = t; b.dataset.toneAuto = '1'; }
      b.classList.add('shiny');
      rects.push(b.offsetParent === null ? null : b.getBoundingClientRect().left);
    });
    bs.forEach((b, i) => { if (rects[i] !== null) b.style.setProperty('--shx', Math.round(rects[i]) + 'px'); });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(run); } }
  document.addEventListener('DOMContentLoaded', () => {
    run();
    new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    window.addEventListener('resize', queue);
    document.addEventListener('transitionend', queue, true);
  });
})();
