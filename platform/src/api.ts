import { Commit } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export type ScanResponse = {
  branch: string;
  leaksOnly: boolean;
  page: number;
  pageSize: number;
  total: number;
  commits: Commit[];
  lastUpdated: string;
};

export const fetchScans = async (params: {
  branch: string;
  page: number;
  pageSize: number;
}): Promise<ScanResponse> => {
  const url = new URL(`${API_BASE}/scans`);
  url.searchParams.set("branch", params.branch);
  url.searchParams.set("page", params.page.toString());
  url.searchParams.set("pageSize", params.pageSize.toString());
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch scans (${res.status})`);
  }
  return res.json();
};

export const postRepo = async (payload: { repoWebUrl: string; repoBranch: string }) => {
  const res = await fetch(`${API_BASE}/repos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to set repo (${res.status})`);
  }
  return res.json();
};

