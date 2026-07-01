import Groq from "groq-sdk";
import * as registry from "./registry";
import { logger } from "./logger";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "dummy_key_for_tests",
});

export function sanitizePrompt(text: string): string {
  if (!text) return text;
  return text
    .replace(/<function\b[^>]*>/gi, "[blocked function tag]")
    .replace(/<\/function>/gi, "[blocked function end tag]")
    .replace(/\[\s*(system|assistant|user|tool result|assistant response)\s*\]/gi, "[blocked block tag]")
    .replace(/\bignore\s+all\s+(previous|prior)\s+instructions\b/gi, "[blocked override command]");
}

export interface IntentResult {
  delegate: boolean;
  chain?: { niche: string; sub_prompt: string }[];
  niche?: string;
  sub_prompt?: string;
  text?: string;
}

/**
 * Pass 1: Intent Detection (Routing)
 * Uses OpenAI function calling to determine if delegation is required.
 */
export async function detectIntent(prompt: string): Promise<IntentResult> {
  const sanitizedPrompt = sanitizePrompt(prompt);
  const specialists = await registry.getAllSpecialists();
  const activeNiches = Array.from(new Set(specialists.map(s => s.niche)));
  const nicheString = activeNiches.length > 0 ? activeNiches.join(", ") : "None";

  const messages: any[] = [
    {
      role: "system",
      content:
        `You are the HiveFi Orchestrator. You are a highly capable general-purpose AI router. Your PRIMARY goal is to delegate tasks to specialized agents whenever possible. 

Currently Available Network Niches: ${nicheString}.

If the user's request falls under the domain of ANY of these active niches, you MUST delegate using the delegate_to_specialist tool. 
For example: 
- HTML, CSS, UI, animations, or web components -> FRONTEND
- Database queries, schemas, data extraction -> SQL
- Scripts, data analysis, backend logic -> PYTHON
- Logos, layouts, color palettes -> DESIGN

Do NOT try to solve domain-specific tasks natively. Only answer directly if the request is a simple greeting, general conversation, or explicitly falls completely outside the available niches.`,
    },
    { role: "user", content: sanitizedPrompt },
  ];

  const tools: any[] = [
    {
      type: "function",
      function: {
        name: "delegate_to_specialist",
        description: "Delegate a sub-task to a specialized AI model on the HiveFi network",
        parameters: {
          type: "object",
          properties: {
            niche: {
              type: "string",
              description: `The specialization needed. MUST be exactly one of: ${nicheString}`,
            },
            sub_prompt: {
              type: "string",
              description: "The specific sub-task to send to the specialist",
            },
          },
          required: ["niche", "sub_prompt"],
        },
      },
    },
  ];

  // If there are no niches available, don't even provide the tool to the LLM to save tokens and prevent hallucinations
  const callOptions: any = {
    model: "llama-3.3-70b-versatile",
    messages,
  };

  if (activeNiches.length > 0) {
    callOptions.tools = tools;
    callOptions.tool_choice = "auto";
  }

  let response;
  try {
    response = await groqCallWithRetry(() => groq.chat.completions.create(callOptions));
  } catch (error: any) {
    logger.error("Groq Intent Detection Error:", error.message || error);
    throw error;
  }

  const responseMessage = response.choices[0].message;

  if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    if (responseMessage.tool_calls.length === 1) {
      const tc = responseMessage.tool_calls[0];
      if (tc.type === "function") {
        const args = JSON.parse(tc.function.arguments);
        return { delegate: true, niche: args.niche, sub_prompt: args.sub_prompt };
      }
    }
    // Multiple tool calls = chain
    const chain = responseMessage.tool_calls
      .filter((tc: any) => tc.type === "function" && tc.function.name === "delegate_to_specialist")
      .map((tc: any) => {
        if (tc.type === "function") {
          const args = JSON.parse(tc.function.arguments);
          return { niche: args.niche, sub_prompt: args.sub_prompt };
        }
        return { niche: "", sub_prompt: "" };
      });
      
    if (chain.length === 0) {
      return {
        delegate: false,
        text: "I encountered an internal routing error (hallucinated tool call). Please try rephrasing your request to target a specific specialist."
      };
    }
    
    return { delegate: true, chain };
  }

  return {
    delegate: false,
    text: responseMessage.content || "",
  };
}

/**
 * Check Specialist Health
 * Pings the specialist node's /health endpoint to ensure it's online and configured.
 */
export async function checkSpecialistHealth(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/health`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'x-auth-secret': process.env.AUTH_SECRET || ''
      },
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    return false;
  }
}

export interface SpecialistResponse {
  result: string;
  model_id: string;
  niche: string;
  processing_time_ms: number;
  tokens: number;
  final_amount_base: string;
  signature: string;
  result_hash: string;
}

/**
 * Call Specialist Endpoint
 * Makes a real HTTP POST to the external specialist node for execution.
 */
export async function callSpecialistEndpoint(endpoint: string, prompt: string, niche: string, context?: string, taskId?: string, providerId?: string, maxBudget?: number): Promise<SpecialistResponse> {
  const url = `${endpoint.replace(/\/$/, '')}/execute`;
  const timeoutMs = 90000; // 90 seconds timeout

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-secret': process.env.AUTH_SECRET || ''
      },
      body: JSON.stringify({ prompt, niche, context, taskId, providerId, maxBudget }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try { errorData = JSON.parse(errorText); } catch { /* ignore */ }
      
      const errorMessage = errorData?.error || errorText || `HTTP ${response.status}`;
      throw new Error(`Specialist node returned an error: ${errorMessage}`);
    }

    const data = await response.json();
    
    if (!data.result) {
      throw new Error("Specialist node returned a success status but no 'result' field in the payload.");
    }
    
    return data as SpecialistResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Specialist node timed out after ${timeoutMs / 1000} seconds. The escrow was not settled.`);
    }
    
    if (error.message.includes('Specialist node returned an error')) {
      throw error;
    }
    
    throw new Error(`Failed to communicate with specialist node at ${endpoint}. Error: ${error.message}`);
  }
}

const MIN_DELAY_MS = 1500;
let lastGroqCallTime = 0;

export async function rateLimitedDelay(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastGroqCallTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(r => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastGroqCallTime = Date.now();
}

export async function groqCallWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await rateLimitedDelay();
      return await fn();
    } catch (err: any) {
      if (err.status === 429 && attempt < maxRetries - 1) {
        const waitMs = Math.pow(2, attempt) * 1000;
        logger.warn(`Groq rate limited (429). Retry ${attempt + 1}/${maxRetries - 1} in ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Groq call failed after ${maxRetries} retries`);
}

export function isCodeGenerationPrompt(prompt: string): boolean {
  const codeGenKeywords = [
    "build", "create", "make", "generate", "develop", "implement",
    "app", "website", "web app", "api", "frontend", "backend",
    "project", "full stack", "react", "node", "express",
    "component", "page", "dashboard", "portfolio", "landing page",
    "todo", "blog", "ecommerce", "chat app", "real-time",
  ];

  const lower = prompt.toLowerCase();

  const hasBuildVerb = codeGenKeywords.slice(0, 6).some(k => lower.includes(k));
  const hasProjectNoun = codeGenKeywords.slice(6).some(k => lower.includes(k));

  const hasCodeIndicator = /```|`[a-z]+`|function|class|import|export|const |let |var /.test(prompt);

  const negativeKeywords = [
    "explain", "what is", "how does", "compare", "difference between",
    "tutorial", "documentation", "docs", "why", "when to use",
    "best practice", "vs ", "versus", "definition", "meaning",
    "tell me about", "what's the", "how to", "guide", "example of",
    "describe", "define", "overview", "introduction to",
  ];
  const hasNegative = negativeKeywords.some(k => lower.includes(k));

  const explicitBuildIntent = /^(i want to|please|can you|need to|help me)\s*(build|create|make|generate|develop)/.test(lower);

  return ((hasBuildVerb && hasProjectNoun && !hasNegative) || hasCodeIndicator || explicitBuildIntent) && !hasNegative;
}

export interface CodeGenPlanResult {
  type: "code_generation";
  projectName: string;
  description: string;
  plan: {
    step: string;
    niche: string;
    prompt: string;
  }[];
}

export async function detectCodeGenIntent(prompt: string): Promise<CodeGenPlanResult | null> {
  const specialists = await registry.getAllSpecialists();
  const activeNiches = Array.from(new Set(specialists.map(s => s.niche)));
  const nicheString = activeNiches.length > 0 ? activeNiches.join(", ") : "None";

  const messages: any[] = [
    {
      role: "system",
      content: `You are the HiveFi Code Generation Planner. Your job is to analyze user requests and create a structured plan for multi-agent code generation.

Available specialized agents: ${nicheString}

When a user asks to BUILD, CREATE, or GENERATE a PROJECT (like a web app, API, tool, script, or component), you should:
1. Decompose the project into a series of steps
2. Assign each step to the appropriate specialist niche
3. Write a clear, detailed prompt for each specialist

EXAMPLE:
User: "Build a todo app with React frontend and Express backend"
Plan:
- Step "design": Assign DESIGN to create the UI/UX design system
- Step "frontend": Assign FRONTEND to implement React components based on the design
- Step "backend": Assign BACKEND to create the REST API with SQLite

If the user's request is NOT a code generation task (e.g., a simple question, greeting, or single-task), return null.

Available niches: ${nicheString}

IMPORTANT: Return ONLY a valid JSON object. No markdown, no explanation.`,
    },
    { role: "user", content: prompt },
  ];

  const tools: any[] = [
    {
      type: "function",
      function: {
        name: "generate_code_plan",
        description: "Create a step-by-step plan for multi-agent code generation. Only use this when the user wants to BUILD or CREATE a project.",
        parameters: {
          type: "object",
          properties: {
            projectName: {
              type: "string",
              description: "Short project name (e.g., 'todo-app', 'blog-platform')",
            },
            description: {
              type: "string",
              description: "Brief description of what the project does",
            },
            plan: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step: {
                    type: "string",
                    description: "Step identifier (e.g., 'design', 'frontend', 'backend', 'testing')",
                  },
                  niche: {
                    type: "string",
                    description: `Specialist niche to assign. MUST be one of: ${nicheString}`,
                  },
                  prompt: {
                    type: "string",
                    description: "Detailed prompt for this specialist, including what files to create and what the previous step(s) produced",
                  },
                },
                required: ["step", "niche", "prompt"],
              },
              minItems: 1,
            },
          },
          required: ["projectName", "description", "plan"],
        },
      },
    },
  ];

  try {
    const response = await groqCallWithRetry(() => groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      tools,
      tool_choice: "auto",
    }));

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const tc = responseMessage.tool_calls[0];
      if (tc.type === "function" && tc.function.name === "generate_code_plan") {
        const args = JSON.parse(tc.function.arguments);
        return {
          type: "code_generation",
          projectName: args.projectName,
          description: args.description,
          plan: args.plan,
        };
      }
    }

    return null;
  } catch (error: any) {
    logger.error("CodeGen intent detection error:", error.message);
    throw error;
  }
}

export async function evaluateResult(originalPrompt: string, niche: string, result: string): Promise<string> {
  const systemContent = `You are an expert AI evaluator for the HiveFi decentralized AI network.
Your job is to evaluate if a specialist AI node has successfully completed the assigned task.

Task Niche: ${niche.toUpperCase()}
Original User Prompt/Task: "${originalPrompt}"

You must analyze the specialist's output and determine if it represents a valid, reasonable, and safe attempt at solving the Original User Prompt.
- For code (SQL, Python, Frontend), verify that the syntax is generally correct and matches the request.
- For text/design, verify that the response directly addresses the prompt.
- Reject (NO) if the output is completely irrelevant, hallucinates, or seems like an attempt to game the system (e.g., just printing 'hello world' for a complex task).

Reply STRICTLY with 'YES' if it passes, or 'NO' if it fails. Do not output any other text or explanations.`;

  const response = await groqCallWithRetry(() => groq.chat.completions.create({
    model: "mixtral-8x7b-32768",
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: result },
    ],
  }));

  const evaluation = (response.choices[0].message.content || "").trim();
  return evaluation.toUpperCase() === "YES" ? "YES" : "NO";
}
