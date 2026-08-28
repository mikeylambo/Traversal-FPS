import { execFileSync } from "node:child_process";

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error("Missing GITHUB_TOKEN. Add a read-only GitHub token in Vercel Project Settings → Environment Variables, then redeploy.");
  process.exit(1);
}

const authenticatedBase = `https://x-access-token:${token}@github.com/`;

// npm's GitHub resolver can normalize github: dependencies to either SSH form.
// Register both rewrites under the same authenticated HTTPS base. `--add` is
// important here: without it, the second insteadOf value replaces the first.
for (const sshBase of ["ssh://git@github.com/", "git@github.com:"]) {
  execFileSync("git", [
    "config",
    "--global",
    "--add",
    `url.${authenticatedBase}.insteadOf`,
    sshBase
  ], { stdio: "inherit" });
}

execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install"], {
  stdio: "inherit",
  env: process.env
});
