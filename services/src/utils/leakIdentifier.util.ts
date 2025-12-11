import { CommitDiff } from "../clients/githubClient.js";

export type LeakHit = {
  file: string;
  line: number;
  value: string;
};

type LineMatcher = (line: string) => boolean;

// Rudimentary detector for secrets in added lines. This intentionally stays
// basic: it flags tokens/keys/secrets that look like value assignments.
const BASIC_SECRET_REGEX =
  /\b(?:api[_-]?key|secret|token)\b[^\r\n]{0,20}["']?[A-Za-z0-9/_+=.-]{12,}["']?/i;

const detectLeaks = (diff: CommitDiff, matcher: LineMatcher): LeakHit[] => {
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
        if (matcher(content)) {
          leaks.push({
            file: file.filename,
            line: currentLine,
            value: content,
          });
        }
        currentLine += 1;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        continue;
      } else {
        currentLine += 1;
      }
    }
  }

  return leaks;
};

// Simple detector: looks for the text "Generated" in added lines of the diff.
export const findGeneratedLeaks = (diff: CommitDiff): LeakHit[] =>
  detectLeaks(diff, (content) => content.includes("Generated"));

export const findRealSecretLeaks = (diff: CommitDiff): LeakHit[] =>
  detectLeaks(diff, (content) => BASIC_SECRET_REGEX.test(content));

// Chooses detection strategy based on env flag. Default is real secrets.
export const findLeaks = (diff: CommitDiff): LeakHit[] => {
  const detectGenerated = process.env.DETECT_THE_WORD_GENERATED === "true";
  return detectGenerated ? findGeneratedLeaks(diff) : findRealSecretLeaks(diff);
};

