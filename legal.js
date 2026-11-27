/*! StageMate v0.6.7 · Build 86 · 2026-11-27 */
/* StageMate – Nutzungsbedingungen und Datenschutzerklärung
 * Vorlage, keine Rechtsberatung. Bei Änderungen LEGAL_VERSION anpassen:
 * dann müssen alle Benutzer die neue Fassung erneut akzeptieren.
 */
const LEGAL_VERSION = '2026-11-17';

const LEGAL_TERMS = `
<h4>1. Anbieter</h4>
<p>StageMate (bis November 2026 „Stagemate“ geschrieben) ist ein privates, nicht-kommerzielles Projekt von Housi Guntern, Schweiz. Kontakt: Instagram oder TikTok <b>housi_666</b>.</p>

<h4>2. Gegenstand</h4>
<p>StageMate ist eine kostenlose Web-App zur Organisation von Bands. Sie befindet sich in der <b>Alpha-Phase</b>. Funktionen, Aussehen und gespeicherte Daten können sich jederzeit ändern, eingeschränkt oder ganz eingestellt werden. Es besteht kein Anspruch auf Verfügbarkeit, Fehlerfreiheit oder dauerhafte Speicherung. Sichere wichtige Informationen zusätzlich selbst.</p>

<h4>3. Erstellung mit KI</h4>
<p>Diese Web-App wurde zum grössten Teil mit Hilfe der KI <b>Claude</b> (Anthropic) erstellt. Programmcode, Texte und Gestaltung stammen daher teilweise von einer KI. Ich habe darauf nur begrenzten Einfluss und kann nicht ausschliessen, dass dabei ungewollt Inhalte oder Code entstanden sind, die Rechte Dritter verletzen (z.B. Urheberrechte). Das geschieht nicht absichtlich. Für solche unbeabsichtigten Verstösse übernehme ich, soweit gesetzlich zulässig, keine Verantwortung und keine Gewähr. Hinweise auf mögliche Verstösse nehme ich über die Support-Kanäle entgegen und prüfe sie.</p>

<h4>4. Konto</h4>
<p>Du machst wahre Angaben, hältst dein Passwort geheim und bist für alle Aktivitäten in deinem Konto verantwortlich. Die Nutzung ist ab 16 Jahren erlaubt, jüngere Personen brauchen das Einverständnis ihrer Eltern.</p>

<h4>5. Verhaltensregeln</h4>
<p>Verboten sind insbesondere:</p>
<ul>
<li>rassistische, menschenverachtende, diskriminierende, sexistische oder gewaltverherrlichende Inhalte,</li>
<li>Mobbing, Belästigung, Beleidigung, Drohungen und Blossstellen anderer Personen,</li>
<li>pornografische oder strafbare Inhalte,</li>
<li>Verletzung von Rechten Dritter (z.B. Persönlichkeits-, Urheber- oder Markenrechte),</li>
<li>Spam, Schadsoftware, Betrugsversuche und das Ausnutzen von Sicherheitslücken.</li>
</ul>
<p>Das gilt für alle Eingaben, auch für Nicknames, Bandnamen, Notizen und Bilder.</p>

<h4>6. Verantwortung für Inhalte</h4>
<p>Für alle Inhalte, die du eingibst oder hochlädst, bist <b>allein du verantwortlich</b>. Der Anbieter prüft Inhalte nicht. Er darf Inhalte, die gegen diese Bedingungen verstossen, ohne Vorankündigung löschen und Konten sperren oder löschen.</p>

<h4>7. Sicherheit und Links</h4>
<p>Der Anbieter fragt dich <b>nie</b> per Nachricht nach deinem Passwort. Offizielle Hinweise kommen nur aus StageMate selbst oder von den Kanälen <b>housi_666</b>. Klicke keine Links an, die nicht nachweislich vom Anbieter stammen. Links und Dateien anderer Benutzer öffnest du auf eigene Gefahr.</p>
<p>Trotz Schutzmassnahmen lässt sich nicht ausschliessen, dass Daten durch Hackerangriffe, technische Fehler oder Fehler Dritter verloren gehen oder unberechtigt eingesehen werden.</p>

<h4>8. Haftung und Gewährleistung</h4>
<p>StageMate wird ohne jede Gewährleistung zur Verfügung gestellt. Soweit gesetzlich zulässig, ist jede Haftung des Anbieters ausgeschlossen, insbesondere für Datenverlust, Ausfälle, Fehlfunktionen, verpasste Termine, finanzielle Einbussen, Inhalte anderer Benutzer, Hackerangriffe und Schäden durch Dienste Dritter (z.B. Google, GitHub). Vorbehalten bleibt die zwingende Haftung für rechtswidrige Absicht und grobe Fahrlässigkeit (Art. 100 OR).</p>
<p>Du stellst den Anbieter von Ansprüchen Dritter frei, die aus deinen Inhalten oder deinem Verhalten entstehen.</p>

<h4>9. Änderungen</h4>
<p>Der Anbieter kann diese Bedingungen ändern. Eine neue Fassung musst du beim nächsten Anmelden akzeptieren, um StageMate weiter zu nutzen.</p>

<h4>10. Beendigung</h4>
<p>Du kannst dein Konto jederzeit unter <b>Profil &amp; Bands → Konto</b> löschen.</p>

<h4>11. Recht und Gerichtsstand</h4>
<p>Es gilt Schweizer Recht. Gerichtsstand ist, soweit gesetzlich zulässig, der Wohnsitz des Anbieters.</p>

<h4>12. Teilunwirksamkeit</h4>
<p>Ist eine Bestimmung unwirksam, bleiben die übrigen gültig. An ihre Stelle tritt eine zulässige Regelung, die dem Zweck möglichst nahekommt.</p>
`;

const LEGAL_PRIVACY = `
<h4>1. Verantwortlicher</h4>
<p>Housi Guntern, Schweiz (privates Projekt). Kontakt: Instagram oder TikTok <b>housi_666</b>.</p>

<h4>2. Welche Daten</h4>
<ul>
<li>Konto: E-Mail-Adresse und Passwort. Das Passwort speichert Google verschlüsselt, der Anbieter kann es nicht sehen.</li>
<li>Profil: Nickname, Vorname, Nachname, optional Telefon und Profilbild.</li>
<li>Freiwillig: Ernährung und Allergien (Auswahl und Freitext). Das sind Angaben zur Gesundheit im weiteren Sinn. Sie werden nur gespeichert, wenn du sie ausfüllst, und du kannst sie jederzeit ändern oder löschen.</li>
<li>Bandinhalte: Bands, Rollen, Termine, Gigs, Checklisten, Finanzen, Kontakte und Notizen.</li>
<li>Technisch: Beim Aufruf der Seite verarbeiten die Server-Anbieter u.a. deine IP-Adresse.</li>
</ul>

<h4>3. Zweck</h4>
<p>Die Daten werden nur für den Betrieb von StageMate verwendet. Kein Verkauf, keine Werbung, kein Tracking, keine Analyse-Tools.</p>

<h4>4. Wo die Daten liegen</h4>
<ul>
<li><b>Google Firebase</b> (Google): Anmeldung und Datenbank. Die Datenbank liegt in der Region europe-west6 (Zürich). Der Anmeldedienst kann Daten auch ausserhalb der Schweiz verarbeiten, u.a. in den USA.</li>
<li><b>GitHub Pages</b> (GitHub, USA): liefert die Web-App aus und verarbeitet dabei technische Zugriffsdaten.</li>
</ul>
<p>Mit der Nutzung nimmst du zur Kenntnis, dass Daten dabei ins Ausland bekanntgegeben werden können.</p>

<h4>5. Wer was sieht</h4>
<p>Mitglieder einer Band sehen die Inhalte dieser Band und die Profile der anderen Mitglieder. Ob E-Mail und Telefon sichtbar sind, stellst du unter <b>Einstellungen</b> ein. Ernährung und Allergien werden nur mit deinem Haken „Für die Verpflegung meiner Bands verwenden“ als anonyme Zusammenfassung ohne Namen in der Verpflegung der Gigs angezeigt. Technisch liegen deine vollständigen Angaben in einem privaten Dokument, das nur du lesen kannst. Nur wenn du den Haken setzt, entsteht eine Kopie für deine Bands; ohne Haken gibt es keine. Der Betreiber der App (Entwickler) kann zur Wartung und Fehlersuche technisch alle gespeicherten Daten einsehen, auch private; er nutzt sie nur dafür.</p>

<h4>6. Daten anderer Personen</h4>
<p>Trägst du Daten anderer Personen ein (z.B. Kontakte bei Gigs), bist du dafür verantwortlich, dass diese damit einverstanden sind.</p>

<h4>7. Sicherheit</h4>
<p>Der Zugriff ist nur mit Konto möglich, die Verbindung ist verschlüsselt. Eine absolute Sicherheit gibt es aber nicht. Du gibst Daten in eigener Verantwortung ein. Speichere keine besonders schützenswerten Daten (z.B. Gesundheitsdaten, Passwörter, Bankdaten) in StageMate.</p>

<h4>8. Speicherdauer</h4>
<p>Deine Profildaten bleiben gespeichert, bis du dein Konto löschst. Bandinhalte bleiben bestehen, bis die Band aufgelöst wird.</p>

<h4>9. Speicher im Browser</h4>
<p>StageMate speichert Einstellungen wie Design oder Sortierung lokal in deinem Browser. Es gibt keine Werbe- oder Tracking-Cookies.</p>

<h4>10. Deine Rechte</h4>
<p>Du kannst Auskunft über deine Daten verlangen, sie berichtigen und löschen lassen. Dein Konto löschst du selbst unter <b>Profil &amp; Bands → Konto</b>. Für alles Weitere melde dich über die Kontaktkanäle.</p>

<h4>11. Änderungen</h4>
<p>Diese Erklärung kann angepasst werden. Es gilt die jeweils in StageMate angezeigte Fassung.</p>
`;
