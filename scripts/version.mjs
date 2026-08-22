import fs from "node:fs";

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const checkOnly = process.argv[2] === "--check";
const requestedVersion = checkOnly ? undefined : process.argv[2];

if (!checkOnly && (!requestedVersion || !versionPattern.test(requestedVersion))) {
  console.error("Usage: node scripts/version.mjs <MAJOR.MINOR.PATCH> | --check");
  process.exit(1);
}

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const writeJson = (path, value) => fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const tauriConfig = readJson("src-tauri/tauri.conf.json");
let cargoToml = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
let cargoLock = fs.readFileSync("Cargo.lock", "utf8");

const cargoTomlVersion = cargoToml.match(/^version = "([^"]+)"/m)?.[1];
const cargoLockMatch = cargoLock.match(/(name = "combo-macro-recorder"\r?\nversion = ")([^"]+)(")/);

if (!cargoTomlVersion || !cargoLockMatch) {
  console.error("Could not locate the application version in the Cargo files.");
  process.exit(1);
}

if (checkOnly) {
  const versions = new Map([
    ["package.json", packageJson.version],
    ["package-lock.json", packageLock.version],
    ["package-lock.json packages['']", packageLock.packages?.[""]?.version],
    ["src-tauri/Cargo.toml", cargoTomlVersion],
    ["Cargo.lock", cargoLockMatch[2]],
    ["src-tauri/tauri.conf.json", tauriConfig.version],
  ]);
  const expected = packageJson.version;
  const mismatches = [...versions].filter(([, version]) => version !== expected);
  if (!versionPattern.test(expected) || mismatches.length > 0) {
    console.error(`Version metadata must use SemVer and agree with package.json (${expected}):`);
    for (const [path, version] of versions) console.error(`  ${path}: ${version ?? "missing"}`);
    process.exit(1);
  }
  console.log(`All application versions agree: ${expected}`);
  process.exit(0);
}

packageJson.version = requestedVersion;
packageLock.version = requestedVersion;
packageLock.packages[""].version = requestedVersion;
tauriConfig.version = requestedVersion;
cargoToml = cargoToml.replace(/^version = "[^"]+"/m, `version = "${requestedVersion}"`);
cargoLock = cargoLock.replace(
  /(name = "combo-macro-recorder"\r?\nversion = ")([^"]+)(")/,
  `$1${requestedVersion}$3`,
);

writeJson("package.json", packageJson);
writeJson("package-lock.json", packageLock);
writeJson("src-tauri/tauri.conf.json", tauriConfig);
fs.writeFileSync("src-tauri/Cargo.toml", cargoToml);
fs.writeFileSync("Cargo.lock", cargoLock);
console.log(`Updated all application versions to ${requestedVersion}`);
