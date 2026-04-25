const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TARGETS = ["client", "server", "shared", "scripts"];
const ROOT_FILES = ["db.js", "server.js"];

function collectJavaScriptFiles(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return [];
  }

  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    return targetPath.endsWith(".js") ? [targetPath] : [];
  }

  return fs.readdirSync(targetPath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "artifacts") {
      return [];
    }

    return collectJavaScriptFiles(path.join(targetPath, entry.name));
  });
}

const files = [
  ...ROOT_FILES.map((fileName) => path.join(ROOT, fileName)),
  ...TARGETS.flatMap((target) => collectJavaScriptFiles(path.join(ROOT, target))),
].filter((filePath) => fs.existsSync(filePath));

const failures = [];

files.forEach((filePath) => {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failures.push({
      filePath: path.relative(ROOT, filePath),
      output: `${result.stdout || ""}${result.stderr || ""}`.trim(),
    });
  }
});

if (failures.length > 0) {
  failures.forEach((failure) => {
    console.error(`Syntax check failed: ${failure.filePath}`);
    console.error(failure.output);
  });
  process.exit(1);
}

console.log(`Syntax OK (${files.length} files)`);
