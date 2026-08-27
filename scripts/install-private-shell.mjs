import { execFileSync } from "node:child_process";

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error("Missing GITHUB_TOKEN. Add a read-only GitHub token in Vercel Project Settings → Environment Variables, then redeploy.");
  process.exit(1);
}

const authenticatedBase = `https://x-access-token:${token}@github.com/`;

// npm's GitHub resolver can normalize github: dependencies to SSH. Redirect both
// common GitHub SSH forms to token-authenticated HTTPS for this build only.
execFileSync("git", [
  "config",
  "--global",
  `url.${authenticatedBase}.insteadOf`,
  "ssh://git@github.com/"
], { stdio: "inherit" });

execFileSync("git", [
  "config",
  "--global",
  `url.${authenticatedBase}.insteadOf`,
  "git@github.com:"
], { stdio: "inherit" });

execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install"], {
  stdio: "inherit",
  env: process.env
});
