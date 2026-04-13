import { execSync } from "node:child_process";
import { readdirSync, renameSync, rmSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const UI_DIR = "ui";
const OUT_DIR = "dist/ui";

const htmlFiles = readdirSync(UI_DIR).filter((f) => f.endsWith(".html"));

if (htmlFiles.length === 0) {
  console.error("No HTML files found in ui/ directory");
  process.exit(1);
}

console.log(`Building ${htmlFiles.length} UI bundles...`);

for (const file of htmlFiles) {
  const name = basename(file, ".html");
  const input = join(UI_DIR, file);
  console.log(`  Building ${name}...`);

  try {
    execSync(`INPUT=${input} npx vite build --outDir dist/ui-tmp`, {
      stdio: "pipe",
      env: { ...process.env, INPUT: input },
    });

    // Move the built file to dist/ui/<name>.html
    // Vite preserves the input path structure, so output is at dist/ui-tmp/ui/<name>.html
    const builtFile = join("dist/ui-tmp", UI_DIR, file);
    const destFile = join(OUT_DIR, file);
    if (existsSync(builtFile)) {
      renameSync(builtFile, destFile);
    }

    // Clean up temp dir
    rmSync("dist/ui-tmp", { recursive: true, force: true });

    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}: ${err.message}`);
    process.exit(1);
  }
}

console.log(`\nDone! ${htmlFiles.length} UI bundles in ${OUT_DIR}/`);
