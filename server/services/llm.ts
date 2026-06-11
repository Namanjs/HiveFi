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
        `You are the HiveFi Orchestrator. You are a highly capable general-purpose AI. If the user's request explicitly matches one of the specialized niches currently available on the network, you MUST delegate using the delegate_to_specialist tool. For complex tasks requiring multiple available specializations, call the tool MULTIPLE times in the correct execution order. 

Currently Available Network Niches: ${nicheString}.

IMPORTANT: If the user asks for something (like Python, SQL, React, etc.) but that niche is NOT listed in the Available Network Niches above, DO NOT DELEGATE. You must answer the user's request directly yourself.`,
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

  const response = await groq.chat.completions.create(callOptions);

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

/**
 * Call Specialist Endpoint
 * Makes a real HTTP POST to the external specialist node for execution.
 */
export async function callSpecialistEndpoint(endpoint: string, prompt: string, niche: string, context?: string): Promise<string> {
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
      body: JSON.stringify({ prompt, niche, context }),
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
    
    return data.result;
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

/**
 * Pass 3: Evaluation
 * Uses a strict system prompt to evaluate code validity.
 */
export async function evaluateResult(niche: string, result: string): Promise<string> {
  let systemContent = "You are an evaluator.";
  if (niche.toUpperCase() === "SQL") {
    systemContent =
      "You are a database and code evaluator. Analyze the following text. " +
      "Does it contain valid SQL syntax (even if mock schema)? Reply strictly with 'YES' or 'NO'. " +
      "Do not output anything else. No explanations, no markdown formatting.";
  } else if (niche.toUpperCase() === "PYTHON") {
    systemContent =
      "You are a code evaluator. Analyze the following text. " +
      "Does it contain valid Python syntax? Reply strictly with 'YES' or 'NO'. " +
      "Do not output anything else. No explanations, no markdown formatting.";
  } else if (niche.toUpperCase() === "DESIGN") {
    systemContent =
      "Does this text contain a structured UI/UX specification with layout and design details? Reply YES or NO only.";
  } else if (niche.toUpperCase() === "FRONTEND") {
    systemContent =
      "Does this text contain valid React JSX or TSX code? Reply YES or NO only.";
  } else {
    systemContent =
      `You are an expert evaluator for the domain/niche: ${niche.toUpperCase()}. Analyze the following text and determine if it represents a valid and reasonable attempt at solving a task in this niche. Reply strictly with 'YES' or 'NO'. Do not output anything else. No explanations, no markdown formatting.`;
  }

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: result },
    ],
  });

  const evaluation = (response.choices[0].message.content || "").trim();
  return evaluation.toUpperCase() === "YES" ? "YES" : "NO";
}
