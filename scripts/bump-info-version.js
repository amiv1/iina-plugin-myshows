#!/usr/bin/env node
/**
 * Updates the "version" field in Info.json to the given value.
 * Called by semantic-release's @semantic-release/exec prepareCmd.
 *
 * Usage: node scripts/bump-info-version.js <version>
 */

const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/bump-info-version.js <version>");
  process.exit(1);
}

const infoPath = path.resolve(__dirname, "../Info.json");
const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
info.version = version;
fs.writeFileSync(infoPath, JSON.stringify(info, null, 4) + "\n");
console.log(`Info.json version bumped to ${version}`);
