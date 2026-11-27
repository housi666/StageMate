/*! StageMate v0.6.8 · Build 87 · 2026-11-27 */
/* StageMate – Regeln für den automatischen Band-Tag
 * Diese Datei darfst du selbst anpassen (z.B. direkt auf GitHub bearbeiten).
 *
 * Ein Tag hat 1 bis 3 Zeichen, nur Grossbuchstaben A-Z und Ziffern 0-9.
 * Anzeige:  1 Zeichen -> -A-    2 Zeichen -> A-B    3 Zeichen -> ABC
 *
 * So wird ein Tag aus dem Bandnamen erzeugt:
 *  1. Name in Grossbuchstaben, Sonderzeichen gemäss "replace" ersetzen
 *  2. Wörter aus "ignoreWords" überspringen (ausser der Name besteht nur daraus)
 *  3. Die "strategies" der Reihe nach probieren; der erste freie Vorschlag gewinnt
 *     - initials        : Anfangsbuchstaben der Wörter      "Nacht Falter Live" -> NFL
 *     - consonants      : erster Buchstabe + Konsonanten     "Nachtfalter"       -> NCH
 *     - firstLetters    : die ersten Buchstaben              "Nachtfalter"       -> NAC
 *     - initialsDigits  : Anfangsbuchstaben + Ziffern        "Blink 182"         -> B18
 */
const STAGEMATE_TAG_RULES = {
  length: 3,
  ignoreWords: ['THE', 'DIE', 'DER', 'DAS', 'DEN', 'DEM', 'DES', 'EIN', 'EINE', 'LOS', 'LAS', 'LA', 'LE', 'LES', 'EL', 'IL',
    'BAND', 'AND', 'UND', 'OF', 'VON', 'VOM', 'ZUM', 'ZUR', 'A', 'AN', 'IN', 'ON', 'AT'],
  replace: { 'Ä': 'A', 'Ö': 'O', 'Ü': 'U', 'ß': 'SS', 'É': 'E', 'È': 'E', 'Ê': 'E', 'À': 'A', 'Â': 'A', 'Ç': 'C', 'Ñ': 'N', '&': ' ' },
  strategies: ['initials', 'initialsDigits', 'consonants', 'firstLetters'],
  vowels: 'AEIOU',
};
