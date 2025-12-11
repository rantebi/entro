import express, { Request, Response } from "express";

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

app.post("/repos", (req: Request<unknown, unknown, RepoInput>, res: Response) => {
  const { repoWebUrl, repoBranch } = req.body || {};

  if (!repoWebUrl || !repoBranch) {
    return res.status(400).json({ error: "repoWebUrl and repoBranch are required" });
  }

  currentRepo = {
    repoWebUrl,
    repoBranch,
    health: { exists: true, hasValidBranch: true },
    totalCommits: 123,
  };

  return res.status(201).json({ message: "Repo stored", repo: currentRepo });
});

app.get("/repos", (_req: Request, res: Response) => {
  if (!currentRepo) {
    currentRepo = {
      repoWebUrl: "https://example.com/dummy/repo.git",
      repoBranch: "main",
      health: { exists: true, hasValidBranch: true },
      totalCommits: 123,
    };
  }

  return res.json({
    repoWebUrl: currentRepo.repoWebUrl,
    repoBranch: currentRepo.repoBranch,
    health: currentRepo.health,
    totalCommits: currentRepo.totalCommits,
  });
});

app.get("/scans", (req: Request, res: Response) => {
  const leaksOnly = req.query.leaksOnly === "true";
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);
  const branch = typeof req.query.branch === "string" ? req.query.branch : "main";

  const commits = buildDummyCommits(25);
  const filtered = leaksOnly ? commits.filter((c) => c.hasLeaks) : commits;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return res.json({
    branch,
    leaksOnly,
    page,
    pageSize,
    total: filtered.length,
    commits: paged,
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

