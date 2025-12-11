import { Request, Response } from "express";
import { CommitSummary } from "./githubClient.js";
import { findGeneratedLeaks, LeakHit } from "./leakIdentifier.util.js";
import { getCurrentRepoState, getCurrentRepoTarget, github } from "./state.js";

type ScanResult = {
  branch: string;
  commits: (CommitSummary & { hasLeaks: boolean; leaks: LeakHit[] })[];
  totalFetched: number;
  lastUpdated: string;
};

const PAGE_SIZE = 50;
const MAX_COMMITS = 40 * PAGE_SIZE;
let latestScan: ScanResult | null = null;

const enrichCommit = async (owner: string, repo: string, commit: CommitSummary) => {
  const diff = await github.getCommitDiff(owner, repo, commit.sha);
  const leaks = findGeneratedLeaks(diff);
  const hasLeaks = leaks.length > 0;
  if (hasLeaks) {
    console.log(`[scan][${owner}/${repo}@${commit.sha}] found ${leaks.length} leaks`);
  }
  return { ...commit, hasLeaks, leaks };
};

export const initiateScan = async (owner: string, repo: string, branch: string) => {
  const collected: (CommitSummary & { hasLeaks: boolean; leaks: LeakHit[] })[] = [];
  let page = 1;

  while (collected.length < MAX_COMMITS) {
    const commits = await github.getCommits(owner, repo, branch, page, PAGE_SIZE);
    console.log(`[scan][${owner}/${repo}#${branch}] fetched total ${collected.length + commits.length} commits`);
    if (!commits.length) {
      break;
    }

    for (const commit of commits) {
      const enriched = await enrichCommit(owner, repo, commit);
      collected.push(enriched);
      if (collected.length >= MAX_COMMITS) {
        break;
      }
    }

    // Finished running through branch
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

  return latestScan;
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

