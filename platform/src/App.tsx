import { useEffect, useMemo, useRef, useState } from "react";
import { fetchScans, postRepo } from "./api";
import { Commit } from "./types";

type RepoForm = {
  repoWebUrl: string;
  repoBranch: string;
};

const PAGE_SIZE = 20;

export const App = () => {
  const [form, setForm] = useState<RepoForm>({
    repoWebUrl: "",
    repoBranch: "main",
  });
  const [commits, setCommits] = useState<Commit[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState("main");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const canLoadMore = useMemo(() => commits.length < total, [commits.length, total]);

  const submitRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await postRepo({ repoWebUrl: form.repoWebUrl, repoBranch: form.repoBranch });
      setActiveBranch(form.repoBranch || "main");
      setPage(1);
      setCommits([]);
      await loadPage(1, form.repoBranch || "main", true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save repo");
    }
  };

  const loadPage = async (targetPage: number, branch: string, replace = false) => {
    setLoading(true);
    try {
      const data = await fetchScans({ branch, page: targetPage, pageSize: PAGE_SIZE });
      setTotal(data.total);
      setCommits((prev) => (replace ? data.commits : [...prev, ...data.commits]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && canLoadMore) {
          const next = page + 1;
          setPage(next);
          loadPage(next, activeBranch);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [page, activeBranch, canLoadMore, loading]);

  const shortenSha = (sha: string) => (sha.length > 8 ? sha.slice(0, 8) : sha);

  return (
    <div className="layout">
      <header>
        <h1>Repo Leak Scanner</h1>
        <p>Configure a repo + branch, then browse scanned commits.</p>
      </header>

      <section className="card">
        <h2>Repository</h2>
        <form className="form" onSubmit={submitRepo}>
          <label>
            Repo web URL
            <input
              required
              placeholder="https://github.com/org/repo.git"
              value={form.repoWebUrl}
              onChange={(e) => setForm((f) => ({ ...f, repoWebUrl: e.target.value }))}
            />
          </label>
          <label>
            Repo branch
            <input
              placeholder="main"
              value={form.repoBranch}
              onChange={(e) => setForm((f) => ({ ...f, repoBranch: e.target.value }))}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save & Scan"}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card">
        <h2>Commits ({commits.length}/{total || "?"})</h2>
        <div className="table">
          <div className="table-head">
            <span>SHA</span>
            <span>Time</span>
            <span>Author</span>
            <span>Leaks</span>
          </div>
          {commits.map((c) => (
            <div key={c.sha} className="table-row">
              <span>
                <a
                  href={`https://github.com/search?q=${encodeURIComponent(c.sha)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortenSha(c.sha)}
                </a>
              </span>
              <span>{new Date(c.date).toLocaleString()}</span>
              <span>{c.author}</span>
              <span className="leaks">
                {c.hasLeaks ? `${c.leaks?.length ?? 0} leak(s)` : "None"}
                {c.leaks && c.leaks.length > 0 && (
                  <span className="leaks-tooltip">
                    {c.leaks.map((l, idx) => (
                      <div key={idx}>
                        {l.file}:{l.line} — {l.value}
                      </div>
                    ))}
                  </span>
                )}
              </span>
            </div>
          ))}
          {loading && <div className="loading">Loading…</div>}
          {!loading && commits.length === 0 && <div className="muted">No commits yet.</div>}
          <div ref={loadMoreRef} style={{ height: 1 }} />
        </div>
      </section>
    </div>
  );
};

