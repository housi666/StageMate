/*! StageMate v0.6.1 · Build 80 · 2026-11-26 */
/* StageMate – gesperrte Wörter für Nicknames (und Bandnamen)
 * Diese Datei darfst du selbst anpassen (z.B. direkt auf GitHub bearbeiten).
 * Alles in Kleinbuchstaben eintragen. Gross-/Kleinschreibung, Umlaute und
 * Ersatzzeichen (0=o, 1=i, 3=e, 4=a, 5=s, 7=t, @=a, $=s) werden automatisch berücksichtigt.
 *
 * contains : gesperrt, sobald das Wort irgendwo vorkommt   ("xyzhitlerxyz")
 * exact    : nur gesperrt als eigenes Wort                  ("du arsch" ja, "Barsch" nein)
 */
const STAGEMATE_BADWORDS = {
  contains: [
    'hitler', 'nazi', 'heilhitler', 'siegheil', 'ss88', 'kkk',
    'nigger', 'nigga', 'neger', 'kanake', 'kanacke', 'zigeuner', 'kuffar',
    'schwuchtel', 'faggot', 'tranny',
    'hurensohn', 'hurenson', 'wichser', 'fotze', 'missgeburt', 'spast', 'mongo',
    'motherfucker', 'fuck', 'cunt', 'bitch', 'whore', 'slut', 'retard',
    'vergewaltig', 'kinderficker', 'pedo', 'paedo',
    'porno', 'porn', 'penis', 'vagina', 'pimmel', 'muschi',
  ],
  exact: [
    'arsch', 'arschloch', 'hure', 'nutte', 'schlampe', 'idiot', 'depp', 'trottel', 'opfer',
    'sex', 'fick', 'ficken', 'kacke', 'scheisse', 'shit', 'dick', 'cock', 'ass', 'asshole',
    'admin', 'administrator', 'stagemate', 'support', 'moderator',
  ],
};
