import { resolve } from "node:path";
import type { Defect } from "../types/defect.js";
import { readTextIfExists } from "../utils/file.js";

const FALLBACK_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LeakGuard Report</title>
    <style>
      :root {
        --bg: #f4f2ee;
        --card: #fffdf8;
        --text: #24201d;
        --muted: #72695f;
        --critical: #8f1326;
        --warning: #a36a10;
        --info: #0e5a73;
      }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
        background: radial-gradient(circle at 10% 10%, #fef7e8 0%, var(--bg) 40%, #ece7de 100%);
        color: var(--text);
      }
      .wrap {
        max-width: 1024px;
        margin: 0 auto;
        padding: 32px 16px 48px;
      }
      h1 {
        margin: 0;
        font-family: "Space Grotesk", "Avenir Next", sans-serif;
      }
      .meta {
        margin-top: 8px;
        color: var(--muted);
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 12px;
        margin-top: 24px;
      }
      .card {
        background: var(--card);
        border: 1px solid #ddd3c5;
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 6px 24px rgba(56, 47, 33, 0.08);
      }
      .critical { border-left: 4px solid var(--critical); }
      .warning { border-left: 4px solid var(--warning); }
      .info { border-left: 4px solid var(--info); }
      code {
        background: #f1ece3;
        border-radius: 6px;
        padding: 1px 5px;
      }
      ul { margin: 10px 0; padding-left: 18px; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>LeakGuard Report</h1>
      <p class="meta">Generated at {{generated_at}} • Findings: {{count}}</p>
      <section class="cards">{{cards}}</section>
    </main>
  </body>
</html>`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function card(defect: Defect): string {
  return `
<article class="card ${defect.severity}">
  <h3>${escapeHtml(defect.title)}</h3>
  <p><strong>${escapeHtml(defect.file)}:${defect.line}</strong> in <code>${escapeHtml(defect.function)}()</code></p>
  <ul>
    <li>Resource: <code>${escapeHtml(defect.resource.variable)}</code> (${escapeHtml(defect.resource.type)})</li>
    <li>Expected release: <code>${escapeHtml(defect.missingRelease.expectedRelease)}</code></li>
    <li>Path: ${escapeHtml(defect.missingRelease.pathDescription)}</li>
    <li>Confidence: ${escapeHtml(defect.confidence.toUpperCase())}</li>
    <li>ID: <code>${escapeHtml(defect.id)}</code></li>
  </ul>
</article>`;
}

export async function renderHtmlReport(defects: Defect[]): Promise<string> {
  const templatePath = resolve(process.cwd(), "templates", "report.html");
  const template = (await readTextIfExists(templatePath)) ?? FALLBACK_TEMPLATE;
  const cards = defects.map(card).join("\n");

  return template
    .replaceAll("{{generated_at}}", new Date().toISOString())
    .replaceAll("{{count}}", String(defects.length))
    .replaceAll("{{cards}}", cards);
}
