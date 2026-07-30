import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the upload-first dashboard without bundled post data", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /PostPulse/);
  assert.match(html, /Facebook post performance/);
  assert.match(html, /Upload Facebook CSV/);
  assert.match(html, /Files stay on this device/);
  assert.match(html, /Refreshing clears the dataset/);
  assert.doesNotMatch(html, /Bar chart/);
  assert.doesNotMatch(html, /Line chart/);
  assert.doesNotMatch(html, /Copy full post title/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("bar highlighting hides only inactive quantity labels", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const hiddenLabelRule =
    ".bar-chart-wrap[data-highlighted-metric] .chart-bar-value-label";
  const selectedMetricRule =
    '.chart-wrap[data-highlighted-metric="views"] .chart-metric-views';

  assert.match(
    css,
    /\.bar-chart-wrap\[data-highlighted-metric\] \.chart-bar-value-label\s*\{\s*opacity:\s*0;/,
  );
  assert.ok(
    css.indexOf(selectedMetricRule) > css.indexOf(hiddenLabelRule),
    "the selected metric rule must restore its labels after inactive labels are hidden",
  );
  assert.match(css, /opacity 120ms ease/);
});

test("ships compact row controls, the filter cue, and simplified priority copy", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Priority metrics/);
  assert.match(page, /How priority works/);
  assert.match(page, /Resizable row heights/);
  assert.doesNotMatch(page, />Ranking metrics</);
  assert.doesNotMatch(page, /Balanced performance/);
  assert.match(css, /@keyframes advanced-panel-attention/);
  assert.match(css, /\.row-resizer/);
  assert.match(css, /\.table-frame\.is-compact-rows \.post-page/);
});

test("keeps row resize handles inside a vertically locked non-scrollable table", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /\.table-frame\s*\{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/s,
  );
  assert.match(
    css,
    /\.table-frame-scrollable\s*\{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*auto;[^}]*max-height:\s*760px;/s,
  );
  assert.match(css, /\.row-resizer\s*\{[^}]*bottom:\s*0;/s);
});

test("uses compact aligned spacing between metric quantities and bars", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /\.metric-cell\s*\{[^}]*grid-template-columns:\s*42px minmax\(42px,\s*1fr\);[^}]*gap:\s*4px;/s,
  );
  assert.match(css, /\.metric-value\s*\{[^}]*text-align:\s*right;/s);
});
