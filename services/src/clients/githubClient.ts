import { Octokit } from "@octokit/rest";
import retry from "async-retry";
import dotenv from "dotenv";

dotenv.config();

export type RepoBranchMetadata = {
  repo: {
    id: number;
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string;
  };
  branch: {
    name: string;
    commitSha: string;
    protected: boolean;
  };
};

export type CommitSummary = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

export type CommitDiffFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
};

export type CommitDiff = {
  sha: string;
  files: CommitDiffFile[];
};

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string | undefined = process.env.GH_TOKEN) {
    if (!token) {
      throw new Error("GH_TOKEN is required to initialize GitHubClient");
    }
    this.octokit = new Octokit({ auth: token });
  }

  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    try {
      return await retry(
        async (_bail, attempt) => {
          if (attempt > 1) {
            console.log(`[github][retry] attempt ${attempt} for ${context}`);
          }
          return operation();
        },
        {
          retries: 8,
          factor: 2,
          minTimeout: 100,
          onRetry: (error, attempt) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[github][retry] attempt ${attempt} failed for ${context}: ${message}`);
          },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[github][retry] exhausted retries for ${context}: ${message}`);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async getRepoBranchMetadata(owner: string, repo: string, branch: string): Promise<RepoBranchMetadata> {
    const [repoRes, branchRes] = await Promise.all([
      this.withRetry(() => this.octokit.repos.get({ owner, repo }), `get repo ${owner}/${repo}`),
      this.withRetry(
        () => this.octokit.repos.getBranch({ owner, repo, branch }),
        `get branch ${owner}/${repo}#${branch}`,
      ),
    ]);

    return {
      repo: {
        id: repoRes.data.id,
        name: repoRes.data.name,
        fullName: repoRes.data.full_name,
        url: repoRes.data.html_url,
        defaultBranch: repoRes.data.default_branch,
      },
      branch: {
        name: branchRes.data.name,
        commitSha: branchRes.data.commit.sha,
        protected: branchRes.data.protected,
      },
    };
  }

  async getCommits(
    owner: string,
    repo: string,
    branch: string,
    page = 1,
    perPage = 30,
  ): Promise<CommitSummary[]> {
    const commits = await this.withRetry(
      () =>
        this.octokit.repos.listCommits({
          owner,
          repo,
          sha: branch,
          page,
          per_page: perPage,
        }),
      `list commits ${owner}/${repo}#${branch} (page ${page}, size ${perPage})`,
    );

    return commits.data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name ?? "Unknown",
      date: commit.commit.author?.date ?? "",
    }));
  }

  async getCommitDiff(owner: string, repo: string, commitSha: string): Promise<CommitDiff> {
    const commit = await this.withRetry(
      () => this.octokit.repos.getCommit({ owner, repo, ref: commitSha }),
      `get commit diff ${owner}/${repo}@${commitSha}`,
    );
    const files =
      commit.data.files?.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
      })) ?? [];

    return { sha: commit.data.sha, files };
  }
}

