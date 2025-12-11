import { CommitDiff } from "./githubClient.js";

export type LeakHit = {
  file: string;
  line: number;
  value: string;
};

// Simple detector: looks for the text "Generated" in added lines of the diff
export const findGeneratedLeaks = (diff: CommitDiff): LeakHit[] => {
  const leaks: LeakHit[] = [];

  for (const file of diff.files) {
    if (!file.patch) continue;

    let currentLine = 0;
    const lines = file.patch.split("\n");

    for (const line of lines) {
      if (line.startsWith("@@")) {
        // Parse hunk header: @@ -a,b +c,d @@
        const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
        if (match) {
          currentLine = Number(match[1]);
        }
        continue;
      }

      if (line.startsWith("+") && !line.startsWith("+++")) {
        const content = line.slice(1);
        if (content.includes("Generated")) {
          leaks.push({
            file: file.filename,
            line: currentLine,
            value: content,
          });
        }
        currentLine += 1;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        // Removed line; do not increment currentLine for target file
        continue;
      } else {
        currentLine += 1;
      }
    }
  }

  return leaks;
};

