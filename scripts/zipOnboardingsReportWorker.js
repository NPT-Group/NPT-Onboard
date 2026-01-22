/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const BUILD_DIR = path.resolve(".lambda-build");
const ZIP_NAME = "onboardingsReportWorker.zip";
const WORKER_JS = path.join(BUILD_DIR, "worker.js");
const ZIP_PATH = path.join(BUILD_DIR, ZIP_NAME);

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", ...opts });
}

function main() {
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  // remove old zip if exists
  try {
    fs.unlinkSync(ZIP_PATH);
  } catch {}

  // build worker into .lambda-build/worker.js
  run("npx esbuild src/workers/onboardingsReportWorker.ts --bundle --platform=node --target=node20 --minify --legal-comments=none --outfile=.lambda-build/worker.js");

  // zip from inside .lambda-build so relative paths work everywhere (Win/Git Bash/CI)
  run(`npx bestzip ${ZIP_NAME} worker.js`, { cwd: BUILD_DIR });

  // cleanup compiled js (leave only the zip)
  try {
    fs.unlinkSync(WORKER_JS);
  } catch {}

  console.log(`✅ Built ${path.join(".lambda-build", ZIP_NAME)}`);
}

main();
