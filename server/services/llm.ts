import Groq from "groq-sdk";
import * as dotenv from "dotenv";
import * as registry from "./registry";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "dummy_key_for_tests",
});

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
    { role: "user", content: prompt },
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
    model: "llama-3.1-8b-instant",
    messages,
  };

  if (activeNiches.length > 0) {
    callOptions.tools = tools;
    callOptions.tool_choice = "auto";
  }

  let response;
  try {
    response = await groq.chat.completions.create(callOptions);
  } catch (error: any) {
    console.error("Groq Intent Detection Error:", error.message || error);
    // Fallback if the model hallucinates a non-existent tool (common Groq 400 error)
    return {
      delegate: false,
      text: "I encountered an internal routing error (hallucinated tool call). Please try rephrasing your request."
    };
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

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: result },
    ],
  });

  const evaluation = (response.choices[0].message.content || "").trim();
  return evaluation.toUpperCase() === "YES" ? "YES" : "NO";
}
