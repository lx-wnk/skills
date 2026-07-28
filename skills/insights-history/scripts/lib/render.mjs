export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function sparkline(values, { width = 80, height = 20 } = {}) {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - (value / max) * height).toFixed(1)}`)
    .join(" ");
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
}

const STYLE = `
:root { color-scheme: light dark; --fg:#111; --bg:#fff; --muted:#666; --line:#e5e5e5; --accent:#2563eb; }
@media (prefers-color-scheme: dark) { :root { --fg:#e8e8e8; --bg:#111; --muted:#999; --line:#2a2a2a; --accent:#60a5fa; } }
body { margin:0; padding:2rem; background:var(--bg); color:var(--fg); font:14px/1.5 ui-sans-serif,system-ui,sans-serif; }
h1,h2 { font-weight:600; }
table { border-collapse:collapse; width:100%; margin:1rem 0; }
th,td { padding:.4rem .6rem; border-bottom:1px solid var(--line); text-align:right; }
th:first-child,td:first-child { text-align:left; }
th { color:var(--muted); font-weight:500; }
.wrap { overflow-x:auto; }
.spark { color:var(--accent); vertical-align:middle; }
.delta-up { color:#16a34a; } .delta-down { color:#dc2626; }
.note { color:var(--muted); font-size:13px; max-width:70ch; }
`;

function topEntries(record, limit = 3) {
  return Object.entries(record ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function absoluteTable(buckets) {
  const rows = buckets
    .map(
      (b) =>
        `<tr><td>${escapeHtml(b.key)}</td><td>${b.sessions}</td><td>${b.activeDays}</td>` +
        `<td>${b.userMessages}</td><td>${b.commits}</td><td>${Math.round(b.outputTokens / 1000)}k</td>` +
        `<td>${b.toolErrors}</td><td>${b.interruptions}</td></tr>`,
    )
    .join("");
  return `<div class="wrap"><table><thead><tr><th>Bucket</th><th>Sessions</th><th>Active days</th><th>User msgs</th><th>Commits</th><th>Output</th><th>Tool errors</th><th>Interruptions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function normalisedTable(buckets) {
  const rows = buckets
    .map(
      (b) =>
        `<tr><td>${escapeHtml(b.key)}</td><td>${b.perSession.userMessages}</td>` +
        `<td>${b.perSession.commits}</td><td>${b.perSession.toolErrors}</td>` +
        `<td>${Math.round(b.perCommit.outputTokens / 1000)}k</td><td>${b.perCommit.userMessages}</td></tr>`,
    )
    .join("");
  const spark = sparkline(buckets.map((b) => b.perSession.commits));
  return `<div class="wrap"><table><thead><tr><th>Bucket</th><th>Msgs/session</th><th>Commits/session ${spark}</th><th>Errors/session</th><th>Output/commit</th><th>Msgs/commit</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function qualityTable(buckets) {
  const rows = buckets
    .map((b) => {
      const outcomes = topEntries(b.outcomes)
        .map(([k, v]) => `${escapeHtml(k)} ${v}`)
        .join(", ");
      const friction = topEntries(b.friction)
        .map(([k, v]) => `${escapeHtml(k)} ${v}`)
        .join(", ");
      const projects = topEntries(b.projects)
        .map(([k, v]) => `${escapeHtml(k)} ${v}`)
        .join(", ");
      const total = Object.values(b.friction ?? {}).reduce((sum, n) => sum + n, 0);
      const unknown = Object.values(b.frictionUnknown ?? {}).reduce((sum, n) => sum + n, 0);
      const share = unknown === 0 ? "—" : `${unknown} of ${total} (${Math.round((unknown / total) * 100)}%)`;
      return `<tr><td>${escapeHtml(b.key)}</td><td>${outcomes || "—"}</td><td>${friction || "—"}</td><td>${escapeHtml(share)}</td><td>${projects || "—"}</td></tr>`;
    })
    .join("");
  return `<div class="wrap"><table><thead><tr><th>Bucket</th><th>Outcomes</th><th>Friction</th><th>Ad-hoc vocabulary</th><th>Projects</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function comparisonTable(comparison) {
  if (!comparison) return "";
  const rows = Object.entries(comparison.change)
    .map(([metric, change]) => {
      const cls = change.absolute >= 0 ? "delta-up" : "delta-down";
      const percent = change.percent === null ? "—" : `${change.percent > 0 ? "+" : ""}${change.percent}%`;
      return (
        `<tr><td>${escapeHtml(metric)}</td><td>${comparison.before[metric]}</td>` +
        `<td>${comparison.after[metric]}</td>` +
        `<td class="${cls}">${change.absolute > 0 ? "+" : ""}${change.absolute}</td>` +
        `<td class="${cls}">${percent}</td></tr>`
      );
    })
    .join("");
  return `<h2>Comparison</h2><div class="wrap"><table><thead><tr><th>Metric</th><th>Before</th><th>After</th><th>Change</th><th>%</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function renderReport({ buckets, totals, range, granularity, narrative, comparison }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Claude Code usage history ${escapeHtml(range.start)} to ${escapeHtml(range.end)}</title>
<style>${STYLE}</style></head><body>
<h1>Usage history</h1>
<p>${escapeHtml(range.start)} to ${escapeHtml(range.end)} &middot; ${escapeHtml(granularity)} buckets &middot; ${totals.sessions} sessions &middot; ${totals.commits} commits</p>
<h2>Absolute</h2>${absoluteTable(buckets)}
<h2>Normalised</h2>${normalisedTable(buckets)}
<h2>Quality</h2>${qualityTable(buckets)}
<p class="note">Friction categories come from an automated per-session assessment that is not schema-checked, so some categories are invented ad hoc. The <em>ad-hoc vocabulary</em> column shows how many of a bucket's friction events use categories outside the defined set — treat those counts as weaker evidence.</p>
${comparisonTable(comparison)}
<h2>Summary</h2><p>${escapeHtml(narrative?.summary ?? "")}</p>
<h2>Change</h2><p>${escapeHtml(narrative?.delta ?? "")}</p>
</body></html>
`;
}
