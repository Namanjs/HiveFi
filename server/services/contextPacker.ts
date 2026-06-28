import type { ProjectState } from "./projectState";

interface ContextPackage {
  fileTree: string;
  relevantFiles: Record<string, string>;
  metadata: {
    projectName: string;
    currentStep: string;
    currentIteration: number;
    previousStepOutput?: string;
    reviewFeedback?: string;
  };
}

const NICHE_FILE_MAP: Record<string, (path: string) => boolean> = {
  "DESIGN": () => true,
  "FRONTEND": (path) => {
    const ext = path.split(".").pop()?.toLowerCase();
    const isFrontendFile = ["html", "css", "tsx", "jsx", "ts", "js", "scss", "less", "svg", "json"].includes(ext || "");
    const isServerFile = path.startsWith("server/") || path.startsWith("api/");
    return (isFrontendFile && !isServerFile) || path.includes("design") || path.includes("spec") || path.endsWith(".md");
  },
  "BACKEND": (path) => {
    const ext = path.split(".").pop()?.toLowerCase();
    const isBackendExt = ["ts", "js", "py", "sql", "yaml", "yml", "json", "env", "toml"].includes(ext || "");
    const isServerFile = path.startsWith("server/") || path.startsWith("api/");
    const isConfigFile = path === "package.json" || path === "tsconfig.json";
    const isFrontendOnly = ["html", "css", "tsx", "jsx", "scss", "svg"].includes(ext || "");
    return (isServerFile || isBackendExt || isConfigFile) && !isFrontendOnly;
  },
  "REVIEWER": () => true,
};

const DEFAULT_FILTER = () => true;

function getFilterForNiche(niche: string): (path: string) => boolean {
  const upper = niche.toUpperCase();
  return NICHE_FILE_MAP[upper] || DEFAULT_FILTER;
}

function renderFileTree(files: Record<string, string>): string {
  const paths = Object.keys(files).sort();
  const parts = paths.map(p => {
    const depth = p.split("/").length;
    const indent = "  ".repeat(Math.max(0, depth - 1));
    const name = p.split("/").pop();
    return `${indent}${name}`;
  });
  return parts.join("\n");
}

export function buildContext(
  state: ProjectState,
  niche: string,
  stepInfo: {
    stepName: string;
    iteration: number;
    previousStepOutput?: string;
    reviewFeedback?: string;
  }
): ContextPackage {
  const filter = getFilterForNiche(niche);
  const relevantFiles: Record<string, string> = {};
  let totalTokens = 0;
  const MAX_TOKENS = 8000;

  const sortedPaths = Object.keys(state.files).sort();
  let fileBudget = MAX_TOKENS;

  const firstPassFiles: string[] = [];
  for (const path of sortedPaths) {
    if (!filter(path)) continue;
    const estimatedTokens = Math.ceil(state.files[path].length / 4);
    if (totalTokens + estimatedTokens <= fileBudget * 0.7) {
      firstPassFiles.push(path);
      totalTokens += estimatedTokens;
    }
  }

  for (const path of firstPassFiles) {
    relevantFiles[path] = state.files[path];
  }

  for (const path of sortedPaths) {
    if (!filter(path) || firstPassFiles.includes(path)) continue;
    const content = state.files[path];
    const estimatedTokens = Math.ceil(content.length / 4);

    if (totalTokens + estimatedTokens > fileBudget) {
      const remainingTokens = fileBudget - totalTokens;
      const maxChars = remainingTokens * 4;
      const lines = content.split("\n");
      let truncatedLines: string[] = [];

      let naturalBreakIdx = lines.length;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length + 1 > maxChars) {
          for (let j = i; j >= 0; j--) {
            if (lines[j].trim() === "" || /^(export |function |class |interface |type |const |import )/.test(lines[j])) {
              naturalBreakIdx = j;
              break;
            }
          }
          if (naturalBreakIdx === lines.length) naturalBreakIdx = i;
          break;
        }
        charCount += lines[i].length + 1;
      }

      truncatedLines = lines.slice(0, naturalBreakIdx);
      const omittedChars = content.length - truncatedLines.join("\n").length;
      relevantFiles[path] = truncatedLines.join("\n") +
        `\n// ... [FILE TRUNCATED: ${omittedChars} chars omitted (${Math.ceil(omittedChars / 4)} tokens). ` +
        `To modify this file, reference it by path in your prompt.] ...\n`;
      totalTokens = fileBudget;
    } else {
      relevantFiles[path] = content;
      totalTokens += estimatedTokens;
    }

    if (totalTokens >= fileBudget) break;
  }

  return {
    fileTree: renderFileTree(state.files),
    relevantFiles,
    metadata: {
      projectName: state.metadata.name,
      currentStep: stepInfo.stepName,
      currentIteration: stepInfo.iteration,
      previousStepOutput: stepInfo.previousStepOutput,
      reviewFeedback: stepInfo.reviewFeedback,
    },
  };
}
