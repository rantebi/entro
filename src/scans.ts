import { Request, Response } from "express";
import { CommitSummary } from "./githubClient.js";
import { getCurrentRepoState, getCurrentRepoTarget, github } from "./repos.js";

export const handleGetScans = (req: Request, res: Response) => {
  const leaksOnly = req.query.leaksOnly === "true";
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);
  const repoState = getCurrentRepoState();
  const branch =
    typeof req.query.branch === "string" ? req.query.branch : repoState?.repoBranch ?? "main";

  const repoTarget = getCurrentRepoTarget();

  if (!repoState || !repoTarget) {
    return res.status(404).json({ error: "No repo configured" });
  }

  github
    .getCommits(repoTarget.owner, repoTarget.repo, branch, page, pageSize)
    .then((commits: CommitSummary[]) => {
      const enriched = commits.map((commit: CommitSummary) => {
        const hasLeaks = commit.sha.slice(-1).match(/[0-9a-f]/)
          ? parseInt(commit.sha.slice(-1), 16) % 2 === 0
          : false;
        return { ...commit, hasLeaks };
      });
      const filtered = leaksOnly ? enriched.filter((c) => c.hasLeaks) : enriched;

      return res.json({
        branch,
        leaksOnly,
        page,
        pageSize,
        total: filtered.length,
        commits: filtered,
      });
    })
    .catch((error: any) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: "Failed to fetch commits", detail: message });
    });
};

