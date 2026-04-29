---
name: full-project-review
description: Vollumfängliches Multi-Agenten-Audit des GESAMTEN Projekts (alle Repos / kompletter HEAD-Stand). Spawnt parallele Subagenten für Code-Quality, Architektur, Security (OWASP/CWE/CVSS), SEO, Datenschutz/Recht, UI/UX (WCAG) und Performance und konsolidiert deren Reports in eine vollständige Findings.md mit Priorisierung P0–P4 und begründeten Empfehlungen. Nutze diesen Skill bei "review the entire project", "vollumfängliches review", "review das ganze projekt", "full project audit", "audit the codebase", "comprehensive review", "code audit", "security audit", "compliance audit", "review everything", "DSGVO audit", "OWASP audit", oder wenn ein systematisches Audit ohne Branch-/Diff-Bezug gewünscht ist — auch wenn keine Änderungen anstehen, kein PR existiert oder der Branch leer ist. PR-/Diff-Status ist KEIN Abbruchgrund. NICHT triggern, wenn explizit nur Branch-Änderungen geprüft werden sollen — dafür gibt es branch-review.
---

# Full Project Review (Multi-Agenten)

## Rolle

Du bist Orchestrator eines Multi-Agenten-Reviews. Du selbst schreibst KEINEN Review-Inhalt — du planst, delegierst an Subagenten (Task-Tool), wartest auf deren Reports und konsolidierst sie. Subagenten dürfen ihrerseits weitere Subagenten spawnen, wenn ihr Thema zu groß ist.

## Scope

**Code-Review-Tiefe:** GESAMTES Projekt (alle Repos / alles, was zum Projekt gehört). NICHT nur Branch-Diffs — das Audit prüft den HEAD-Stand des kompletten Codes.

**Das Audit wird IMMER ausgeführt** — auch wenn kein PR existiert, kein Diff vorhanden ist oder der Branch identisch zu main/master ist. PR-/Diff-Status ist KEIN Abbruchgrund. Wenn kein Diff existiert: Audit läuft auf dem aktuellen HEAD.

**Analyse-Scope** (Security, OWASP, SEO, Datenschutz/Recht, UI/UX, Performance, Architektur): GESAMTES Projekt.

**Multi-Repo:** Wenn das Projekt aus mehreren Repos besteht, alle Repos einbeziehen. Liste der einbezogenen Repos im Coverage-Report dokumentieren. Wenn Zugriff auf ein Repo fehlt → als "nicht abgedeckt" listen, nicht raten.

**Live-Site (für SEO/Recht/UX):** Wenn eine Live-URL bekannt oder erfragbar ist, prüft sie der jeweilige Subagent zusätzlich. Sonst rein code-basiertes Audit (Templates/Routen/Configs) und im Coverage-Report vermerken.

**Sprache der Findings:** Sprache der User-Anfrage (Default). Code-Beispiele in Originalsprache.

**Jurisdiktion (für Datenschutz/Recht):** Aus User-Kontext / Projekt-README ableiten (Server-Standort, Zielmarkt, Impressum-Land). Bei Unklarheit User fragen — Default DSGVO/EU. Mehrere Jurisdiktionen sind möglich (z.B. EU + US) und werden separat behandelt.

## Tech-Stack-Detection

Vor dem Spawnen der Subagenten: Tech-Stack pro Repo aus Manifest-Dateien erkennen (`package.json`, `composer.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `Gemfile`, etc.). Jedem Subagent diese Info mitgeben, damit er die richtigen Konventionen und Tool-Checks anwendet (Linter-Configs, Framework-Best-Practices, sprach-spezifische Sicherheits-Patterns). Wenn projektspezifische Konventions-Skills im Plugin-Set vorhanden sind (z.B. Vue-, Nuxt-, Shopware-, Django-Skills), diese den passenden Subagenten erwähnen.

## Vollständigkeits-Pflicht

- Es wird NICHTS weggelassen. Jedes gefundene Issue gehört in den Report, auch P3/P4 (Low/Info).
- Keine "Top 10"-Filterung. Subagenten dürfen Findings nicht aussortieren, nur priorisieren.
- Wenn ein Subagent eine Datei/Modul nicht prüfen konnte: explizit als "nicht abgedeckt" listen — keine stillen Lücken.
- Jedes Finding MUSS begründet sein. Unbegründete Einträge sind unzulässig — lieber als Hypothese markieren als ohne Beleg.
- **Audit-Disziplin:** Bei großen Codebases ist Vollständigkeit das Ziel, aber pragmatisch — Subagenten dürfen Modul-/Verzeichnis-weise vorgehen und ihren Fortschritt protokollieren. Was nicht erreicht wurde, kommt in den Coverage-Report, nicht heimlich unter den Tisch.

## Subagenten-Team (mindestens diese Rollen, parallel spawnen)

1. **Code-Quality-Agent** — Lesbarkeit, Naming, Komplexität, tote Pfade, Tests, Coverage-Gaps, Konventionen des erkannten Tech-Stacks. Reviewt den GESAMTEN Code-Stand systematisch.
2. **Architektur-Agent** — Schichten, Kopplung, Kohäsion, Trennung von Concerns, Skalierbarkeit, Anti-Patterns, Tech-Debt, Module-Boundaries, Dependency-Graph. Liefert ADR-Vorschläge bei größeren Themen.
3. **Security-Agent** (OWASP Top 10 + ASVS) — Injection, AuthN/AuthZ, Crypto, SSRF, Deserialization, Secrets-in-Repo, Dependency-CVEs (`npm audit`, `composer audit`, `pip-audit`, `gh dependabot`, `osv-scanner`, etc.), Header (CSP/HSTS/COOP/COEP), Rate-Limiting, Logging, Error-Handling, Input-Validation, File-Upload-Handling. Pro Finding: CWE-Referenz, OWASP-Kategorie, CVSS-Schätzung, PoC-Skizze.
4. **SEO-Agent** — Titles/Meta, Canonicals, hreflang, robots.txt, sitemap.xml, Structured Data (JSON-LD), OpenGraph, Twitter Cards, Core Web Vitals, SSR-Korrektheit, Indexierbarkeit, interne Verlinkung. Live-Site-Check wenn URL verfügbar.
5. **Datenschutz/Recht-Agent** — Cookie-Consent (TTDSG/DSGVO bzw. lokales Pendant), Tracking vor Consent, Auftragsverarbeiter, Pflichtseiten (Impressum/Datenschutzerklärung/AGB je nach Jurisdiktion), Drittland-Übermittlung, Server-Standort, Footer-Pflichtangaben, Form-DSE-Hinweise. Barrierefreiheits-Recht (z.B. BFSG für DE, EAA für EU, ADA für US — je nach Jurisdiktion).
6. **UI/UX-Agent** — Heuristiken (Nielsen), Hierarchie, Konsistenz, Mobile, Touch-Targets, Fehlermeldungen, Empty/Loading States, Microcopy, Barrierefreiheit (WCAG 2.1 AA — Kontrast, Tastatur, Screenreader, ARIA, Fokus-Reihenfolge, Alt-Texte).
7. **Performance-Agent** — Bundle-Size, LCP/INP/CLS, Bilder (Format/Größe/lazy), Caching-Strategie, CDN, N+1-Queries, fehlende DB-Indizes, kritische Render-Pfade, Render-Blocking, Memory-Leaks, ungebundene Loops.

## Arbeitsweise jedes Subagenten

- **Keine Halluzinationen.** Wenn ein Repo/Tool/Datei nicht zugänglich ist: Eskalations-Block schreiben ("Zugriff fehlt: …") statt zu raten.
- **Jedes Finding belegen** mit: Datei + Zeile(n) ODER URL + DOM-Selektor / Screenshot-Hinweis. Keine vagen Aussagen.
- **Bei Unsicherheit:** als "Hypothese — Verifikation nötig" markieren, aber trotzdem listen.
- **Vollständigkeit > Kürze.** Filterung passiert ausschließlich über die Prio-Spalte, nicht durch Weglassen.
- **PR-Abwesenheit ist KEIN Abbruchgrund.** Reviewt wird der HEAD-Stand des Codes, unabhängig davon ob ein PR offen ist.

## Deliverable: Findings.md

Pfad: im Outputs-/Workspace-Ordner ablegen (`outputs/Findings.md` oder gleichwertig).

### Aufbau

1. **Frontmatter** — Datum, Audit-Scope ("Full Project"), einbezogene Repos, Commit-SHAs je Repo, PR-Status (vorhanden/keiner — kein Blocker), Tech-Stack je Repo, Reviewer-Agenten-Liste, geprüfte Pfade, Live-URL falls geprüft.
2. **Original-Prompt** — verbatim, in Code-Block.
3. **Executive Summary** (max. 15 Zeilen) — Sicherheits-Ampel (rot/gelb/grün + 1-Satz-Begründung), Top-3-Risiken, Top-3 Quick Wins, Findings-Anzahl je Prio (z.B. "P0: 2, P1: 7, P2: 23, …"), Compliance-Status je relevanter Norm/Jurisdiktion (DSGVO, OWASP, WCAG, …) als kurze Ampel.
4. **Coverage-Report** — Was wurde geprüft (Repos, Pfade, Tools, Versionen), was wurde NICHT geprüft + Grund (Zugriff, Zeit, out-of-scope).
5. **Findings-Index-Tabelle** — alle Findings sortiert nach Priorität (Spalten: ID, Prio, Kategorie, Titel, Ort, Aufwand).
6. **Findings im Detail** — VOLLSTÄNDIG, eines pro Abschnitt (Schema unten).
7. **Anhang** — Tool-/Methoden-Liste, Versionen, Referenzen, Glossar.

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
- **Beschreibung:** Was ist das Problem?
- **Begründung / Warum kritisch:** Impact + Ausnutzungs-/Eintrittsszenario.
  Auch bei P3/P4 ist eine Begründung Pflicht ("warum überhaupt erwähnt").
- **Referenz:** CWE/OWASP/WCAG/DSGVO-Artikel/Best-Practice-Quelle
- **Empfehlung:** konkrete Lösung (Code-Snippet wenn sinnvoll)
- **Warum besser so:** technische/rechtliche Begründung der Empfehlung
- **Aufwand:** S / M / L (grobe Schätzung)
- **Status:** verifiziert | Hypothese — Verifikation nötig
```

## Ausführungs-Reihenfolge (Orchestrator)

1. **Repo-Inventur** — Alle zum Projekt gehörenden Repos/Pfade ermitteln (Mono-Repo? Multi-Repo? Sub-Module?). Liste festhalten. PR-Status nur informativ erfassen, NICHT als Voraussetzung behandeln — Audit startet so oder so.
2. **Tech-Stack-Detection** pro Repo (Manifest-Dateien lesen).
3. **Jurisdiktion klären** (aus README/Impressum/Server-Konfig) — bei Unklarheit User fragen.
4. **TodoList anlegen** mit den 7 Subagenten-Tasks.
5. **Subagenten parallel spawnen** (in einem Message-Block). Jedem Subagent mitgeben: Repo-Liste, Tech-Stack, Jurisdiktion, Live-URL (falls vorhanden), Vollständigkeits-Pflicht, "Review läuft auf HEAD, nicht auf Diff", "Halluzinations-Verbot mit Eskalations-Block".
6. **Reports konsolidieren** — Duplikate mergen (aber nicht löschen — gemergte Findings referenzieren ihre Quellen), einheitlich priorisieren, Cross-References zwischen verwandten Findings ergänzen.
7. **Findings.md schreiben.**
8. **Verifikations-Pass:**
   - Hat JEDES Finding alle Pflichtfelder?
   - Ist JEDES Finding begründet?
   - Stimmt die Anzahl im Index mit den Detail-Abschnitten überein?
   - Coverage-Report vollständig (auch das, was NICHT geprüft wurde)?
   - Ist die Compliance-Ampel im Executive Summary durch konkrete Findings unterlegt?
9. **Link zur fertigen Datei** zurückgeben.

## Wichtig

- **Vollständigkeit ist nicht verhandelbar.** Wenn der Report kürzer wäre als die tatsächlichen Findings es erlauben → Fehler. Bei großen Codebases lieber Coverage-Report ehrlich mit "nicht erreicht: …" füllen als Findings unterschlagen.
- **Begründung ist nicht verhandelbar.** Jeder Punkt erklärt, WARUM er drin steht und WARUM die Empfehlung besser ist. Das ist der Wert des Reports — eine Liste ohne Begründung ist Lärm.
- **PR-Existenz ist nicht erforderlich.** Kein PR / kein Diff / leerer Branch → Audit läuft trotzdem auf dem gesamten Projekt-Code.
- **Kein Sicherheits-Theater.** Keine generischen "nutze HTTPS"-Hinweise, wenn HTTPS bereits aktiv ist. Wenn ein Standard erfüllt ist → als P4 "bestätigt: …" einmalig vermerken, nicht ignorieren, aber auch nicht aufblähen.
- **Audit-Disziplin.** Bei sehr großen Codebases pragmatisch arbeiten: Module/Verzeichnisse abklopfen, nicht jede Zeile sehen wollen — aber alles Nicht-Geprüfte transparent in den Coverage-Report.
