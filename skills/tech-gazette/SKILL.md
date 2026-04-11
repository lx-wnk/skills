---
name: tech-gazette
description: >-
  Generate a Tech Gazette as a self-contained HTML file covering 18+ topic areas relevant to Software Architects
  and Lead Developers working in Shopware/E-Commerce agencies. Supports daily and weekly editions.
  Use this skill whenever the user asks to create a tech gazette, generate a tech briefing, write a tech newspaper,
  or says things like "tech gazette", "Gazette erstellen", "daily tech news", "weekly tech news", "Tech-Briefing",
  "tägliche Gazette", "wöchentliche Gazette".
user-invocable: true
argument-hint: >-
  "--daily|--weekly --topics 'Topic1: search terms; Topic2: search terms' --customers 'customer1.de: Stack. Wettbewerber: x.de | customer2.de: ...'"
allowed-tools: "Read Write WebSearch WebFetch Agent"
---

# Tech Gazette Generator

Generate a tech news briefing as a self-contained, newspaper-styled HTML file.

## Input: Arguments

Parse `$ARGUMENTS` for:

1. **Frequency flag** (optional, default `--weekly`): `--daily` or `--weekly`
2. **Topics** (optional, via `--topics`): custom topics with search terms, separated by `;`
3. **Customers** (optional, via `--customers`): customer definitions separated by `|`

```
--weekly --topics "Rust: Rust language release news; WebAssembly: WASM runtime browser news" --customers "shop.de: Shopware 6.6. Wettbewerber: x.de | other.de: ..."
```

If no frequency flag is provided, default to `--weekly`.
If no customers are provided, skip the Customer Radar section entirely.

### Topic modes

- **No `--topics` flag**: Use the default 18 topics (see below)
- **`--topics "..."`**: **Replace** the default 18 topics with the provided custom topics. Each custom topic becomes its own section with a `.section-header`. Generate 1-2 WebSearch queries per custom topic using the provided search terms.
- **`--topics "+..."`** (with leading `+`): **Append** custom topics to the default 18. Example: `--topics "+Rust: Rust lang news; WASM: WebAssembly news"`

## Edition Differences

| Aspect                 | `--daily`                                         | `--weekly`                                         |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------- |
| **Filename**           | `tech-gazette-daily-{YYYY-MM-DD}.html`            | `tech-gazette-weekly-{YYYY-MM-DD}.html`            |
| **Search scope**       | Last 24-48 hours                                  | Last 7 days                                        |
| **Search queries**     | Append `today` or `yesterday` to queries          | Use `{MONTH} {YEAR}`                               |
| **Articles per topic** | 1-2 (only significant news)                       | 2-4 (comprehensive)                                |
| **Topics**             | Only topics with actual news (skip empty ones)    | All 18 topics required                             |
| **Hero article**       | Yes                                               | Yes                                                |
| **Monats-Kontext**     | Skip                                              | Yes                                                |
| **Layout variety**     | Simpler (prefer B, C, F)                          | Full rotation (A-G)                                |
| **Masthead tagline**   | "Daily Tech Intelligence for Software Architects" | "Weekly Tech Intelligence for Software Architects" |
| **Edition label**      | "Tagesausgabe · {date}"                           | "Ausgabe XX/2026"                                  |

## Examples

```bash
# Weekly edition with default topics, no customers
/tech-gazette

# Daily edition with customers
/tech-gazette --daily --customers "babyone.de: Shopware 6.6, PHP 8.2, ScaleCommerce, Adyen. Wettbewerber: babywalz.de, windeln.de | more-and-more.de: Shopware 6.6, PHP 8.3, Headless React. Wettbewerber: gerry-weber.de"

# Custom topics only (replaces default 18)
/tech-gazette --topics "Rust: Rust language release news; Go: Golang news updates; Zig: Zig language compiler news"

# Default topics + additional custom topics
/tech-gazette --weekly --topics "+Rust: Rust lang news; WebAssembly: WASM runtime browser news"

# Everything combined
/tech-gazette --daily --topics "+Kubernetes: K8s release news" --customers "shop.de: Shopware 6.6, PHP 8.3. Wettbewerber: competitor.de"
```

## Step 1: Research (parallel WebSearch)

### Default topic searches

When using the default 18 topics, launch these WebSearches in parallel using current month/year (`{MONTH} {YEAR}`):

1. `Shopware 6 update release news {MONTH} {YEAR}`
2. `Shopware security advisory CVE {MONTH} {YEAR}`
3. `Shopify news updates {MONTH} {YEAR} developer changelog`
4. `PHP release news {MONTH} {YEAR}`
5. `PHP security fix CVE Composer {MONTH} {YEAR}`
6. `Symfony release news {MONTH} {YEAR}`
7. `React Vue Next.js JavaScript TypeScript news {MONTH} {YEAR}`
8. `Vite Tailwind CSS frontend tooling news {MONTH} {YEAR}`
9. `AI developer tools Claude Anthropic Copilot news {MONTH} {YEAR}`
10. `Docker GitHub Actions CI CD DevOps news {MONTH} {YEAR}`
11. `MySQL MariaDB Redis Elasticsearch release news {MONTH} {YEAR}`
12. `Ubuntu Linux kernel release news {MONTH} {YEAR}`
13. `cloud hosting Hetzner AWS Cloudflare news {MONTH} {YEAR}`
14. `Core Web Vitals web performance news {MONTH} {YEAR}`
15. `e-commerce trends headless commerce {MONTH} {YEAR}`
16. `Stripe Mollie Adyen PayPal payment API news {MONTH} {YEAR}`
17. `GDPR DSGVO privacy ePrivacy ruling news {MONTH} {YEAR}`
18. `OWASP web security CVE supply chain attack news {MONTH} {YEAR}`
19. `PHPUnit Playwright Cypress Vitest testing news {MONTH} {YEAR}`

### Custom topic searches

For each custom topic, generate 1-2 WebSearch queries from the provided search terms:

- `{search terms} news {MONTH} {YEAR}`
- `{search terms} release update {MONTH} {YEAR}`

Create a matching `tag-{topicname}` CSS class using a color that fits the topic. Add it to the `<style>` block alongside the template CSS.

### Customer searches

**Per customer** (if provided), add 3-5 searches:

- `{domain} platform security update {MONTH} {YEAR}`
- `{domain} market segment trends {YEAR}`
- `{competitor} e-commerce news {MONTH} {YEAR}`

Also `WebFetch` each customer's shop URL for live findings.

## Step 2: Build the HTML file

**Language:** German
**Filename:** `tech-gazette-daily-{YYYY-MM-DD}.html` or `tech-gazette-weekly-{YYYY-MM-DD}.html` (based on frequency)

### Load templates

Read the CSS and HTML templates from this skill's directory:

- `skills/tech-gazette/template.css` — copy VERBATIM into `<style>` block
- `skills/tech-gazette/template.html` — use as structural reference for HTML classes and layout patterns

**CRITICAL:** Use the EXACT CSS and HTML classes from the templates. Do NOT invent custom CSS, classes, or layout systems.

### Required sections (in this order)

1. **Masthead** — title, date, calendar week
2. **Edition Bar** — metadata
3. **Ticker Bar** — only CRITICAL items
4. **Customer Radar** — if customers provided (directly after ticker)
5. **Hero Article** — most important story, 2-column `.lead`
6. **Priority 1** — three-col grid (Shopware | Shopify | PHP/Symfony)
7. **Monats-Kontext Box** — monthly context
8. **Topic sections** — varying layouts (see below)
9. **Footer**

### Topics (each with own `.section-header`)

**Default 18 topics** (used when no `--topics` flag is provided):

Shopware, Shopify, PHP & Composer, Symfony, JavaScript & TypeScript, Build-Tooling & CSS, AI für Developer, DevOps & CI/CD, Databases, Linux/Ubuntu, Cloud & Hosting, Web Performance, Agency/New Work, E-Commerce Trends, Payment, GDPR/Privacy, OWASP & Security, Testing & QA

**Custom topics** replace or extend this list (see Input section). Each custom topic gets its own section-header, tag, and search queries.

### Layout rotation

Layouts MUST alternate — never use the same layout more than 2x consecutively.

- **A (2|8|2):** sidebar + content + sidebar-alt
- **B (2|10):** sidebar + content
- **C (10|2):** content + sidebar-alt
- **D (2|4|4|2):** sidebar + two topics + sidebar-alt
- **E (2|5|5):** sidebar + two topics
- **F (12):** full-width highlight-box
- **G (2|4|4|2 compact):** like D but one topic uses `compact-list`

Recommended sequence: A → C → B → D → E → A → F → D → G → B

### KW-Tags: real publication dates

Do NOT stamp everything with the current calendar week. Each article gets the KW when it was actually published. Use 2-3+ different KW values. Classes: `current` (this week), `recent` (last week), `older` (older), `context` (monthly context).

### Sidebar notes

2-4 per sidebar: `<div class="sidebar-note"><strong>Label</strong>Text</div>`

### Article badges

Severity: `badge-kritisch` (red), `badge-wichtig` (orange), `badge-update` (blue), `badge-info` (gray)
Tags: `tag-shopware`, `tag-shopify`, `tag-php`, `tag-symfony`, `tag-js`, `tag-css`, `tag-ai`, `tag-devops`, `tag-db`, `tag-linux`, `tag-cloud`, `tag-perf`, `tag-agency`, `tag-ecommerce`, `tag-payment`, `tag-privacy`, `tag-security`, `tag-testing`

### Customer Radar (if customers provided)

Status badges: `status-ok` (green), `status-action` (yellow), `status-urgent` (red)
Sentiment badges: `sentiment-positiv`, `sentiment-negativ`, `sentiment-neutral`, `sentiment-gemischt`, `sentiment-ausbaufaehig`

Each customer card includes: header with status, market overview stats, competitor table, top 3 shop findings, affected gazette articles, industry priorities.

## Step 3: Write and verify

1. Write the HTML file to the current directory
2. Verify the file is valid HTML and self-contained
3. Report: filename, number of articles, topics covered (default + custom), customer radars included
