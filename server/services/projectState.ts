export interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  path: string;
}

export interface ProjectState {
  files: Record<string, string>;
  metadata: {
    name: string;
    prompt: string;
    currentStep: number;
    totalSteps: number;
    currentIteration: number;
    maxIterations: number;
    totalCost: number;
    specialists: string[];
  };
}

export interface CodeGenPlanStep {
  step: string;
  niche: string;
  prompt: string;
  expectedFiles?: string[];
}

export interface CodeGenPlan {
  type: "code_generation";
  projectName: string;
  description: string;
  plan: CodeGenPlanStep[];
}

export interface CodeGenIntentResult {
  delegate: true;
  type: "code_generation";
  codeGenPlan: CodeGenPlan;
  text?: string;
}

export interface FileOperation {
  type: "write" | "delete" | "rename";
  path: string;
  content?: string;
  newPath?: string;
}

export interface ReviewResult {
  passed: boolean;
  score: number;
  feedback: string;
  issues: string[];
  stepFeedback?: Record<string, string>;
}

export const MAX_CODE_GEN_ITERATIONS = 3;
export const CODE_GEN_TOKEN_LIMIT = 8000;
