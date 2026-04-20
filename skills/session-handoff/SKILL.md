---
name: session-handoff
description: >-
  Erstelle ein strukturiertes Handoff-Dokument am Ende einer Arbeitssession — was wurde implementiert,
  welche Entscheidungen wurden getroffen und warum, offene Fragen, und empfohlene nächste Schritte.
  Das Dokument wird als HANDOFF.md im Repo-Root abgelegt.
  Verwende diesen Skill immer wenn der Nutzer die Session beenden will, eine Übergabe erstellen möchte,
  oder sagt: "session-handoff", "Handoff erstellen", "Session abschließen", "was haben wir heute gemacht",
  "Zusammenfassung der Session", "nächste Schritte dokumentieren", "übergib an nächste Session",
  "wrap up", "end of session", "session summary".
user-invocable: true
argument-hint: "[optionale Notizen oder Fokusthemen, z.B. 'Fokus: Auth-Refactoring']"
allowed-tools: "Bash(git *) Bash(date) Read Write Edit"
---

# Session Handoff

Erstelle am Ende einer Arbeitssession ein strukturiertes Handoff-Dokument (`HANDOFF.md`) im Repo-Root.
Ziel: Die nächste Session (oder ein anderer Entwickler) kann sofort dort weitermachen, wo diese aufgehört hat —
ohne alten Kontext mühsam rekonstruieren zu müssen.

**Sprache:** Handoff-Inhalt immer auf Deutsch schreiben, auch wenn Commits oder Code auf Englisch sind.

## Beispiele

```bash
# Einfacher Handoff ohne weitere Argumente
/session-handoff

# Mit optionalem Fokushinweis
/session-handoff Fokus: Auth-Refactoring und neue API-Endpoints
```

## Schritt 1: Daten sammeln

Führe diese Befehle aus, um die Session zu rekonstruieren:

```bash
# Aktuelles Datum und Uhrzeit → befüllt {DATUM} und {UHRZEIT}
date '+%Y-%m-%d %H:%M'

# Repo-Name → befüllt {REPO-NAME}
basename "$(git rev-parse --show-toplevel)"

# Git-Log der Session
# Heuristik: "letzte 8 Stunden" ist nur ein Fallback — bevorzuge den Konversationskontext,
# um die Session-Grenze zu bestimmen. Falls $ARGUMENTS einen Zeithinweis enthält
# (z.B. "seit Montag", "letzte 2 Tage"), nutze diesen stattdessen.
git log --oneline --since="8 hours ago" 2>/dev/null || git log --oneline -20

# Zuletzt geänderte Dateien (von erstem Commit bis HEAD)
git diff --name-only "$(git rev-list --max-parents=0 HEAD)" HEAD 2>/dev/null

# Aktuell offene / uncommittete Änderungen
git status --short

# Offene TODOs im Code (häufige Patterns, inkl. ungetrackter Dateien)
git grep --untracked -n "TODO\|FIXME\|HACK\|XXX\|NOCOMMIT" -- ':!*.lock' ':!node_modules' 2>/dev/null | head -40
```

Lies optional relevante Dateien, die durch die Git-Daten als zentral identifiziert werden
(z.B. kürzlich stark veränderte Dateien, CLAUDE.md falls vorhanden).

## Schritt 2: HANDOFF.md schreiben

Bevor du schreibst: Prüfe mit `Read`, ob `HANDOFF.md` im Repo-Root bereits existiert.
Falls ja, informiere den Nutzer und frage, ob die Datei überschrieben oder ein neuer Abschnitt angehängt werden soll.
Fahre erst nach dessen Bestätigung fort.

Erstelle oder aktualisiere `HANDOFF.md` im Repo-Root mit folgendem Aufbau:

```markdown
# Session Handoff — {DATUM} {UHRZEIT}

> Generiert von `/session-handoff` · Repo: {REPO-NAME}

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

<!-- Automatisch aus `git status --short` befüllt — zeigt, was noch nicht committed wurde -->

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

_Letzte Aktualisierung: {DATUM} {UHRZEIT}_
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
übergeben hat, berücksichtige diese beim Bestimmen der Session-Grenze, beim Priorisieren der nächsten
Schritte und beim Formulieren der Entscheidungen.

## Schritt 3: .gitignore prüfen

Prüfe mit `Read`, ob `.gitignore` im Repo-Root existiert und ob `HANDOFF.md` bereits eingetragen ist.
Falls der Eintrag fehlt, füge ihn mit `Edit` hinzu.

## Schritt 4: Bestätigung

Teile dem Nutzer mit:

- Pfad der erstellten Datei (`HANDOFF.md`)
- Kurze Zusammenfassung: wie viele Commits, wie viele offene Fragen, wie viele nächste Schritte
- Hinweis, dass HANDOFF.md gitignored ist (nicht eingecheckt wird)
