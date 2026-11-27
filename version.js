/*! StageMate v0.6.13 · Build 92 · 2026-11-27 */
/* StageMate – Version, Build und Changelog
 * Wird von bump.sh automatisch angepasst (APP_VERSION, APP_BUILD, APP_BUILD_DATE).
 * Versionsregel: kleine Änderung = letzte Zahl +1, grössere Änderung = mittlere Zahl +1,
 * die erste Zahl bestimmt Housi.
 */
const APP_VERSION = 'v0.6.13';
const APP_BUILD = 92;
const APP_BUILD_DATE = '2026-11-27';
const APP_PHASE = 'Alpha';

// Neueste Version zuerst. Typen: neu | besser | fix | intern
const APP_CHANGELOG = [
  { version: 'v0.6.13', date: '2026-11-27', items: [
    { type: 'besser', text: 'Schriftzug „StageMate“ bunt: Farbverlauf aus den Bereichsfarben (Bernstein, Pink, Violett, Blau, Petrol) auf der Anmeldeseite und im Startbildschirm.' }
  ] },
  { version: 'v0.6.12', date: '2026-11-27', items: [
    { type: 'fix', text: 'Handy: Scrollen und Verschieben der Registerkarten in der Seitenleiste beissen sich nicht mehr. Wischen scrollt, Verschieben erst nach langem Drücken (mit kurzem Vibrieren).' },
    { type: 'fix', text: 'Seitenleiste: Die Liste der Registerkarten scrollt, wenn sie nicht ganz auf den Bildschirm passt (vorher abgeschnitten).' }
  ] },
  { version: 'v0.6.11', date: '2026-11-27', items: [
    { type: 'besser', text: 'Handy: Der Inhalt geht jetzt bis an den unteren Bildschirmrand (vorher ein ungenutzter schwarzer Streifen); unten bleibt nur Platz zum Scrollen.' },
    { type: 'besser', text: 'Handy: Seitentitel (z. B. „Übersicht“) kleiner, Kopfzeile flacher.' }
  ] },
  { version: 'v0.6.10', date: '2026-11-27', items: [
    { type: 'neu', text: 'Mehr Farbe, trotzdem geordnet: Jeder Bereich hat eine feste Farbe (Kalender Blau, Gigs Bernstein, Checkliste Grün, Finanzen Petrol, Setlist Violett, Songs Magenta, Timetable Indigo, Verwaltung Pink).' },
    { type: 'neu', text: 'Seitenleiste: Symbole in der Bereichsfarbe, der aktive Bereich ist voll eingefärbt (im Dunkelmodus mit Leuchten). Kopfzeile mit leichtem Verlauf in der Farbe der Seite.' },
    { type: 'neu', text: 'Kacheln auf Übersicht und Startbildschirm in ihrer Bereichsfarbe getönt, mit farbigem Symbol: hell nach Entwurf B, dunkel nach Entwurf D.' }
  ] },
  { version: 'v0.6.9', date: '2026-11-27', items: [
    { type: 'fix', text: 'Kann das Profil nach der Anmeldung nicht aus der Datenbank geladen werden, wechselt StageMate nicht mehr still in den Demo-Modus (dort entstanden Profile nur im Browser), sondern zeigt „Daten nicht erreichbar“ mit Fehlercode und Knopf „Abmelden“.' }
  ] },
  { version: 'v0.6.8', date: '2026-11-27', items: [
    { type: 'fix', text: 'Entwickler-Anmeldung: Die Meldung unterscheidet jetzt „Dokument fehlt“ und „Firestore verweigert das Lesen“ (mit Fehlercode); die UID in der Meldung lässt sich markieren und kopieren.' }
  ] },
  { version: 'v0.6.7', date: '2026-11-27', items: [
    { type: 'besser', text: 'Anmelden: E-Mail in einem Feld statt in drei. Browser und Passwort-Manager können E-Mail und Passwort jetzt speichern und beim nächsten Mal selbst einsetzen.' },
    { type: 'besser', text: 'Nach dem Registrieren und Anmelden bietet der Browser an, die Anmeldedaten zu speichern; Hinweis „Schon registriert? … Neu hier?“ auf der Anmeldeseite.' }
  ] },
  { version: 'v0.6.6', date: '2026-11-27', items: [
    { type: 'besser', text: 'Icon „SM“: Der lange Strich des S ist kürzer, die linke Kante des M steht jetzt genau in der Mitte.' }
  ] },
  { version: 'v0.6.5', date: '2026-11-27', items: [
    { type: 'neu', text: 'Neues Icon: das Kürzel „SM“ in der Schrift Over There. Bernstein auf Dunkel im Browser-Tab und auf dem Handy-Startbildschirm, dunkel auf Bernstein als Logo in der App.' }
  ] },
  { version: 'v0.6.4', date: '2026-11-26', items: [
    { type: 'besser', text: 'Fusszeile nach Regelwerk: StageMate, Version, „Made by Housi“, „Coded with Claude“ auf der Anmeldeseite, in der persönlichen Übersicht und unten in der Seitenleiste.' },
    { type: 'intern', text: 'Dokumente (Changelog, RoadMap, Checkliste usw.) tragen in der ersten Zeile das Datum im Format JJJJ-MM-TT.' }
  ] },
  { version: 'v0.6.3', date: '2026-11-26', items: [
    { type: 'fix', text: 'Schriftzug „StageMate“ (Schrift Over There) auf der Anmeldeseite und in der persönlichen Übersicht wieder da; er war durch die Lieferung von v0.6.2 überschrieben worden.' },
    { type: 'intern', text: 'Zwei Lieferungen hatten dieselbe Nummer v0.6.2 · Build 81 (Schriftzug und Export); beide sind jetzt in v0.6.3 zusammengeführt.' }
  ] },
  { version: 'v0.6.2', date: '2026-11-26', items: [
    { type: 'neu', text: 'Ein Export-Fenster für die ganze App: Knopf „⤓ Exportieren“ oben auf jeder Seite, Formate als Kacheln mit einem Satz, wofür sie gut sind.' },
    { type: 'neu', text: 'Kalender und Gigs als Kalenderdatei (.ics) fürs Handy, Google oder Outlook, dazu PDF und CSV.' },
    { type: 'neu', text: 'Neue Exporte: Checklisten (PDF zum Abhaken, Text, CSV), Songs (PDF, CSV), Timetable und Finanzen zusätzlich als PDF.' },
    { type: 'besser', text: 'Setlist: Bühnenmodus und „In Timetable eintragen“ stehen getrennt von den Exporten; „JSON importieren“ ist jetzt in der Übersicht aller Setlists.' },
    { type: 'besser', text: 'Einheitliche Dateinamen, z. B. Setlist_Bergfest-Interlaken_2026-12-08.pdf.' }
  ] },
  { version: 'v0.6.1', date: '2026-11-26', items: [
    { type: 'neu', text: 'Kalender: Sonntage und Feiertage sind in der Monats- und Jahresansicht rot markiert; der Name des Feiertags steht im Hinweis beim Darüberfahren (allgemeine Schweizer Feiertage, kantonale fehlen noch).' },
    { type: 'neu', text: 'Bühnenmodus: Play, Pause und Stopp. Die Uhr zeigt die Zeit des Eintrags (mit Balken gegen die geplante Länge, rot bei Überzug) und die Zeit des ganzen Sets. Leertaste = Play/Pause, S = Stopp.' },
    { type: 'besser', text: 'Song erfassen: Auswahl Album/EP/Single schmaler, das Namensfeld daneben breiter.' },
    { type: 'intern', text: 'Veralteten Hinweis „Word folgt“ bei den Setlist-Exporten entfernt (Word gibt es bereits).' }
  ] },
  { version: 'v0.6.0', date: '2026-11-23', items: [
    { type: 'neu', text: 'Neues Design der Knöpfe: dunkle Glasfläche mit Glanz und einem langsamen Lichtstreifen, der für alle Knöpfe einer Seite als eine gemeinsame Linie läuft. Bei „weniger Bewegung“ im Gerät steht der Streifen still.' },
    { type: 'neu', text: 'Jeder Knopf hat eine Farbe nach seiner Aufgabe: Grün speichern und hinzufügen, Rot löschen, Blau exportieren, Violett Import und Sonderfunktionen, Petrol Bearbeiten und Auswählen, Grau Abbrechen und Zurück, Bernstein Hauptaktionen.' },
    { type: 'besser', text: 'Klick-Rückmeldung: Beim Drücken zeigen Knöpfe, Reiter, aufklappbare Kopfzeilen und Karten einen Rand und Text in der Akzentfarbe.' }
  ] },
  { version: 'v0.5.4', date: '2026-11-19', items: [
    { type: 'intern', text: 'Neues Firebase-Projekt (stagemate-d0a66, Region Zürich) mit neuer Verbindung. Konten und Daten aus dem alten Projekt kommen nicht mit, Registrierung neu nötig.' },
    { type: 'intern', text: 'Diagnose-Anzeige liest den Projektnamen aus der Verbindung statt fest eingetragen.' }
  ] },
  { version: 'v0.5.3', date: '2026-11-18', items: [
    { type: 'besser', text: 'Entwickler-Anmeldung: Das Fenster schliesst nur noch über X oder Abbrechen, nicht mehr durch Klick daneben.' },
    { type: 'besser', text: 'Versteckter Zugang: 7 Klicks auf das Housi-Zeichen (statt 5). Ab dem 4. Klick läuft ein Zähler („Noch 3 Klicks …“), wie beim Android-Entwicklermodus.' }
  ] },
  { version: 'v0.5.2', date: '2026-11-18', items: [
    { type: 'besser', text: 'Neue Testdaten: 50 Testpersonen mit echt klingenden Namen, 10 Bands mit Namen statt Codes (Beitritts-Codes TBA01X bis TBA10X), 20 Veranstaltungen mit Setlists, Timetables, Checklisten, Teilnehmern, dazu Proben, Songs, Finanzen und Ernährungsangaben. Zufällige Testband wählt aus allen 10 Bands.' }
  ] },
  { version: 'v0.5.1', date: '2026-11-18', items: [
    { type: 'besser', text: '„Schnell erstellen“ heisst jetzt „Springe zu“: die Knöpfe führen direkt zur Gig-, Termin-, Setlist- und Checklisten-Seite der Band (ohne ein Erstell-Fenster zu öffnen).' },
    { type: 'besser', text: 'Profil: Abstand zwischen den Links (Datenschutz usw.) und dem Speichern-Knopf.' }
  ] },
  { version: 'v0.5.0', date: '2026-11-18', items: [
    { type: 'neu', text: 'Registrieren mit Profil: Profilbild, Nickname, Name, Vorname, E-Mail, Telefon, Passwort (zweimal). Danach bist du automatisch angemeldet und landest in der persönlichen Übersicht. Keine Band nötig.' },
    { type: 'neu', text: 'Optional: einer zufälligen Testband beitreten (Rolle Organisation). Hinweis zur erfundenen E-Mail im Formular (kein Passwort-Zurücksetzen möglich).' },
    { type: 'besser', text: 'Profilseite ohne Bands und ohne Ernährung. Band hinzufügen läuft über ein eigenes Fenster in der Übersicht, Ernährung und Allergien stehen in den Einstellungen.' },
    { type: 'besser', text: 'Start-Fenster: Wer sich freiwillig anmeldet, ist automatisch im Testprogramm.' }
  ] },
  { version: 'v0.4.50', date: '2026-11-17', items: [
    { type: 'neu', text: 'Info-Fenster beim Start: grosser Titel „WICHTIG“, Hinweis auf Anmeldung mit ungültiger E-Mail zu Testzwecken und Erklärung zum Umgang mit Daten.' }
  ] },
  { version: 'v0.4.49', date: '2026-11-17', items: [
    { type: 'besser', text: 'Datenschutzerklärung: Speicherung von Ernährung und Allergien neu beschrieben (privates Dokument, Kopie nur mit Haken) und Einsicht durch den Betreiber zur Wartung ausdrücklich genannt.' }
  ] },
  { version: 'v0.4.48', date: '2026-11-17', items: [
    { type: 'besser', text: 'Ernährung und Allergien sind jetzt geschützt: vollständig nur bei dir gespeichert. Nur mit dem Haken „für meine Bands verwenden“ gibt es eine Kopie für die Band. Bestehende Angaben werden beim nächsten Start automatisch verschoben.' },
    { type: 'intern', text: 'Neue Firestore-Regel foodshare (firestore.rules veröffentlichen).' }
  ] },
  { version: 'v0.4.47', date: '2026-11-17', items: [
    { type: 'neu', text: 'Entwicklerseite (Statistik): Emoji-Prüfung durchsucht Bands, Benutzer, Termine, Songs, Setlists und Timetables nach Emojis und unerlaubten Zeichen. Nur lesend.' }
  ] },
  { version: 'v0.4.46', date: '2026-11-17', items: [
    { type: 'neu', text: 'Eigenes Icon: Bühne mit S und M. Als Favicon im Browser-Tab, als Symbol beim Speichern auf dem Startbildschirm (Manifest) und als Apple-Touch-Icon.' }
  ] },
  { version: 'v0.4.45', date: '2026-11-17', items: [
    { type: 'neu', text: 'Neuer Tipp „Zeichen in Texten“: erklärt Emoji-Sperre, Sonderzeichen und Umlaute.' }
  ] },
  { version: 'v0.4.44', date: '2026-11-17', items: [
    { type: 'fix', text: 'Firestore-Regeln: Zeichenmuster entfernt (Konsole lehnte es ab). Server prüft nur noch die Länge, Zeichenfilter bleiben in der App.' }
  ] },
  { version: 'v0.4.43', date: '2026-11-17', items: [
    { type: 'fix', text: 'Firestore-Regeln: Zeichenprüfung für Namen neu geschrieben (Anführungszeichen und Klammern als Hex-Codes), weil die Firebase-Konsole die erste Fassung nicht speichern konnte.' }
  ] },
  { version: 'v0.4.42', date: '2026-11-17', items: [
    { type: 'besser', text: 'Phasen neu festgelegt: Alpha bis 0.6.x, Beta ab 0.7.0, Prerelease ab 0.9.0, Release 1.0.0 (Hinweis in den Tipps angepasst).' }
  ] },
  { version: 'v0.4.41', date: '2026-11-17', items: [
    { type: 'besser', text: 'Neuer Schreibname: StageMate (statt Stagemate) in der App, den Nutzungsbedingungen, der Datenschutzerklärung und allen Dateien.' },
    { type: 'besser', text: 'Nutzungsbedingungen: Hinweis, dass StageMate bis November 2026 „Stagemate“ geschrieben wurde. Die Fassung vom 17.11.2026 bleibt, eine erneute Zustimmung ist nicht nötig (nur Schreibweise).' }
  ] },
  { version: 'v0.4.40', date: '2026-11-17', items: [
    { type: 'neu', text: 'Setlist: Ordner (Eingabe mit Vorschlägen, Ansicht gruppiert, Filter) und Vorlagen („Als Vorlage verwenden“, neue Setlist per „+ Aus Vorlage …“).' }
  ] },
  { version: 'v0.4.39', date: '2026-11-17', items: [
    { type: 'besser', text: 'Firestore-Regeln: Profil- und Bandnamen werden auch serverseitig geprüft (erlaubte Zeichen, höchstens 100 Zeichen). Alte, unveränderte Namen bleiben erlaubt. Die Regeln müssen in der Firebase-Konsole veröffentlicht werden.' },
    { type: 'besser', text: 'Bandname-Felder auf 60 Zeichen begrenzt.' }
  ] },
  { version: 'v0.4.38', date: '2026-11-17', items: [
    { type: 'besser', text: 'Texteingaben werden beim Verlassen des Feldes und bei Enter automatisch gesäubert: doppelte Leerzeichen, Leerzeichen am Rand und überzählige Leerzeilen entfallen.' }
  ] },
  { version: 'v0.4.37', date: '2026-11-17', items: [
    { type: 'neu', text: 'Texteingaben (Songtitel, Band, Namen, Notizen und so weiter): Emojis und seltene Sonderzeichen werden beim Tippen und Einfügen entfernt; oben erscheint eine rote Meldung mit dem Hinweis, stattdessen Sonderzeichen zu nutzen.' },
    { type: 'besser', text: 'Erlaubt sind Buchstaben (auch Ä, Ö, Ü und andere Sprachen), Zahlen und übliche Satzzeichen. Passwort-, E-Mail- und Zahlenfelder sind nicht betroffen.' },
    { type: 'besser', text: 'Umlaute in allen Exporten abgesichert (Textdateien mit UTF-8-Kennung, Word, PDF); Dateinamen behalten Buchstaben mit Akzenten; Import bereinigt Titel, Interpret und Notizen.' }
  ] },
  { version: 'v0.4.36', date: '2026-11-17', items: [
    { type: 'neu', text: 'Setlist: Export als Word-Datei (.docx) und als PDF-Datei zum Herunterladen; „PDF / Drucken“ heisst jetzt „Drucken“.' }
  ] },
  { version: 'v0.4.35', date: '2026-11-17', items: [
    { type: 'neu', text: 'Mein Kalender: eigene Termine lassen sich mit einer Band und einem Termin dieser Band verknüpfen; ein Klick auf die Verknüpfung springt dorthin.' }
  ] },
  { version: 'v0.4.34', date: '2026-11-17', items: [
    { type: 'neu', text: 'Startbildschirm: neue Anzeige „Veranstaltungen“ mit allen Gigs deiner Bands, umschaltbar zwischen Kommend und Vergangen; Klick öffnet die Gig-Karte.' }
  ] },
  { version: 'v0.4.33', date: '2026-11-17', items: [
    { type: 'neu', text: 'Timetable: Knopf „Gig öffnen“ springt zur Gig-Karte des gewählten Auftritts.' },
    { type: 'neu', text: 'Timetable-Eintrag: eigene Band fest verknüpfbar (Sprung zur Band aus der Timetable und aus dem Line-up, auch bei abweichendem Namen).' }
  ] },
  { version: 'v0.4.32', date: '2026-11-17', items: [
    { type: 'neu', text: 'Timetable: Eintrag kann mit einem Checklisten-Punkt des Gigs verknüpft werden (z. B. Soundcheck); der Punkt mit Haken erscheint im Eintrag.' }
  ] },
  { version: 'v0.4.31', date: '2026-11-17', items: [
    { type: 'besser', text: 'Online-Anzeige fragt nur noch alle 3 Minuten ab (weniger Datenverbrauch).' },
    { type: 'besser', text: 'Startbildschirm: Deine nächsten Termine zeigt nur noch die nächsten 3, vergangene fallen weg.' },
    { type: 'intern', text: 'Band-Mitglieder werden über eine gemeinsame Funktion geladen (weniger doppelter Code).' },
    { type: 'besser', text: 'Gelber Entwickler-Knopf ist versteckt: Strg+Umschalt+D, Adresse mit #dev oder 5x schnell auf das Housi-Zeichen tippen.' }
  ] },
  { version: 'v0.4.30', date: '2026-11-17', items: [
    { type: 'neu', text: 'Verpflegung im Gig: Textvorschläge zum Anklicken (Vegi-Menü, veganes Menü, ohne Schweinefleisch, glutenfrei, laktosefrei …).' },
    { type: 'besser', text: 'Datenschutzerklärung: neuer Punkt zu freiwilligen Angaben zu Ernährung und Allergien und wer sie sieht.' }
  ] },
  { version: 'v0.4.29', date: '2026-11-17', items: [
    { type: 'neu', text: 'Profil: freiwilliger Abschnitt „Ernährung und Allergien“ (Auswahl: vegetarisch, vegan … und 14 Hauptallergene, dazu Freitext). Nur mit Haken „für meine Bands verwenden“ erscheint eine anonyme Zusammenfassung (ohne Namen) als „Ernährung der Band“ auf der Gig-Karte.' }
  ] },
  { version: 'v0.4.28', date: '2026-11-17', items: [
    { type: 'neu', text: 'Finanzen freigegeben: Einnahmen und Ausgaben erfassen, bearbeiten, löschen; Summen pro Jahr, Kategorien, CSV-Export. Neue Rolle „Finanzen“ schaltet Bearbeiten frei (bei neuen Bands Standard; bestehende fügen sie unter Verwaltung → Rollen hinzu). Ohne Rolle sehen Mitglieder nur lesend.' }
  ] },
  { version: 'v0.4.27', date: '2026-11-17', items: [
    { type: 'neu', text: 'Gig-Karte: neuer klappbarer Abschnitt „Teilnehmer“ zeigt die im Termin gewählten Personen (nur wenn welche gewählt sind).' }
  ] },
  { version: 'v0.4.26', date: '2026-11-17', items: [
    { type: 'fix', text: 'Mobil: Der gelbe Entwickler-Knopf ist kleiner und Seiten haben unten Platz, damit er am Seitenende keinen Inhalt mehr verdeckt (Screenshot vom Galaxy XCover7).' }
  ] },
  { version: 'v0.4.25', date: '2026-11-17', items: [
    { type: 'neu', text: 'Termine und Gigs haben einen Abschnitt „Teilnehmer“ (leer = alle). Wer ausgewählt ist, sieht den Eintrag in „Mein Kalender“ unter „Mir zugeteilt“ (neuer Schalter). „Alle Band-Termine“ zeigt weiterhin alles.' }
  ] },
  { version: 'v0.4.24', date: '2026-11-17', items: [
    { type: 'neu', text: 'Startbildschirm: neue Anzeige „Mein Kalender“ (Monatsansicht) mit eigenen Terminen, deinen zugeteilten Checklisten-Punkten und optional Band-Terminen (Schalter). „+ Termin“ legt persönliche Termine an (nur für dich sichtbar). Braucht die neue Firestore-Regel für private/<uid>/events.' }
  ] },
  { version: 'v0.4.23', date: '2026-11-17', items: [
    { type: 'neu', text: 'Timetable: „Aus Gig kopieren“ übernimmt den Ablauf eines anderen Gigs als Vorlage (ohne Setlist-Verknüpfung, zu den bestehenden Einträgen hinzugefügt).' }
  ] },
  { version: 'v0.4.22', date: '2026-11-17', items: [
    { type: 'neu', text: 'Setlist: „🎤 Bühnenmodus“ – Vollbild mit grosser Schrift, aktuellem Eintrag, Notiz und nächstem Song; Weiterschalten per Tippen, Pfeiltasten/Leertaste oder Wischen; Bildschirm bleibt wach, wo der Browser es erlaubt.' }
  ] },
  { version: 'v0.4.21', date: '2026-11-17', items: [
    { type: 'neu', text: 'Setlist: Knopf „PDF / Drucken“ öffnet eine grosse, gut lesbare Druckansicht (im Druckdialog „Als PDF speichern“). Neu: „JSON importieren“ liest eine exportierte Setlist als neue Setlist ein.' }
  ] },
  { version: 'v0.4.20', date: '2026-11-17', items: [
    { type: 'neu', text: 'Neue Rollen „Setlist“ (Bearbeiten in Setlist und Songs) und „Timetable“ (Bearbeiten in der Timetable), wie die Rolle „Checkliste“. Für neue Bands in der Rollenliste; bestehende Bands fügen sie unter Verwaltung → Rollen hinzu.' }
  ] },
  { version: 'v0.4.19', date: '2026-11-17', items: [
    { type: 'neu', text: 'Gig-Line-up: Ist eine Band der Timetable auch eine deiner Bands in StageMate (gleicher Name), erscheint daneben „↗ Band öffnen“ und wechselt zu dieser Band.' }
  ] },
  { version: 'v0.4.18', date: '2026-11-17', items: [
    { type: 'neu', text: 'Standard-Genre pro Band: Admin setzt es unter Verwaltung → Band (Vorschlagsliste aus den Songs). Ohne Eintrag zeigt die App das häufigste Genre der Songs als Hinweis. Neue Songs übernehmen das Genre der Band als Vorgabe.' }
  ] },
  { version: 'v0.4.17', date: '2026-11-17', items: [
    { type: 'neu', text: 'Setlist öffentlich/intern wirkt jetzt: Im Gig-Line-up zeigt eine Band mit verknüpfter Setlist „🌐 n Songs“ (öffentlich, Songnamen im Tooltip) oder „🔒 intern“ (Songnamen nur mit Zugriff auf das Register Setlist).' }
  ] },
  { version: 'v0.4.16', date: '2026-11-17', items: [
    { type: 'neu', text: 'Entwicklerseite: Bands zeigen jetzt zusätzlich Songs, Setlists und Timetables (zusammen mit Mitgliedern und Termine).' }
  ] },
  { version: 'v0.4.15', date: '2026-11-17', items: [
    { type: 'neu', text: 'Gig: neuer klappbarer Abschnitt „Line-up“ zeigt alle Bands des Gigs aus der Timetable (eigene Band hervorgehoben); Klick öffnet die Timetable' },
  ] },
  { version: 'v0.4.14', date: '2026-11-17', items: [
    { type: 'neu', text: 'Desktop: Kalender, Gigs, Setlist, Songs, Timetable, Verwaltung und Startbildschirm füllen die ganze Breite; die Kalenderhöhe folgt der Fensterhöhe (passt sich beim Zoomen im Browser an den Bildschirmrand an)' },
  ] },
  { version: 'v0.4.13', date: '2026-11-17', items: [
    { type: 'neu', text: 'Setlist: Knopf „In Timetable des Gigs eintragen“ übernimmt Beginn, Ende, Songzahl und Verknüpfung in die Timetable des zugewiesenen Gigs (aktualisiert bei erneutem Klick); sichtbar im Kalender' },
  ] },
  { version: 'v0.4.12', date: '2026-11-17', items: [
    { type: 'neu', text: 'Status-Auswahl (Online, Privat, Offline) steht auf der Bandseite unter der Uhr oben links; auf dem Startbildschirm, bei eingeklappter Leiste und am Handy bleibt sie oben rechts' },
  ] },
  { version: 'v0.4.11', date: '2026-11-17', items: [
    { type: 'neu', text: 'Nutzungsbedingungen: neuer Abschnitt „Erstellung mit KI“ (App grösstenteils mit Claude erstellt, keine Verantwortung für unbeabsichtigte Rechtsverstösse, soweit gesetzlich zulässig); neue Fassung muss erneut akzeptiert werden' },
    { type: 'neu', text: 'Tipps: oben gut sichtbarer Hinweis „Dieses Tool wurde mit Claude (KI) erstellt“' },
    { type: 'neu', text: 'Anmeldebildschirm: Hinweis, dass das Tool mit Hilfe von KI erstellt wurde' },
    { type: 'neu', text: 'Tipps: gesperrter Knopf „Tutorial“ mit blauem Hinweis oben („Tutorials sind für die Prerelease-Phase (v0.9.0) geplant“)' },
  ] },
  { version: 'v0.4.10', date: '2026-11-17', items: [
    { type: 'neu', text: 'Profil: Bereich „Konto“ (Passwort ändern, Konto löschen) ist wie Persönliche Angaben und Deine Bands auf- und zuklappbar' },
  ] },
  { version: 'v0.4.9', date: '2026-11-17', items: [
    { type: 'neu', text: 'Kalender: Klick auf einen Gig öffnet die Gig-Seite mit aufgeklapptem Gig (kein Termin-Fenster mehr für Gigs)' },
    { type: 'neu', text: 'Termin erstellen: Kategorie „Gig“ nicht mehr wählbar; stattdessen gelber Knopf „Zur Gig-Seite“, danach leuchtet „Gig erstellen“ dreimal' },
    { type: 'neu', text: 'Gig: Verpflegung mit wählbarer Uhrzeit' },
  ] },
  { version: 'v0.4.8', date: '2026-11-17', items: [
    { type: 'neu', text: 'Gigs: Knopf „Zur Setlist“ springt zur verknüpften Setlist; ohne Verknüpfung oben rote Meldung „Noch keine Setlist verknüpft“ und blauer Hinweis' },
    { type: 'neu', text: 'Timetable-Eintrag: Bandname und Startzeit sind Pflicht; optional Ende oder Spieldauer, Anzahl Songs, Setlist-Verknüpfung (Sprung zur Setlist)' },
    { type: 'neu', text: 'Kalender Tagesansicht zeigt Ende, Songs und Setlist der Timetable-Einträge' },
    { type: 'neu', text: 'Import/Export Timetable: CSV-Spalten Uhrzeit;Band;Ende;Dauer;Songs;Notiz, Text „19:00 - 19:45 Bandname“' },
    { type: 'neu', text: 'Testdaten: pro Gig eine Timetable mit allen Bands des Line-ups, verknüpft mit Bands und Setlists; Test-Setlist ist dem ersten Gig der Band zugewiesen' },
  ] },
  { version: 'v0.4.7', date: '2026-11-16', items: [
    { type: 'neu', text: 'Neue Registerkarte Timetable: Ablauf der Band pro Gig (Uhrzeit, Titel, Notiz), Eingabefenster zum Erfassen und Bearbeiten' },
    { type: 'neu', text: 'Import per Textdatei (Zeile 16:00 Soundcheck) oder CSV (Uhrzeit;Titel;Notiz), auch per Einfügen; Export als Text oder CSV' },
    { type: 'neu', text: 'Kalender Tagesansicht: Knopf Timetable blendet die Einträge des Gigs ein oder aus' },
    { type: 'neu', text: 'Gigs: Knopf Timetable öffnet die Timetable des Gigs; Übersicht: neues Fenster mit der Timetable des nächsten Gigs' },
    { type: 'neu', text: 'Rechte für Timetable einstellbar; Firestore-Regeln erweitert (timetables)' },
  ] },
  { version: 'v0.4.6', date: '2026-11-16', items: [
    { type: 'neu', text: 'Neue Songs: in die Bibliothek aufnehmen, als Entwurf speichern (auch unvollständig) oder verwerfen' },
    { type: 'neu', text: 'Entwürfe erscheinen in den Songs, lassen sich aber nicht in eine Setlist übernehmen' },
    { type: 'neu', text: 'Genre wird in einem eigenen Fenster gewählt; vorgeschlagen werden alle Genres, die die Band verwendet' },
    { type: 'neu', text: 'Setlist: Sichtbarkeit Intern oder Öffentlich (Standard Intern; Wirkung folgt später)' },
    { type: 'intern', text: 'Testdaten: 10 Songs und 1 Setlist pro Band ohne Setlist' },
  ] },
  { version: 'v0.4.5', date: '2026-11-16', items: [
    { type: 'neu', text: 'Setlist: Übersicht aller Setlists als Karten, Klick öffnet die Setlist mit ihren Songs' },
    { type: 'neu', text: 'Setlist: Sortierung nach Name, Gig-Datum, Dauer, Anzahl Songs oder zuletzt geändert' },
    { type: 'neu', text: 'Neue Registerkarte „Songs“ (statt Fenster): suchen, sortieren, neu, bearbeiten, löschen; Rechte einstellbar' },
    { type: 'neu', text: 'Songs: Veröffentlichung (Album, EP oder Single) mit Namen als Pflichtfeld, dazu Genre' },
    { type: 'besser', text: 'Doppelwarnung ist ein Knopf: rot mit schwarzer Schrift bei Warnung, grau „KEINE WARNUNG“ nach dem Ausschalten; löst bei neuem doppelten Titel wieder aus' },
    { type: 'besser', text: '„+ aus Bibliothek“ heisst jetzt „Song hinzufügen oder erstellen“; Export-Knöpfe sind gelb' },
  ] },
  { version: 'v0.4.4', date: '2026-11-16', items: [
    { type: 'neu', text: 'Bandverwaltung: Wörter einstellen, die in der Setlist doppelt vorkommen dürfen (hinzufügen, entfernen, Standard wiederherstellen)' },
  ] },
  { version: 'v0.4.3', date: '2026-11-16', items: [
    { type: 'neu', text: 'Setlist: Warnung, wenn derselbe Titel doppelt vorkommt (Intro, Interlude, Break, Outro ausgenommen)' },
    { type: 'neu', text: 'Song-Bibliothek: Löschen und Bearbeiten als Knöpfe; neue Felder Album und Jahr' },
    { type: 'neu', text: 'Band gründen: Hinweis, dass sich auch Solo-Künstler als Band anmelden müssen' },
    { type: 'besser', text: 'Setlist: Zusammenfassung als einzelne Anzeigen, Export-Knöpfe mit Rahmen' },
    { type: 'fix', text: 'Song-Bibliothek schliesst sich beim Bearbeiten eines Songs (keine Überlappung mehr); es werden nur Songs der aktuellen Band gezeigt' },
  ] },
  { version: 'v0.4.2', date: '2026-11-16', items: [
    { type: 'neu', text: 'Setlist: mehrere Setlists pro Band, Songs, Intro, Outro, Zwischenteil, Pause und Ansage, per Griff verschiebbar' },
    { type: 'neu', text: 'Setlist: Gesamtdauer, Uhrzeit pro Element (ab Beginn), Soll-Länge mit Warnung, Gig zuweisen, duplizieren' },
    { type: 'neu', text: 'Setlist: Song-Bibliothek der Band und Export als Text, CSV oder JSON' },
    { type: 'neu', text: 'Startbildschirm: „Setlist erstellen“ funktioniert jetzt' },
  ] },
  { version: 'v0.4.1', date: '2026-11-16', items: [
    { type: 'neu', text: 'Startbildschirm: Anzeigen in 2 Stufen zuklappbar (halb, eine Zeile); Zustand wird gemerkt' },
    { type: 'besser', text: 'Verschieben: Anzeige schwebt, sobald sie am Griff gepackt wird' },
  ] },
  { version: 'v0.4.0', date: '2026-11-16', items: [
    { type: 'neu', text: 'Bandseite → Verwaltung: Mitglieder nach Rang gruppiert (Admins, Organisation, Mitglieder, ohne Rolle)' },
    { type: 'fix', text: 'Bandseite → Übersicht: Griff zum Verschieben wieder sichtbar' },
    { type: 'fix', text: 'Handy: Verwaltung läuft nicht mehr über den Bildschirmrand (Auswahlfelder, Rollen, Kategorien)' },
    { type: 'besser', text: 'Handy-Darstellung auf allen Seiten bei 360 und 390 Pixel Breite geprüft' },
  ] },
  { version: 'v0.3.6', date: '2026-11-16', items: [
    { type: 'neu', text: 'Persönliche Übersicht: Anzeige „Schnell erstellen“ (Gig, Termin, Checkliste; Setlist folgt)' },
    { type: 'neu', text: 'Changelog-Knopf neben Nutzungsbedingungen und Datenschutz: ganzer Changelog, verschachtelt nach Version' },
    { type: 'besser', text: 'Persönliche Übersicht: Anzeigen werden immer nach oben zusammengeschoben' },
    { type: 'besser', text: 'Alle klickbaren Texte sind jetzt Knöpfe (u. a. Alle auf-/zuklappen, CSV exportieren)' },
    { type: 'besser', text: 'Bandseite → Übersicht: Mitgliederliste halbe Breite, höchstens 5 sichtbar, dann scrollen' },
    { type: 'besser', text: 'Entwickler-Knopf etwas grösser und gelb' },
  ] },
  { version: 'v0.3.5', date: '2026-11-16', items: [
    { type: 'neu', text: 'Persönliche Übersicht: neue Anzeige „Dein nächster Gig“ (aus allen Bands, mit Countdown, Ort und Zeitplan)' },
    { type: 'besser', text: 'Alle Anzeigen je ein Drittel breit; Verschieben ist animiert; Umschalter für die Breite und Zähler entfernt' },
    { type: 'besser', text: 'Vorschau (Glühbirne) bei Mauszeiger und Darstellung entfernt' },
    { type: 'besser', text: 'Tipps an den neuen Aufbau angepasst (Übersicht, Status, nächster Gig)' },
  ] },
  { version: 'v0.3.4', date: '2026-11-16', items: [
    { type: 'besser', text: 'Entwickler-Anmeldung: zeigt das verwendete Firebase-Konto und erklärt genau, warum die Anmeldung nicht klappt' },
  ] },
  { version: 'v0.3.3', date: '2026-11-16', items: [
    { type: 'fix', text: 'Entwickler-Anmeldung auf der Anmeldeseite zeigte keine Daten (las den leeren lokalen Speicher statt Firebase)' },
  ] },
  { version: 'v0.3.2', date: '2026-11-16', items: [
    { type: 'neu', text: 'Persönliche Übersicht: einzelne Anzeigen statt Klappmenüs, mit dem Griff ⠿ verschiebbar (neben- und untereinander), Breite mit ⇔ umschaltbar' },
    { type: 'neu', text: 'Eigenen Status oben rechts wählen: Automatisch, Online, Privat oder Offline' },
    { type: 'besser', text: 'Entwickler-Verwaltung: Diagnose-Zeile (was geladen wurde, Fehler) und Hinweis, wenn keine Daten vorhanden sind' },
  ] },
  { version: 'v0.3.1', date: '2026-11-16', items: [
    { type: 'besser', text: 'Persönliche Übersicht ohne Seitenleiste, mit eigener Kopfzeile (Logo, Status, Uhr, Tipps, Support, Abmelden)' },
    { type: 'besser', text: 'Die Bandseite öffnet sich nur noch über die Bandwahl auf der Übersicht' },
    { type: 'besser', text: 'Profil und Einstellungen gibt es nur noch auf der persönlichen Übersicht' },
  ] },
  { version: 'v0.3.0', date: '2026-11-16', items: [
    { type: 'neu', text: 'Nach der Anmeldung immer zuerst der persönliche Startbildschirm, erst dann die Bandseite' },
    { type: 'neu', text: 'Online-Status „Privat“ (blau), solange du auf dem Startbildschirm bist' },
    { type: 'besser', text: 'Unten links „Zurück zum Startbildschirm“ statt „Abmelden“; Abmelden jetzt oben rechts auf dem Startbildschirm' },
    { type: 'neu', text: 'Entwickler-Zugang (Knopf unten rechts): Band- und Benutzerverwaltung mit Einsicht in alle Daten' },
    { type: 'neu', text: 'Handy: Seitenleiste in drei Stufen – offen, nur Symbole, ganz weg (Pfeil am Rand)' },
  ] },
  { version: 'v0.2.1', date: '2026-11-16', items: [
    { type: 'fix', text: 'Registerkarten sind auch auf dem Startbildschirm sichtbar (öffnen die zuletzt geöffnete Band)' },
    { type: 'neu', text: 'Registerkarten in der Seitenleiste auf- und zuklappbar' },
    { type: 'neu', text: 'Startbildschirm: deine nächsten Termine und deine Checklisten-Punkte aus allen Bands' },
    { type: 'neu', text: 'Startbildschirm: Band beitreten, Band gründen, Band suchen' },
  ] },
  { version: 'v0.2.0', date: '2026-11-16', items: [
    { type: 'neu', text: 'Alpha-Phase (Fahrplan: Beta 0.5.0, Prerelease 0.9.0, Release 1.0.0)' },
    { type: 'neu', text: 'Alle Dateien tragen Version, Build und Datum in der ersten Zeile' },
    { type: 'neu', text: 'Register «Setlist» als Baustelle mit blauem Hinweis und Zurück-Knopf' },
    { type: 'neu', text: 'Vor- und Zurück-Knöpfe oben neben dem Seitentitel' },
    { type: 'neu', text: 'Glühbirne mit kleiner Vorschau bei allen optischen Einstellungen' },
    { type: 'neu', text: 'Testdaten-Generator (testdaten.html): 30 Konten, 5 Bands, 7 Gigs mit Checklisten' },
    { type: 'besser', text: 'Seitenleiste: Bandname und Logo zuoberst, darunter Uhr und Datum übereinander, Trennlinie zu den Registern' },
    { type: 'besser', text: 'Datumsformat nur noch tt.mm.jj, mm.tt.jj oder jj.mm.tt' },
    { type: 'besser', text: 'Finanzen: blauer Hinweis «Befindet sich im Bau» oben, Sperrmeldung wie bei anderen Sperren' },
  ] },
  { version: 'v0.1.11', date: '2026-11-16', items: [
    { type: 'neu', text: 'Startbildschirm: Bands, Profil und Einstellungen auf einem Bildschirm, als Klappmenüs' },
    { type: 'neu', text: '«Zurück zum Startbildschirm» unten links; Bandauswahl in der Seitenleiste entfernt' },
    { type: 'neu', text: 'Online-Status: Anzeige «x / y online» unter dem Bandnamen, Mitgliederliste mit Sortierung in der Übersicht' },
    { type: 'neu', text: 'Uhr und Datum oben links (digital oder analog, gemäss Einstellungen)' },
    { type: 'neu', text: 'Einstellungen → Sichtbarkeit: alle persönlichen Sichtbarkeiten an einem Ort, Knopf zur Bandsichtbarkeit' },
    { type: 'neu', text: 'Profil und Einstellungen: Knöpfe zu Sichtbarkeit, Nutzungsbedingungen und Datenschutz' },
    { type: 'besser', text: 'Tipps als Klappmenüs nach Bereichen, ergänzt' },
    { type: 'fix', text: 'Finanzen-Sperre greift für alle; neue Versionen werden sofort geladen (kein alter Zwischenspeicher)' },
  ] },
  { version: 'v0.1.10', date: '2026-11-16', items: [
    { type: 'neu', text: 'Profilbild verbergen: andere sehen es verschwommen mit Schloss, ein Klick zeigt den Hinweis' },
    { type: 'neu', text: 'Verborgenes Bandlogo: verschwommen mit Schloss (nur Admin/Organisation sehen es klar)' },
    { type: 'neu', text: 'Sichtbare Profilbilder und Bandlogos per Klick gross ansehen' },
    { type: 'neu', text: 'Profil & Bands: Bereiche auf- und zuklappen, Alle auf-/zuklappen' },
    { type: 'besser', text: 'Finanzen: Hinweis «Befindet sich im Bau», alle Funktionen gesperrt' },
    { type: 'besser', text: 'Verborgene Profilbilder werden nur im privaten Bereich gespeichert' },
  ] },
  { version: 'v0.1.9', date: '2026-11-16', items: [
    { type: 'besser', text: 'Datenschutz: E-Mail und Telefon getrennt gespeichert, nur für dich und Mitglieder gemeinsamer Bands lesbar' },
    { type: 'besser', text: 'Bestehende Profile werden beim Anmelden automatisch umgestellt' },
    { type: 'besser', text: 'Firestore-Regeln prüfen Format und 5-Minuten-Sperre des Band-Tags' },
  ] },
  { version: 'v0.1.8', date: '2026-11-16', items: [
    { type: 'neu', text: 'Nach dem Anmelden: Übersicht «Deine Bands» mit Logo, Tag und Rollen; ein Klick öffnet die Band' },
    { type: 'besser', text: 'Sichtbarkeitseinstellungen der Band gelten auch in der Übersicht' },
  ] },
  { version: 'v0.1.7', date: '2026-11-16', items: [
    { type: 'neu', text: 'Band-Tag (1–3 Zeichen): bei der Gründung setzen oder generieren, in der Verwaltung änderbar (höchstens alle 5 Minuten)' },
    { type: 'neu', text: 'Sichtbarkeit von Bandlogo, Bandname und Band-Tag einstellbar' },
    { type: 'neu', text: 'Band-Tags erscheinen neben dem Nickname und in der Bandliste' },
    { type: 'neu', text: 'PUID: eine feste ID pro Konto, im Profil per Klick einblendbar' },
    { type: 'neu', text: 'Nickname muss eindeutig sein; gesperrte Wörter (Liste in badwords.js)' },
    { type: 'neu', text: 'E-Mail-Eingabe in drei Feldern: name @ domain . endung' },
    { type: 'neu', text: 'Persönliche Angaben ändern nur mit Passwort (Web-Version)' },
    { type: 'besser', text: 'Regeln für den automatischen Tag in tagrules.js, selbst bearbeitbar' },
  ] },
  { version: 'v0.1.6', date: '2026-11-16', items: [
    { type: 'neu', text: 'Registrierung mit Nickname, Vorname und Nachname' },
    { type: 'neu', text: 'Nutzungsbedingungen und Datenschutzerklärung (müssen akzeptiert werden)' },
    { type: 'neu', text: 'Passwort ansehen: Auge gedrückt halten' },
    { type: 'neu', text: 'Konto: Passwort ändern und Konto löschen (Web-Version)' },
    { type: 'neu', text: 'Housi-Logo unten rechts' },
    { type: 'besser', text: 'Web-Version: kein zweites E-Mail-Feld mehr, die Konto-E-Mail gilt' },
    { type: 'besser', text: 'Angaben aus «Anmelden» werden nicht in «Konto erstellen» übernommen' },
    { type: 'besser', text: 'Firestore-Regeln: Termine und Finanzen nur für Mitglieder der Band' },
    { type: 'besser', text: 'Facebook-Link und Blüemlifigger-Satz entfernt' },
  ] },
  { version: 'v0.1.5', date: '2026-11-16', items: [
    { type: 'neu', text: 'Web-Version mit Firebase: eigenes StageMate-Konto (E-Mail und Passwort), ohne Claude-Konto nutzbar' },
    { type: 'neu', text: 'Passwort vergessen: Link zum Zurücksetzen per E-Mail' },
    { type: 'intern', text: 'Firestore-Regeln: nur angemeldete Benutzer, Profile nur durch die Person selbst änderbar' },
  ] },
  { version: 'v0.1.4', date: '2026-11-16', items: [
    { type: 'intern', text: 'Eigene Datenschicht: alle Datenzugriffe laufen über eine Stelle (Vorbereitung für Firebase)' },
    { type: 'intern', text: 'Projekt in Dateien aufgeteilt: Oberfläche, Stil, Datenschicht, Version und App-Logik' },
    { type: 'intern', text: 'Build-Nummer, Build-Datum und Changelog eingeführt' },
  ] },
  { version: 'v0.1.3', date: '2026-11-14', items: [
    { type: 'neu', text: 'Beispielumsätze im Register Finanzen' },
  ] },
  { version: 'v0.1.2', date: '2026-11-14', items: [
    { type: 'neu', text: 'Finanzen: optionale Uhrzeit bei Einnahmen und Ausgaben' },
  ] },
  { version: 'v0.1.1', date: '2026-11-14', items: [
    { type: 'neu', text: 'Register Finanzen mit Einnahmen, Ausgaben und CSV-Export' },
  ] },
  { version: 'v0.1.0', date: '2026-11-14', items: [
    { type: 'neu', text: 'Versionsnummer unten links und in Export-Dateinamen' },
    { type: 'neu', text: 'Pre-Alpha-Grundfunktionen: Bands, Rollen und Rechte, Kalender (Tag/Woche/Monat/Jahr), Gigs, Checklisten, Übersicht, Einstellungen, Tipps, Support' },
  ] },
];
