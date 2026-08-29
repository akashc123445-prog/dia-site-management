/* Copies the public marketing site into dist/ alongside the built app.
   Written in Node rather than a shell `cp` so the build works the same on
   Windows, macOS and Linux — npm scripts run through cmd.exe on Windows,
   which has no `cp`. */
import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";

const from = "marketing";
const to = "dist";

if (!existsSync(from)) {
  console.log(`No ${from}/ folder found — skipping marketing copy.`);
  process.exit(0);
}

await cp(from, to, { recursive: true });
console.log(`Copied ${from}/ into ${to}/`);
