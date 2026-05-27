---
name: branch-review
description: Vollständiges Multi-Agenten-Code-Review AUSSCHLIESSLICH der Änderungen zwischen aktuellem Branch und einem Basis-Branch (Default main, Fallback master/develop) — kein Audit des gesamten Repos, sondern tiefes Review nur der diff-berührten Stellen. Spawnt parallele Subagenten für Code-Quality, Architektur, Security (OWASP/CWE/CVSS), SEO, Datenschutz/Recht, UI/UX (WCAG) und Performance und konsolidiert deren Reports in eine vollständige Findings.md mit Priorisierung P0–P4 und begründeten Empfehlungen. Nutze diesen Skill bei "review this branch", "review meinen branch", "PR review", "diff review", "branch review", "review die änderungen", "review my PR", "code review für branch", "review what changed", oder wenn ein PR-Link, eine Branch-Range oder ein Diff zur Prüfung gepostet wird — auch ohne explizites Wort "review", wenn der Kontext klar ist (z.B. "schau dir den branch an"). NICHT triggern für ein Audit des gesamten Projekts ohne Branch-Bezug — dafür gibt es full-project-review.
---

# Branch Review (Multi-Agenten)

## DIFF-DISZIPLIN (oberste Regel)

**Der Diff ist der einzige Anker.** Dieses Review prüft NICHT das ganze Projekt — es prüft die Änderungen zwischen `<base>` und `HEAD`. Wenn dieser Skill triggert, ohne dass ein Diff existiert: abbrechen und auf `full-project-review` verweisen.

Erlaubte Lesezugriffe:

1. Alle vom Diff berührten Dateien — vollständig (Kontext rund um Änderung).
2. Direkt referenzierte Imports/Aufrufer/Callsites der geänderten Symbole — gezielt, nicht flächig.
3. Konfig-/Manifest-Dateien zur Tech-Stack-Erkennung.
4. Systemweite Stellen NUR wenn eine Diff-Änderung sie nachweislich betrifft (z.B. neue Auth-Middleware → andere Routen prüfen). Im Finding markieren: `Diff-Auslöser: <Datei:Zeile>`.

Verboten:

- Repo-weite Scans ohne Diff-Bezug ("ich prüfe mal alle Controller").
- Findings zu unverändertem Legacy-Code, der nicht vom Diff angefasst wird.
- Bestehende Tech-Debt-Listen ohne Verbindung zum aktuellen Diff.

## Rolle

Du bist Orchestrator eines Multi-Agenten-Reviews. Du selbst schreibst KEINEN Review-Inhalt — du planst, delegierst an Subagenten (Task-Tool), wartest auf deren Reports und konsolidierst sie. Subagenten dürfen ihrerseits weitere Subagenten spawnen, wenn ihr Thema zu groß ist — alle Sub-Subagenten erben die Diff-Disziplin oben.

## Scope

**Code-Review-Tiefe:** Nur die Änderungen zwischen aktuellem Branch und Basis-Branch (`git diff <base>...<HEAD>`).

**Basis-Branch ermitteln** (in dieser Reihenfolge):

1. Wenn der User einen Basis-Branch nennt → den nehmen.
2. Wenn ein PR existiert → dessen Target-Branch.
3. Default: `main`, Fallback `master`, Fallback `develop`.
4. Wenn unklar: User fragen, nicht raten.

**Wenn der Diff leer ist:** STOP. Dem User zurückmelden, dass der Branch identisch zum Base ist, und vorschlagen, stattdessen `full-project-review` zu nutzen. Nicht heimlich Scope ausweiten.

**Kontext-Scope für Security/Recht/Performance:** Primär der Diff. Wenn eine Änderung systemweite Implikationen hat (z.B. neue Auth-Middleware, geänderte CSP), DARF und SOLL der entsprechende Subagent die betroffenen Stellen außerhalb des Diffs mitprüfen — und das im Finding kennzeichnen ("Diff-Auslöser: …, betrifft auch …").

**Live-Site (für SEO/Recht/UX):** Nur wenn der Diff user-facing Inhalte berührt UND eine Live-URL bekannt/erfragbar ist. Sonst überspringen und im Coverage-Report vermerken.

**Sprache der Findings:** Sprache der User-Anfrage (Default). Code-Beispiele in Originalsprache.

**Jurisdiktion (für Datenschutz/Recht):** Aus User-Kontext / Projekt-README ableiten (Server-Standort, Zielmarkt). Bei Unklarheit User fragen — Default DSGVO/EU.

## Tech-Stack-Detection

Vor dem Spawnen der Subagenten: Tech-Stack aus dem Repo erkennen (`package.json`, `composer.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `Gemfile`, etc.). Jedem Subagent diese Info mitgeben, damit er die richtigen Konventionen und Tool-Checks anwendet (Linter-Configs, Framework-Best-Practices, sprach-spezifische Sicherheits-Patterns). Wenn projektspezifische Konventions-Skills im Plugin-Set vorhanden sind (z.B. Vue-, Nuxt-, Shopware-Skills), diese den passenden Subagenten erwähnen.

## Vollständigkeits-Pflicht

- Es wird NICHTS weggelassen. Jedes gefundene Issue gehört in den Report, auch P3/P4 (Low/Info).
- Keine "Top 10"-Filterung. Subagenten dürfen Findings nicht aussortieren, nur priorisieren.
- Wenn ein Subagent eine Datei/Modul nicht prüfen konnte: explizit als "nicht abgedeckt" listen — keine stillen Lücken.
- Jedes Finding MUSS begründet sein. Unbegründete Einträge sind unzulässig — lieber als Hypothese markieren als ohne Beleg.

## Subagenten-Team (mindestens diese Rollen, parallel spawnen)

1. **Code-Quality-Agent** — Lesbarkeit, Naming, Komplexität, tote Pfade, Tests, Coverage-Gaps, Konventionen des erkannten Tech-Stacks. Reviewt jede vom Diff berührte Datei.
2. **Architektur-Agent** — Schichten, Kopplung, Kohäsion, Trennung von Concerns, Skalierbarkeit, Anti-Patterns, Tech-Debt, der durch den Diff entsteht oder vergrößert wird. Liefert ADR-Vorschläge bei größeren Themen.
3. **Security-Agent** (OWASP Top 10 + ASVS) — Injection, AuthN/AuthZ, Crypto, SSRF, Deserialization, Secrets, Dependency-CVEs (`npm audit`, `composer audit`, `pip-audit`, `gh dependabot`, etc.), Header (CSP/HSTS/COOP/COEP), Rate-Limiting, Logging. Pro Finding: CWE-Referenz, OWASP-Kategorie, CVSS-Schätzung, PoC-Skizze.
4. **SEO-Agent** — Titles/Meta, Canonicals, hreflang, robots.txt, sitemap.xml, Structured Data (JSON-LD), OpenGraph, Core Web Vitals, SSR-Korrektheit. Nur aktiv, wenn der Diff user-facing Routen/Templates/Meta-Tags berührt.
5. **Datenschutz/Recht-Agent** — Cookie-Consent, Tracking vor Consent, Auftragsverarbeiter, Pflichtseiten (Impressum/Datenschutzerklärung/AGB je nach Jurisdiktion), Drittland-Übermittlung, Server-Standort. Barrierefreiheits-Recht (BFSG für DE, EAA für EU, ADA für US, etc.) je nach erkannter Jurisdiktion. Nur aktiv, wenn der Diff datenverarbeitende Pfade, Tracking, Forms oder Pflichtseiten berührt.
6. **UI/UX-Agent** — Heuristiken (Nielsen), Hierarchie, Konsistenz, Mobile, Touch-Targets, Fehlermeldungen, Empty/Loading States, Microcopy, Barrierefreiheit (WCAG 2.1 AA — Kontrast, Tastatur, Screenreader, ARIA). Nur aktiv, wenn der Diff UI berührt.
7. **Performance-Agent** — Bundle-Size, LCP/INP/CLS, Bilder (Format/Größe/lazy), Caching, CDN, N+1-Queries, DB-Indizes, kritische Render-Pfade. Fokus auf Diff-induzierte Regressionen.

Wenn ein Subagent für seinen Scope keine Relevanz im Diff sieht, liefert er trotzdem einen Report (kann kurz sein) mit der Begründung, warum er nichts findet — keine Stillschweigen.

## Arbeitsweise jedes Subagenten

- **Keine Halluzinationen.** Wenn ein Repo/Tool/Datei nicht zugänglich ist: Eskalations-Block schreiben ("Zugriff fehlt: …") statt zu raten.
- **Jedes Finding belegen** mit: Datei + Zeile(n) ODER URL + DOM-Selektor / Screenshot-Hinweis. Keine vagen Aussagen.
- **Bei Unsicherheit:** als "Hypothese — Verifikation nötig" markieren, aber trotzdem listen.
- **Vollständigkeit > Kürze.** Filterung passiert ausschließlich über die Prio-Spalte, nicht durch Weglassen.

## Deliverable: Findings.md

Pfad: im Outputs-/Workspace-Ordner ablegen (`outputs/Findings.md` oder gleichwertig).

### Aufbau

1. **Frontmatter** — Datum, Branch, Base-Branch, Commit-SHAs (HEAD und Merge-Base), PR-Status (vorhanden/keiner), Tech-Stack (erkannt), Reviewer-Agenten-Liste, geprüfte Pfade.
2. **Original-Prompt** — verbatim, in Code-Block.
3. **Executive Summary** (max. 15 Zeilen) — Sicherheits-Ampel (rot/gelb/grün + 1-Satz-Begründung), Top-3-Risiken, Top-3 Quick Wins, Findings-Anzahl je Prio (z.B. "P0: 2, P1: 7, P2: 23, …").
4. **Coverage-Report** — Was wurde geprüft (Pfade, Tools), was wurde NICHT geprüft + Grund (Zugriff, Zeit, out-of-scope, Diff irrelevant).
5. **Findings-Index-Tabelle** — alle Findings sortiert nach Priorität (Spalten: ID, Prio, Kategorie, Titel, Ort, Aufwand).
6. **Findings im Detail** — VOLLSTÄNDIG, eines pro Abschnitt (Schema unten).
7. **Anhang** — Tool-/Methoden-Liste, Versionen, Referenzen.

### Priorisierung

- **P0 — Critical:** aktiv ausnutzbar, Datenleck, Recht-Verstoß mit Bußgeldrisiko.
- **P1 — High:** ausnutzbar mit Vorbedingungen, klares Compliance-Risiko.
- **P2 — Medium:** schlechte Praxis, kein direkter Exploit, UX-Schmerzpunkt.
- **P3 — Low:** Nice-to-have, kosmetisch, Tech-Debt.
- **P4 — Info:** Beobachtung oder bestätigter Standard, kein Handlungsbedarf — trotzdem listen.

### Schema pro Finding (alle Felder Pflicht)

```
### [P{0-4}] [Kategorie] Kurztitel
- **Ort:** Pfad:Zeile / URL
- **Diff-Bezug:** welche Datei/Zeile aus dem Diff hat es ausgelöst
- **Beschreibung:** Was ist das Problem?
- **Begründung / Warum kritisch:** Impact + Ausnutzungs-/Eintrittsszenario.
  Auch bei P3/P4 ist eine Begründung Pflicht ("warum überhaupt erwähnt").
- **Referenz:** CWE/OWASP/WCAG/DSGVO-Artikel/Best-Practice-Quelle
- **Empfehlung:** konkrete Lösung (Code-Snippet wenn sinnvoll)
- **Warum besser so:** technische/rechtliche Begründung der Empfehlung
- **Aufwand:** S / M / L (grobe Schätzung)
- **Status:** verifiziert | Hypothese — Verifikation nötig
```

## Subagent-Prompt-Template (verbindlich)

Jeder gespawnte Subagent erhält EXAKT diese Struktur. Der Orchestrator füllt die Platzhalter — nichts auslassen, nichts paraphrasieren.

```
ROLLE: <Code-Quality | Architektur | Security | SEO | Recht | UI/UX | Performance>-Agent

DIFF-DISZIPLIN (NICHT VERHANDELBAR):
- Anker ist der unten eingebettete Diff. Findings NUR zu Code, der vom Diff berührt wird ODER nachweislich von ihm betroffen ist.
- Verboten: repo-weite Scans, Findings zu unverändertem Code, generische Best-Practice-Listen ohne Diff-Bezug.
- Erlaubt für deine Rolle systemweit: <pro Rolle ausfüllen — siehe Liste unten>. Jede systemweite Erweiterung im Finding kennzeichnen: "Diff-Auslöser: <Datei:Zeile>".

ALLOWED-FILES (Whitelist — diese darfst du voll lesen):
<git diff --name-only Output, eine Datei pro Zeile>

TECH-STACK: <Detection-Ergebnis>
BASE-BRANCH: <base>     HEAD-SHA: <sha>     MERGE-BASE: <sha>

DIFF (unified):
<vollständiger `git diff <base>...<HEAD>` Output ODER Hinweis "siehe Datei <pfad>" wenn zu groß>

PFLICHTEN:
- Vollständigkeit innerhalb des Diffs (kein Auslassen, auch P3/P4).
- Jedes Finding mit Pflichtfeldern nach Schema (siehe Haupt-Skill).
- Halluzinations-Verbot: nicht zugängliche Stellen → Eskalations-Block, nicht raten.
- Wenn dein Scope vom Diff nicht berührt wird: Kurz-Report mit Begründung, kein Schweigen.

OUTPUT: Markdown-Report mit Findings nach Schema + Coverage-Notiz (was geprüft, was nicht + Grund).
```

**Systemweite Erweiterungen je Rolle** (was außerhalb des Diffs gelesen werden darf, wenn Diff-Auslöser nachweisbar):

- Security: globale Auth-/Crypto-/Header-Config, Dependency-Manifest.
- Architektur: direkte Aufrufer/Aufgerufene der geänderten Symbole.
- Performance: Query-Pfade, die von geänderten Modellen/Repos genutzt werden.
- Recht/SEO/UX: Pflichtseiten/Routes nur wenn Diff sie berührt oder neue user-facing Flows einführt.
- Code-Quality: nur Allowed-Files.

## Ausführungs-Reihenfolge (Orchestrator)

1. **Diff ermitteln** — Basis-Branch bestimmen (siehe Scope), `git diff <base>...<HEAD>` und `git diff --name-only <base>...<HEAD>` ausführen, Diff-Statistik festhalten. Bei leerem Diff abbrechen und auf `full-project-review` verweisen.
2. **Tech-Stack-Detection** — Manifest-Dateien lesen, Stack-Info festhalten.
3. **TodoList anlegen** mit den 7 Subagenten-Tasks.
4. **Subagenten parallel spawnen** (in einem Message-Block). Jeden Subagent nach dem **Subagent-Prompt-Template** oben briefen — Diff, Allowed-Files-Whitelist, Tech-Stack und systemweite Erweiterungs-Regeln einsetzen.
5. **Reports konsolidieren** — Duplikate mergen (aber nicht löschen — gemergte Findings referenzieren ihre Quellen), einheitlich priorisieren.
6. **Findings.md schreiben.**
7. **Verifikations-Pass:**
   - Hat JEDES Finding alle Pflichtfelder?
   - Ist JEDES Finding begründet?
   - **Hat JEDES Finding einen Diff-Bezug?** Findings ohne Diff-Auslöser → entfernen oder als Diff-Auslöser nachweisen.
   - Stimmt die Anzahl im Index mit den Detail-Abschnitten überein?
   - Coverage-Report vollständig (auch das, was NICHT geprüft wurde)?
8. **Link zur fertigen Datei** zurückgeben.

## Wichtig

- **Vollständigkeit ist nicht verhandelbar.** Wenn der Report kürzer wäre als die tatsächlichen Findings es erlauben → Fehler.
- **Begründung ist nicht verhandelbar.** Jeder Punkt erklärt, WARUM er drin steht und WARUM die Empfehlung besser ist. Das ist der Wert des Reports — eine Liste ohne Begründung ist Lärm.
- **Kein Sicherheits-Theater.** Keine generischen "nutze HTTPS"-Hinweise, wenn HTTPS bereits aktiv ist. Wenn ein Standard erfüllt ist → als P4 "bestätigt: …" einmalig vermerken, nicht ignorieren, aber auch nicht aufblähen.
- **Diff-Disziplin.** Branch-Review heißt: der Diff ist der Anker. Systemweite Implikationen sind erlaubt, müssen aber als solche gekennzeichnet werden ("Diff-Auslöser: …").
