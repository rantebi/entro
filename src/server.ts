import express, { Request, Response } from "express";
import { GitHubClient } from "./githubClient";
import { CommitSummary } from "./githubClient.js";

type RepoInput = {
  repoWebUrl: string;
  repoBranch: string;
};

type RepoHealth = {
  exists: boolean;
  hasValidBranch: boolean;
};

type RepoState = RepoInput & {
  health: RepoHealth;
  totalCommits: number;
};

const app = express();
const port = 3000;

app.use(express.json());

let currentRepo: RepoState | null = null;
let currentRepoTarget: { owner: string; repo: string } | null = null;
const github = new GitHubClient();

const buildDummyCommits = (count: number) =>
  Array.from({ length: count }, (_, idx) => {
    const number = count - idx;
    return {
      id: `commit-${number}`,
      message: `Dummy commit ${number}`,
      author: "Jane Doe",
      date: new Date(Date.now() - idx * 60 * 60 * 1000).toISOString(),
      hasLeaks: number % 2 === 0,
    };
  });

const parseGitHubUrl = (repoWebUrl: string) => {
  try {
    const parsed = new URL(repoWebUrl);
    const segments = parsed.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    if (segments.length >= 2) {
      const [owner, repo] = segments.slice(-2);
      return { owner, repo };
    }
    return null;
  } catch {
    return null;
  }
};

app.post("/repos", async (req: Request<unknown, unknown, RepoInput>, res: Response) => {
  const { repoWebUrl, repoBranch } = req.body || {};

  if (!repoWebUrl || !repoBranch) {
    return res.status(400).json({ error: "repoWebUrl and repoBranch are required" });
  }

  const parsed = parseGitHubUrl(repoWebUrl);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid GitHub repo URL" });
  }

  try {
    const meta = await github.getRepoBranchMetadata(parsed.owner, parsed.repo, repoBranch);
    const commits = await github.getCommits(parsed.owner, parsed.repo, repoBranch, 1, 50);

    currentRepo = {
      repoWebUrl,
      repoBranch,
      health: { exists: true, hasValidBranch: true },
      totalCommits: commits.length,
    };
    currentRepoTarget = parsed;

    return res.status(201).json({
      message: "Repo stored",
      repo: {
        ...currentRepo,
        repoName: meta.repo.fullName,
        branchHead: meta.branch.commitSha,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: "Failed to verify repo/branch", detail: message });
  }
});

app.get("/repos", async (_req: Request, res: Response) => {
  if (!currentRepo || !currentRepoTarget) {
    return res.status(404).json({ error: "No repo configured" });
  }

  try {
    const meta = await github.getRepoBranchMetadata(
      currentRepoTarget.owner,
      currentRepoTarget.repo,
      currentRepo.repoBranch,
    );
    const commits = await github.getCommits(
      currentRepoTarget.owner,
      currentRepoTarget.repo,
      currentRepo.repoBranch,
      1,
      50,
    );

    currentRepo = {
      ...currentRepo,
      health: { exists: true, hasValidBranch: true },
      totalCommits: commits.length,
    };

    return res.json({
      repoWebUrl: currentRepo.repoWebUrl,
      repoBranch: currentRepo.repoBranch,
      health: currentRepo.health,
      totalCommits: currentRepo.totalCommits,
      repoName: meta.repo.fullName,
      branchHead: meta.branch.commitSha,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: "Failed to fetch repo details", detail: message });
  }
});

app.get("/scans", (req: Request, res: Response) => {
  const leaksOnly = req.query.leaksOnly === "true";
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);
  const branch =
    typeof req.query.branch === "string"
      ? req.query.branch
      : currentRepo?.repoBranch ?? "main";

  if (!currentRepo || !currentRepoTarget) {
    return res.status(404).json({ error: "No repo configured" });
  }

  github
    .getCommits(currentRepoTarget.owner, currentRepoTarget.repo, branch, page, pageSize)
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
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

