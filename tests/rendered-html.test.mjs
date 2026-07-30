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

test("ships compact row controls, independent ordering, and the Settings modal", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Priority metrics/);
  assert.match(page, /Performance ordering/);
  assert.match(page, /Date ordering/);
  assert.match(page, /postpulse-settings-dialog-v1/);
  assert.match(page, /dialog\.showModal\(\)/);
  assert.match(page, /Resizable row heights/);
  assert.doesNotMatch(page, />Ranking metrics</);
  assert.doesNotMatch(page, /Balanced performance/);
  assert.match(css, /\.settings-dialog::backdrop/);
  assert.match(css, /backdrop-filter:\s*blur\(4px\)/);
  assert.match(css, /\.row-resizer/);
  assert.match(css, /\.table-frame\.is-compact-rows \.post-page/);
});

test("ships exactly one analysis toolbar without obsolete duplicate controls", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const count = (pattern) => page.match(pattern)?.length ?? 0;

  assert.equal(count(/data-testid="search-posts"/g), 1);
  assert.equal(count(/data-testid="open-settings"/g), 1);
  assert.equal(count(/data-testid="reset-analysis"/g), 1);
  assert.equal(count(/data-testid="settings-dialog"/g), 1);
  assert.equal(count(/className="custom-date-popover"/g), 1);
  assert.equal(count(/aria-label="Chart grouping"/g), 1);
  assert.doesNotMatch(page, /search-posts-obsolete/);
  assert.doesNotMatch(page, /utility-control-bar/);
  assert.doesNotMatch(page, /custom-date-row/);
  assert.doesNotMatch(page, />\s*Filters\s*</);
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
