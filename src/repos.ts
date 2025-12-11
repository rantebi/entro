import { Request, Response } from "express";
import { GitHubClient } from "./githubClient.js";

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

let currentRepo: RepoState | null = null;
let currentRepoTarget: { owner: string; repo: string } | null = null;
export const github = new GitHubClient();

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

export const getCurrentRepoState = () => currentRepo;
export const getCurrentRepoTarget = () => currentRepoTarget;

export const handlePostRepo = async (
  req: Request<unknown, unknown, RepoInput>,
  res: Response,
) => {
  const { repoWebUrl, repoBranch = "main" } = req.body || {};

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
};

export const handleGetRepo = async (_req: Request, res: Response) => {
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
};

