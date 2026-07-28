import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const distDirectory = path.join(root, "dist");
const buildMarker = "postpulse-bar-label-remount-v1";
const relevantSources = [
  "app/page.tsx",
  "app/metrics.ts",
  "app/globals.css",
  "package.json",
].map((file) => path.join(root, file));

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(filePath)));
    } else {
      files.push(filePath);
    }
  }

  return files;
}

function fail(message) {
  console.error(`Build artifact verification failed: ${message}`);
  process.exitCode = 1;
}

let distFiles;
try {
  distFiles = await walk(distDirectory);
} catch {
  fail("dist is missing. Run a fresh production build first.");
  process.exit();
}

const compiledFiles = distFiles.filter((file) => /\.(?:js|css)$/.test(file));
if (compiledFiles.length === 0) {
  fail("dist contains no compiled JavaScript or CSS.");
  process.exit();
}

const sourceStats = await Promise.all(relevantSources.map((file) => stat(file)));
const compiledStats = await Promise.all(compiledFiles.map((file) => stat(file)));
const newestSourceTime = Math.max(...sourceStats.map(({ mtimeMs }) => mtimeMs));
const newestCompiledTime = Math.max(...compiledStats.map(({ mtimeMs }) => mtimeMs));

if (newestCompiledTime < newestSourceTime) {
  fail("dist is older than the chart source or build configuration.");
}

const clientJavaScript = compiledFiles.filter(
  (file) => file.includes(`${path.sep}client${path.sep}`) && file.endsWith(".js"),
);
const serverJavaScript = compiledFiles.filter(
  (file) => file.includes(`${path.sep}server${path.sep}`) && file.endsWith(".js"),
);
const cssFiles = compiledFiles.filter((file) => file.endsWith(".css"));

async function anyFileContains(files, text) {
  for (const file of files) {
    if ((await readFile(file, "utf8")).includes(text)) return true;
  }
  return false;
}

const [clientHasMarker, serverHasMarker, cssHasLabelClass, cssHasVisibilityRule] =
  await Promise.all([
    anyFileContains(clientJavaScript, buildMarker),
    anyFileContains(serverJavaScript, buildMarker),
    anyFileContains(cssFiles, "chart-bar-value-label"),
    anyFileContains(cssFiles, "data-bar-labels-visible"),
  ]);

if (!clientHasMarker) {
  fail("the client bundle is missing the final bar-remount behavior.");
}
if (!serverHasMarker) {
  fail("the server bundle is missing the final bar-remount behavior.");
}
if (!cssHasLabelClass || !cssHasVisibilityRule) {
  fail("the compiled CSS is missing the settled bar-label visibility rules.");
}

if (process.exitCode) process.exit();

console.log(
  "Build artifact verified: fresh dist with bar-label remount and visibility behavior.",
);
