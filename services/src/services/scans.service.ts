import { Request, Response } from "express";
import { CommitSummary } from "../clients/githubClient.js";
import { findGeneratedLeaks, LeakHit } from "../utils/leakIdentifier.util.js";
import { getCurrentRepoState, getCurrentRepoTarget, github } from "./state.service.js";

type ScannedCommit = CommitSummary & {
  scanStatus: "pending" | "done";
  hasLeaks: boolean;
  leaks: LeakHit[];
};

type ScanResult = {
  branch: string;
  commits: ScannedCommit[];
  totalFetched: number;
  lastUpdated: string;
};

const PAGE_SIZE = 50;
const MAX_COMMITS = 10 * PAGE_SIZE;
let latestScan: ScanResult | null = null;

const enrichCommit = async (owner: string, repo: string, commit: ScannedCommit) => {
  const diff = await github.getCommitDiff(owner, repo, commit.sha);
  const leaks = findGeneratedLeaks(diff);
  const hasLeaks = leaks.length > 0;
  if (hasLeaks) {
    console.log(`[scan][${owner}/${repo}@${commit.sha}] found ${leaks.length} leaks`);
  }
  return { ...commit, hasLeaks, leaks, scanStatus: "done" as const };
};

export const initiateScan = async (owner: string, repo: string, branch: string) => {
  const collected: ScannedCommit[] = [];
  let page = 1;

  while (collected.length < MAX_COMMITS) {
    const commits = await github.getCommits(owner, repo, branch, page, PAGE_SIZE);
    console.log(
      `[scan][${owner}/${repo}#${branch}] fetched total ${collected.length + commits.length} commits`,
    );
    if (!commits.length) {
      break;
    }

    for (const commit of commits) {
      collected.push({
        ...commit,
        hasLeaks: false,
        leaks: [],
        scanStatus: "pending",
      });
      if (collected.length >= MAX_COMMITS) break;
    }

    if (commits.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  const trimmed = collected.slice(0, MAX_COMMITS);
  latestScan = {
    branch,
    commits: trimmed,
    totalFetched: trimmed.length,
    lastUpdated: new Date().toISOString(),
  };

  startLeakDetection(owner, repo, branch).catch((err) =>
    console.error(`[scan][${owner}/${repo}#${branch}] leak detection failed`, err),
  );

  return latestScan;
};

const startLeakDetection = async (owner: string, repo: string, branch: string) => {
  if (!latestScan || latestScan.branch !== branch) return;

  for (let i = 0; i < latestScan.commits.length; i += 1) {
    const commit = latestScan.commits[i];
    if (commit.scanStatus === "done") continue;

    const enriched = await enrichCommit(owner, repo, commit);
    latestScan.commits[i] = enriched;
    latestScan.lastUpdated = new Date().toISOString();
  }
};

export const handleGetScans = (req: Request, res: Response) => {
  const repoState = getCurrentRepoState();
  const repoTarget = getCurrentRepoTarget();

  if (!repoState || !repoTarget) {
    return res.status(404).json({ error: "No repo configured" });
  }

  const leaksOnly = req.query.leaksOnly === "true";
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);
  const branch = typeof req.query.branch === "string" ? req.query.branch : repoState.repoBranch;

  if (!latestScan || latestScan.branch !== branch) {
    return res.status(404).json({ error: "No scan available for this branch" });
  }

  const filtered = leaksOnly ? latestScan.commits.filter((c) => c.hasLeaks) : latestScan.commits;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return res.json({
    branch,
    leaksOnly,
    page,
    pageSize,
    total: filtered.length,
    commits: paged,
    lastUpdated: latestScan.lastUpdated,
  });
};

