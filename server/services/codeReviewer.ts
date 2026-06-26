import Groq from "groq-sdk";
import type { ProjectState, CodeGenPlan, ReviewResult } from "./projectState";
import type { SpecialistInfo } from "./registry";
import * as llm from "./llm";
import * as registry from "./registry";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy_key_for_tests" });

export async function reviewProject(
  state: ProjectState,
  plan: CodeGenPlan,
): Promise<ReviewResult> {
  const heuristicIssues: string[] = [];

  for (const step of plan.plan) {
    if (step.expectedFiles) {
      for (const expectedFile of step.expectedFiles) {
        if (!state.files[expectedFile]) {
          heuristicIssues.push(`Missing expected file: ${expectedFile} (from step: ${step.step})`);
        }
      }
    }
  }

  for (const [path, content] of Object.entries(state.files)) {
    if (!content.trim()) {
      heuristicIssues.push(`Empty file: ${path}`);
    }
  }

  for (const [path, content] of Object.entries(state.files)) {
    const lower = content.toLowerCase();
    if (
      lower.includes("todo") ||
      lower.includes("placeholder") ||
      lower.includes("// add your") ||
      lower.includes("/* implement */")
    ) {
      heuristicIssues.push(`File "${path}" may contain placeholder content`);
    }
  }

  let llmReview: { passed: boolean; score: number; feedback: string; issues: string[] };

  try {
    const reviewerSpec = await registry.getSpecialistByNiche("REVIEWER", 10);
    if (reviewerSpec && reviewerSpec.endpoint) {
      llmReview = await reviewViaSpecialist(state, plan, reviewerSpec);
    } else {
      llmReview = await reviewViaGroq(state, plan);
    }
  } catch (err) {
    llmReview = {
      passed: heuristicIssues.length === 0,
      score: Math.max(0, 100 - heuristicIssues.length * 20),
      feedback: heuristicIssues.length > 0
        ? `Heuristic checks found ${heuristicIssues.length} issue(s). ${heuristicIssues.join("; ")}`
        : "All heuristic checks passed.",
      issues: heuristicIssues,
    };
  }

  const allIssues = [...new Set([...heuristicIssues, ...llmReview.issues])];
  const passed = allIssues.length === 0 && llmReview.passed;

  return {
    passed,
    score: llmReview.score,
    feedback: llmReview.feedback + (heuristicIssues.length > 0 ? `\n\nAdditionally: ${heuristicIssues.join("; ")}` : ""),
    issues: allIssues,
    stepFeedback: undefined,
  };
}

async function reviewViaGroq(
  state: ProjectState,
  plan: CodeGenPlan,
): Promise<{ passed: boolean; score: number; feedback: string; issues: string[] }> {
  const fileList = Object.entries(state.files)
    .map(([path, content]) => `${path} (${content.length} chars)`)
    .join("\n");

  const fileContents = Object.entries(state.files)
    .map(([path, content]) => `\`\`\`file:${path}\n${content.slice(0, 3000)}\n\`\`\``)
    .join("\n\n");

  const prompt = `You are a senior code reviewer. Review this generated project and provide structured feedback.

PROJECT: ${plan.projectName}
DESCRIPTION: ${plan.description}

FILES:
${fileList}

CONTENTS:
${fileContents}

Evaluate:
1. Does the project correctly implement the user's request?
2. Are the files consistent with each other? (frontend calls match backend API)
3. Are there any obvious bugs, syntax errors, or missing imports?
4. Is the code quality acceptable?
5. Are there TODOs or placeholders that should be filled?

Respond with a JSON object:
{
  "passed": boolean (true if acceptable for next iteration),
  "score": number (0-100 quality score),
  "feedback": "Brief summary of what needs improvement",
  "issues": ["Specific issue 1", "Specific issue 2"]
}`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a senior code reviewer for multi-agent generated projects. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const result = JSON.parse(content);
      return {
        passed: result.passed === true,
        score: result.score || 50,
        feedback: result.feedback || "Review completed.",
        issues: Array.isArray(result.issues) ? result.issues : [],
      };
    }
  } catch (err) {
    console.error("Groq review failed:", err);
  }

  return {
    passed: true,
    score: 70,
    feedback: "Review could not be completed. Continuing with caution.",
    issues: [],
  };
}

async function reviewViaSpecialist(
  state: ProjectState,
  plan: CodeGenPlan,
  specialist: SpecialistInfo,
): Promise<{ passed: boolean; score: number; feedback: string; issues: string[] }> {
  const fileList = Object.entries(state.files)
    .map(([path, content]) => `${path} (${content.length} chars)`)
    .join("\n");

  const prompt = `Review the following generated project and provide structured feedback in JSON format.

Project: ${plan.projectName}
Description: ${plan.description}

Files:
${fileList}

Respond ONLY with a JSON object: 
{
  "passed": boolean,
  "score": number (0-100),
  "feedback": "summary",
  "issues": ["issue1", "issue2"]
}`;

  try {
    const response = await llm.callSpecialistEndpoint(
      specialist.endpoint, prompt, "REVIEWER"
    );

    const jsonMatch = response.result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        passed: result.passed === true,
        score: result.score || 50,
        feedback: result.feedback || "Review completed.",
        issues: Array.isArray(result.issues) ? result.issues : [],
      };
    }
  } catch (err) {
    console.error("Specialist review failed:", err);
  }

  return { passed: true, score: 70, feedback: "", issues: [] };
}
