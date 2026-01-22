// scripts/zipApplicationFormPdfWorker.js
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ZIP_NAME = "applicationFormPdfWorker.zip";
const BUILD_DIR = path.resolve(".lambda-build");
const WORKER_JS = path.join(BUILD_DIR, "worker.js");

// template
const TEMPLATE_SRC = path.resolve("src/lib/pdf/application-form/templates/npt-india-application-form-fillable.pdf");
const TEMPLATE_DIR = path.join(BUILD_DIR, "templates");
const TEMPLATE_DST = path.join(TEMPLATE_DIR, "npt-india-application-form-fillable.pdf");

// font
const FONT_SRC = path.resolve("public/assets/fonts/inter-regular.ttf");
const FONTS_DIR = path.join(BUILD_DIR, "fonts");
const FONT_DST = path.join(FONTS_DIR, "inter-regular.ttf");

// icon
const ICON_SRC = path.resolve("public/assets/icons/check-mark.png");
const ICONS_DIR = path.join(BUILD_DIR, "icons");
const ICON_DST = path.join(ICONS_DIR, "check-mark.png");

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", ...opts });
}

function main() {
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  // remove old zip if exists
  const zipPath = path.join(BUILD_DIR, ZIP_NAME);
  try {
    fs.unlinkSync(zipPath);
  } catch {}

  // build worker into .lambda-build/worker.js
  run("npx esbuild src/workers/applicationFormPdfWorker.ts --bundle --platform=node --target=node20 --minify --legal-comments=none --outfile=.lambda-build/worker.js");

  // stage template into .lambda-build/templates/...
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  fs.copyFileSync(TEMPLATE_SRC, TEMPLATE_DST);

  // stage font into .lambda-build/fonts/...
  fs.mkdirSync(FONTS_DIR, { recursive: true });
  fs.copyFileSync(FONT_SRC, FONT_DST);

  // stage icon into .lambda-build/icons/...
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  fs.copyFileSync(ICON_SRC, ICON_DST);

  // zip from inside .lambda-build so paths are correct
  run(`npx bestzip ${ZIP_NAME} worker.js templates/npt-india-application-form-fillable.pdf fonts/inter-regular.ttf icons/check-mark.png`, { cwd: BUILD_DIR });

  // cleanup staging artifacts (leave only the zip)
  try {
    fs.unlinkSync(WORKER_JS);
  } catch {}
  try {
    fs.rmSync(TEMPLATE_DIR, { recursive: true, force: true });
  } catch {}
  try {
    fs.rmSync(FONTS_DIR, { recursive: true, force: true });
  } catch {}
  try {
    fs.rmSync(ICONS_DIR, { recursive: true, force: true });
  } catch {}

  console.log(`✅ Built ${path.join(".lambda-build", ZIP_NAME)}`);
}

main();
