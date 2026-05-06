"use strict";

// src/profile.ts
var import_node_child_process = require("node:child_process");
var import_node_fs2 = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = require("node:path");

// src/core.ts
var import_node_fs = require("node:fs");
function getInput(name, fallback = "") {
  const v = process.env[name];
  return v == null || v === "" ? fallback : v;
}
function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    info(`::set-output name=${name}::${value}`);
    return;
  }
  (0, import_node_fs.appendFileSync)(file, `${name}<<__DRIFT_EOF__
${value}
__DRIFT_EOF__
`);
}
function setFailed(message) {
  process.exitCode = 1;
  process.stderr.write(`::error::${message}
`);
}
function info(message) {
  process.stdout.write(`${message}
`);
}
function getEvent() {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) throw new Error("GITHUB_EVENT_PATH is not set");
  return JSON.parse((0, import_node_fs.readFileSync)(path, "utf8"));
}

// src/profile.ts
async function runProfile(command) {
  const dir = (0, import_node_fs2.mkdtempSync)((0, import_node_path.join)((0, import_node_os.tmpdir)(), "drift-"));
  const reportPath = (0, import_node_path.join)(dir, "report.json");
  info(`> ${command}`);
  const res = (0, import_node_child_process.spawnSync)(command, {
    shell: true,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, DRIFT_REPORT_PATH: reportPath }
  });
  if (res.status !== 0) {
    throw new Error(`Profile command exited with status ${res.status}`);
  }
  const raw = (0, import_node_fs2.readFileSync)(reportPath, "utf8");
  const parsed = JSON.parse(raw);
  if (typeof parsed.p95LatencyMs !== "number") {
    throw new Error('Profile report missing required field "p95LatencyMs"');
  }
  return parsed;
}

// src/api.ts
async function uploadScan(apiUrl, apiToken, payload) {
  const url = `${apiUrl.replace(/\/$/, "")}/api/ingest/scans`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...apiToken ? { authorization: `Bearer ${apiToken}` } : {}
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drift ingest failed (${res.status}): ${body}`);
  }
  return await res.json();
}

// src/render.ts
var ANNOTATION_LEVEL = {
  high: "failure",
  medium: "warning",
  low: "notice"
};
var STICKY_MARKER = "<!-- drift:sticky-comment -->";
function annotationLevel(severity) {
  return ANNOTATION_LEVEL[severity] ?? "notice";
}
function checkConclusion(verdict) {
  if (verdict === "regression") return "failure";
  if (verdict === "error") return "neutral";
  return "success";
}
function shouldFail(verdict, failOn) {
  if (failOn === "any") return verdict !== "pass";
  if (failOn === "regression") return verdict === "regression";
  return false;
}
function checkTitle(scan) {
  if (scan.verdict === "pass") return `OK \xB7 p95 ${scan.p95LatencyMs}ms`;
  if (scan.verdict === "regression") {
    const delta = scan.p95LatencyMs - scan.p95BaselineMs;
    return `Regression \xB7 p95 +${delta}ms vs baseline`;
  }
  return "Drift could not complete";
}
function checkSummary(scan) {
  const top = scan.issues.slice(0, 10).map(
    (i) => `- **${i.severity}** \`${i.filePath}${i.lineNumber ? `:${i.lineNumber}` : ""}\` \u2014 ${i.title} (+${i.impactMs}ms)`
  ).join("\n");
  return [
    `**Verdict:** ${scan.verdict} \u2014 ${scan.verdictSub}`,
    "",
    "| metric | this PR | baseline |",
    "|---|---:|---:|",
    `| p95 latency | ${scan.p95LatencyMs}ms | ${scan.p95BaselineMs}ms |`,
    `| CPU | ${scan.cpuPct}% | ${scan.cpuBaselinePct}% |`,
    `| DB queries | ${scan.dbQueries} | \u2014 |`,
    `| N+1 queries | ${scan.dbNPlusOne} | \u2014 |`,
    `| Cache hit rate | ${scan.cacheHitRate}% | \u2014 |`,
    "",
    top ? "### Top issues" : "",
    top,
    "",
    `[Open full report \u2192](${scan.url})`
  ].filter(Boolean).join("\n");
}
function commentBody(scan) {
  const emoji = scan.verdict === "pass" ? "\u{1F7E2}" : scan.verdict === "regression" ? "\u{1F534}" : "\u26AA";
  const delta = scan.p95LatencyMs - scan.p95BaselineMs;
  const deltaStr = delta >= 0 ? `+${delta}ms` : `${delta}ms`;
  const issues = scan.issues.slice(0, 5).map(
    (i) => `- **${i.severity}** \`${i.filePath}${i.lineNumber ? `:${i.lineNumber}` : ""}\` \u2014 ${i.title} (+${i.impactMs}ms)`
  ).join("\n");
  return [
    STICKY_MARKER,
    `## ${emoji} Drift performance scan`,
    `**${scan.verdict.toUpperCase()}** \u2014 ${scan.verdictSub}`,
    "",
    `| metric | this PR | baseline | delta |`,
    `|---|---:|---:|---:|`,
    `| p95 latency | ${scan.p95LatencyMs}ms | ${scan.p95BaselineMs}ms | ${deltaStr} |`,
    `| CPU | ${scan.cpuPct}% | ${scan.cpuBaselinePct}% | \u2014 |`,
    `| DB queries | ${scan.dbQueries} | \u2014 | \u2014 |`,
    `| N+1 | ${scan.dbNPlusOne} | \u2014 | \u2014 |`,
    `| Cache hit rate | ${scan.cacheHitRate}% | \u2014 | \u2014 |`,
    "",
    issues ? "### Top hotspots" : "",
    issues,
    "",
    `[Open full report \u2192](${scan.url})`
  ].filter(Boolean).join("\n");
}
function annotationsFor(scan) {
  return scan.issues.slice(0, 50).map((issue) => ({
    path: issue.filePath,
    start_line: issue.lineNumber ?? 1,
    end_line: issue.lineNumber ?? 1,
    annotation_level: annotationLevel(issue.severity),
    title: issue.title,
    message: `${issue.problem ?? issue.title}
+${issue.impactMs}ms`
  }));
}

// src/check.ts
async function createCheckRun(args) {
  const { token, owner, repo, headSha, conclusion, scan, fetchImpl = fetch } = args;
  const res = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/check-runs`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "Drift / performance",
        head_sha: headSha,
        status: "completed",
        conclusion,
        details_url: scan.url,
        external_id: String(scan.id),
        output: {
          title: checkTitle(scan),
          summary: checkSummary(scan),
          annotations: annotationsFor(scan)
        }
      })
    }
  );
  if (!res.ok) {
    info(`Failed to create check run (${res.status}): ${await res.text()}`);
    return;
  }
  info(`Created check run for ${headSha.slice(0, 7)} (${conclusion})`);
}

// src/comment.ts
async function upsertStickyComment(args) {
  const { token, owner, repo, prNumber, scan, fetchImpl = fetch } = args;
  const body = commentBody(scan);
  const existing = await findStickyComment(fetchImpl, token, owner, repo, prNumber);
  const url = existing ? `https://api.github.com/repos/${owner}/${repo}/issues/comments/${existing.id}` : `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
  const res = await fetchImpl(url, {
    method: existing ? "PATCH" : "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json"
    },
    body: JSON.stringify({ body })
  });
  if (!res.ok) {
    info(`Failed to upsert sticky comment (${res.status}): ${await res.text()}`);
    return;
  }
  info(existing ? "Updated sticky comment" : "Created sticky comment");
}
async function findStickyComment(fetchImpl, token, owner, repo, prNumber) {
  const res = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28"
      }
    }
  );
  if (!res.ok) return null;
  const list = await res.json();
  return list.find((c) => c.body?.includes(STICKY_MARKER)) ?? null;
}

// src/main.ts
async function main() {
  const apiUrl = getInput("DRIFT_API_URL", "https://api.drift.dev");
  const apiToken = getInput("DRIFT_API_TOKEN");
  const profileCommand = getInput("DRIFT_PROFILE_COMMAND", "npx drift-profile");
  const failOn = getInput("DRIFT_FAIL_ON", "regression");
  const wantComment = getInput("DRIFT_COMMENT", "true") === "true";
  const githubToken = getInput("GITHUB_TOKEN");
  const event = getEvent();
  const pr = event.pull_request;
  if (!pr) {
    info("No pull_request payload \u2014 Drift only runs on pull_request events. Skipping.");
    return;
  }
  const repoFull = process.env.GITHUB_REPOSITORY;
  if (!repoFull) throw new Error("GITHUB_REPOSITORY is not set");
  const [owner, repo] = repoFull.split("/");
  const headSha = pr.head.sha;
  const baselineRef = getInput("DRIFT_BASELINE_REF") || pr.base.ref;
  info(`Profiling PR #${pr.number} (${headSha.slice(0, 7)}) against ${baselineRef}`);
  const report = await runProfile(profileCommand);
  info(`Uploading scan to ${apiUrl}`);
  const scan = await uploadScan(apiUrl, apiToken, {
    repo: { owner, name: repo },
    pr: {
      number: pr.number,
      title: pr.title,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      author: pr.user.login,
      url: pr.html_url,
      headSha
    },
    baselineRef,
    report
  });
  setOutput("scan-id", String(scan.id));
  setOutput("scan-url", scan.url);
  setOutput("verdict", scan.verdict);
  setOutput("p95-latency-ms", String(scan.p95LatencyMs));
  info(`Verdict: ${scan.verdict} (p95 ${scan.p95LatencyMs}ms vs baseline ${scan.p95BaselineMs}ms)`);
  if (githubToken) {
    await createCheckRun({
      token: githubToken,
      owner,
      repo,
      headSha,
      conclusion: checkConclusion(scan.verdict),
      scan
    });
    if (wantComment) {
      await upsertStickyComment({
        token: githubToken,
        owner,
        repo,
        prNumber: pr.number,
        scan
      });
    }
  } else {
    info("No GITHUB_TOKEN provided \u2014 skipping check run + PR comment");
  }
  if (shouldFail(scan.verdict, failOn)) {
    setFailed(`Drift verdict: ${scan.verdict}. See ${scan.url}`);
  }
}

// src/index.ts
main().catch((err) => {
  setFailed(err instanceof Error ? err.message : String(err));
});
