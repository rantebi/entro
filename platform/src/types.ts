export type LeakHit = {
  file: string;
  line: number;
  value: string;
};

export type Commit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  hasLeaks?: boolean;
  leaks?: LeakHit[];
};

