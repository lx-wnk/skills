---
name: session-handoff
description: >-
  Erstelle ein strukturiertes Handoff-Dokument am Ende einer Arbeitssession — was wurde implementiert,
  welche Entscheidungen wurden getroffen und warum, offene Fragen, und empfohlene nächste Schritte.
  Das Dokument wird als `outputs/HANDOFF.md` abgelegt (Repo-Konvention, vgl. `branch-review`).
  Verwende diesen Skill immer wenn der Nutzer die Session beenden will, eine Übergabe erstellen möchte,
  oder sagt: "session-handoff", "Handoff erstellen", "Session abschließen", "was haben wir heute gemacht",
  "Zusammenfassung der Session", "nächste Schritte dokumentieren", "übergib an nächste Session",
  "wrap up", "end of session", "session summary".
user-invocable: true
argument-hint: "[Fokusthemen oder Zeithinweis, z.B. 'Fokus: Auth-Refactoring' oder 'seit Montag']"
allowed-tools: "Bash(git *) Bash(date *) Bash(basename *) Bash(mkdir *) Read Write Edit"
---

# Session Handoff

Erstelle am Ende einer Arbeitssession ein strukturiertes Handoff-Dokument unter `outputs/HANDOFF.md`.
Ziel: Die nächste Session (oder ein anderer Entwickler) kann sofort dort weitermachen, wo diese aufgehört hat —
ohne alten Kontext mühsam rekonstruieren zu müssen.

**Sprache:** Handoff-Inhalt immer auf Deutsch schreiben, auch wenn Commits oder Code auf Englisch sind.

**Output-Pfad:** Immer `outputs/HANDOFF.md` (konsistent mit `branch-review`/`full-project-review`).
`outputs/` sollte projektweit per `.gitignore` ignoriert sein; das ist Aufgabe des Repos, nicht dieses Skills.

## Beispiele

```bash
# Einfacher Handoff ohne weitere Argumente
/session-handoff

# Mit optionalem Fokushinweis
/session-handoff Fokus: Auth-Refactoring und neue API-Endpoints

# Mit Zeithinweis (überschreibt die Default-Heuristik)
/session-handoff seit Montag
```

## Schritt 1: Session-Grenze bestimmen

Die Session-Grenze entscheidet, welche Commits in den Handoff gehören. Reihenfolge:

1. **Konversationskontext zuerst.** Du weißt aus dieser Konversation, wann die Session begonnen hat —
   nutze dieses Wissen primär. Beispiel: "Wir haben heute mit dem Auth-Refactoring angefangen" → nur Commits ab dem ersten Refactoring-Commit.
2. **`$ARGUMENTS`-Zeithinweis** (wenn vorhanden): "seit Montag", "letzte 2 Tage", "heute" → in `--since="..."` umsetzen.
3. **Fallback-Heuristik** (nur wenn 1+2 nichts liefern): die letzten 20 Commits nehmen und im Handoff explizit
   vermerken, dass die Session-Grenze unsicher ist.

Verlasse dich nicht auf `@{N hours ago}` — diese Reflog-Syntax ist auf frischen Clones leer und liefert
falsch-leere Diffs.

## Schritt 2: Daten sammeln

```bash
# Datum/Uhrzeit inkl. Zeitzone → befüllt {DATUM_UTC}
date -u '+%Y-%m-%d %H:%M UTC'

# Repo-Name → befüllt {REPO-NAME}
basename "$(git rev-parse --show-toplevel)"

# Aktueller Branch → befüllt {BRANCH}
git branch --show-current
```

Für den Commit-Range nutze die in Schritt 1 bestimmte Grenze. Beispiele:

```bash
# Variante A: Konversationskontext sagt "seit Commit <SHA>"
git log --oneline <SHA>..HEAD

# Variante B: $ARGUMENTS hat einen Zeithinweis (in --since umgesetzt)
git log --oneline --since="<übersetzter Zeithinweis>"

# Variante C: Fallback (Session-Grenze unsicher)
git log --oneline -20
```

Geänderte Dateien für denselben Range: `git log --name-only --pretty=format: <range> | sort -u`.

```bash
# Aktuell offene / uncommittete Änderungen
git status --short

# Offene TODOs im Code (häufige Patterns, inkl. ungetrackter Dateien)
git grep --untracked -n "TODO\|FIXME\|HACK\|XXX\|NOCOMMIT" -- ':!*.lock' ':!node_modules' 2>/dev/null | head -40
```

Lies optional relevante Dateien, die durch die Git-Daten als zentral identifiziert werden
(z.B. kürzlich stark veränderte Dateien, CLAUDE.md falls vorhanden).

## Schritt 3: HANDOFF.md schreiben

**Output-Verzeichnis sicherstellen:**

```bash
mkdir -p outputs
```

**Existierende Datei prüfen:**

- Existiert `outputs/HANDOFF.md` schon → **Default: neuen datierten Abschnitt oben anhängen** (alte Abschnitte bleiben erhalten).
- Nur dann fragen, wenn der User eine andere Strategie signalisiert ("ersetzen", "neu schreiben").

**Dateiinhalt erzeugen** anhand des folgenden Schemas. **Wichtig:** Die HTML-Kommentare (`<!-- ... -->`)
sind Anweisungen für dich — sie gehören **nicht** in die finale Datei. Ersetze jeden Kommentar durch den
ausgefüllten Inhalt oder lasse den Abschnitt mit `_(keine)_` leer.

```markdown
# Session Handoff — {DATUM_UTC}

> Generiert von `/session-handoff` · Repo: {REPO-NAME} · Branch: {BRANCH}

---

## Was wurde implementiert

<!-- Liste der konkreten Änderungen dieser Session, gruppiert nach Feature/Bereich.
     Jeder Punkt sollte klar machen: Was? Wo (Datei/Modul)? -->

- ...

## Commits dieser Session

<!-- Die relevanten Git-Commits als kompakte Liste -->

| Hash | Nachricht |
| ---- | --------- |
| ...  | ...       |

## Uncommitted Änderungen (WIP)

<!-- Automatisch aus `git status --short` befüllt — zeigt, was noch nicht committed wurde.
     Falls keine uncommitteten Änderungen: `_(keine)_` schreiben. -->

- ...

## Wichtige Entscheidungen

<!-- Architektur- oder Design-Entscheidungen, die getroffen wurden — und WARUM.
     Wichtig: auch verworfene Alternativen kurz nennen, damit die nächste Session
     nicht dieselben Irrwege geht. -->

- **Entscheidung:** ...
  **Begründung:** ...

## Offene Fragen

<!-- Was ist ungeklärt? Was müsste noch besprochen, recherchiert oder entschieden werden?
     Konkret und umsetzbar formulieren. -->

- [ ] ...

## Offene TODOs im Code

<!-- Automatisch aus `git grep TODO/FIXME` befüllt — nur relevante, keine alten -->

- [ ] `datei.ts:42` — ...

## Empfohlene nächste Schritte

<!-- Priorisierte Aufgaben für die nächste Session. Erste Priorität oben.
     Jeder Schritt sollte sofort ausführbar sein (kein vages "weiter machen"). -->

- [ ] ...
- [ ] ...
- [ ] ...

---

_Letzte Aktualisierung: {DATUM_UTC}_
```

### Hinweise zum Ausfüllen

**Was wurde implementiert:** Leite dies aus den Git-Commits und geänderten Dateien ab.
Fasse zusammen, was logisch zusammengehört — nicht jeden Commit einzeln auflisten,
sondern nach Feature/Bereich gruppieren.

**Entscheidungen:** Schreibe auch auf, was _nicht_ umgesetzt wurde und warum.
Diese Information ist oft wertvoller als die Beschreibung des Umgesetzten.

**Uncommitted Änderungen:** Befülle den Abschnitt mit der Ausgabe von `git status --short`.
Falls keine uncommitteten Änderungen vorhanden sind, schreibe `_(keine)_`.

**Offene TODOs:** Filtere `git grep`-Ergebnisse — nur TODOs, die in dieser Session
entstanden oder relevant für die nächsten Schritte sind. Alte TODOs in unberührten Dateien
weglassen.

**Nächste Schritte:** Sei konkret. Statt "Tests schreiben" lieber
"Unit-Tests für `AuthService.login()` in `tests/auth.test.ts` schreiben".

**Optionale Argumente (`$ARGUMENTS`):** Falls der Nutzer Fokusthemen, Notizen oder einen Zeithinweis
übergeben hat, berücksichtige diese in Schritt 1 (Session-Grenze) und beim Priorisieren der nächsten
Schritte.

## Schritt 4: Bestätigung

Teile dem Nutzer mit:

- Pfad der erstellten/aktualisierten Datei (`outputs/HANDOFF.md`)
- Kurze Zusammenfassung: wie viele Commits, wie viele offene Fragen, wie viele nächste Schritte
- Ob ein neuer Abschnitt angehängt oder die Datei neu erstellt wurde

## Verwandte Skills

- `agent-context-update` — wenn projekt-übergreifendes Wissen aus dieser Session in den Agent-Context fließen soll, ergänzend zum Handoff.
- `branch-review` — wenn vor dem Handoff noch ein Code-Review der Session-Änderungen gewünscht ist.
