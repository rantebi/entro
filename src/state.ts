import { GitHubClient } from "./githubClient.js";

export type RepoInput = {
  repoWebUrl: string;
  repoBranch: string;
};

export type RepoHealth = {
  exists: boolean;
  hasValidBranch: boolean;
};

export type RepoState = RepoInput & {
  health: RepoHealth;
  totalCommits: number;
};

export const github = new GitHubClient();

let currentRepo: RepoState | null = null;
let currentRepoTarget: { owner: string; repo: string } | null = null;

export const getCurrentRepoState = () => currentRepo;
export const getCurrentRepoTarget = () => currentRepoTarget;

export const setRepoState = (repo: RepoState, target: { owner: string; repo: string }) => {
  currentRepo = repo;
  currentRepoTarget = target;
};

