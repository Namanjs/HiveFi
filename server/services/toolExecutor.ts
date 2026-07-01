import * as fs from "fs";
import * as path from "path";
import { runCommandInSandbox } from "./sandbox";
import { TOOLS } from "./toolDefinitions";

const pendingApprovals = new Map<string, (approved: boolean) => void>();

export function handleToolApprovalResponse(approvalId: string, approved: boolean) {
  const resolve = pendingApprovals.get(approvalId);
  if (resolve) {
    resolve(approved);
    pendingApprovals.delete(approvalId);
  }
}

export async function executeToolCall(
  toolName: string,
  params: any,
  projectRoot: string,
  socket: any
): Promise<string> {
  // Check if tool needs approval (Medium/Dangerous tiers)
  const isDangerous = toolName === "execute_command";
  const isMedium = toolName === "write_file" || toolName === "install_packages";

  if (isDangerous || isMedium) {
    const approvalId = Math.random().toString(36).substring(2, 11);
    
    // Request approval from client
    socket.emit("TOOL_APPROVAL_REQUEST", {
      id: approvalId,
      tool: toolName,
      params
    });

    // Wait for approval response
    const approved = await new Promise<boolean>((resolve) => {
      pendingApprovals.set(approvalId, resolve);
      // Auto-timeout after 2 minutes of inactivity
      setTimeout(() => {
        if (pendingApprovals.has(approvalId)) {
          resolve(false);
          pendingApprovals.delete(approvalId);
        }
      }, 120000);
    });

    if (!approved) {
      return `Error: Tool execution rejected by user.`;
    }
  }

  // Execute the tool
  try {
    switch (toolName) {
      case "read_file": {
        const filePath = path.resolve(projectRoot, params.path);
        if (!filePath.startsWith(path.resolve(projectRoot))) {
          return "Error: Access denied (path outside workspace).";
        }
        if (!fs.existsSync(filePath)) {
          return `Error: File not found: ${params.path}`;
        }
        return fs.readFileSync(filePath, "utf8");
      }

      case "list_directory": {
        const dirPath = path.resolve(projectRoot, params.path || ".");
        if (!dirPath.startsWith(path.resolve(projectRoot))) {
          return "Error: Access denied (path outside workspace).";
        }
        if (!fs.existsSync(dirPath)) {
          return `Error: Directory not found: ${params.path}`;
        }
        const items = fs.readdirSync(dirPath);
        return items.join("\n");
      }

      case "write_file": {
        const filePath = path.resolve(projectRoot, params.path);
        if (!filePath.startsWith(path.resolve(projectRoot))) {
          return "Error: Access denied (path outside workspace).";
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, params.content, "utf8");
        
        socket.emit("FILE_UPDATE", { path: params.path, content: params.content });
        return `File successfully written to ${params.path}`;
      }

      case "install_packages": {
        const manager = params.manager || "npm";
        const pkgs = params.packages.join(" ");
        let cmd = `npm install ${pkgs}`;
        if (manager === "pip") {
          cmd = `pip install ${pkgs}`;
        } else if (manager === "cargo") {
          cmd = `cargo add ${pkgs}`;
        }
        
        return new Promise<string>((resolve) => {
          const { process: proc } = runCommandInSandbox(cmd, projectRoot);
          let output = "";
          
          proc.stdout?.on("data", (chunk) => {
            output += chunk.toString();
            socket.emit("TERMINAL_OUTPUT", { text: chunk.toString() });
          });
          
          proc.stderr?.on("data", (chunk) => {
            output += chunk.toString();
            socket.emit("TERMINAL_OUTPUT", { text: chunk.toString(), isError: true });
          });
          
          proc.on("close", (code) => {
            socket.emit("TERMINAL_EXIT", { code: code ?? 0 });
            if (code === 0) {
              resolve(`Successfully installed packages: ${params.packages.join(", ")}`);
            } else {
              resolve(`Package installation failed (exit code ${code}). Output:\n${output}`);
            }
          });
        });
      }

      case "execute_command": {
        return new Promise<string>((resolve) => {
          const { process: proc } = runCommandInSandbox(params.command, projectRoot);
          let output = "";
          
          proc.stdout?.on("data", (chunk) => {
            output += chunk.toString();
            socket.emit("TERMINAL_OUTPUT", { text: chunk.toString() });
          });
          
          proc.stderr?.on("data", (chunk) => {
            output += chunk.toString();
            socket.emit("TERMINAL_OUTPUT", { text: chunk.toString(), isError: true });
          });
          
          proc.on("close", (code) => {
            socket.emit("TERMINAL_EXIT", { code: code ?? 0 });
            resolve(`Command finished (exit code ${code}). Output:\n${output}`);
          });
        });
      }

      default:
        return `Error: Unknown tool: ${toolName}`;
    }
  } catch (err: any) {
    return `Error executing tool: ${err.message}`;
  }
}

export function injectToolsContext(prompt: string, niche: string): string {
  const toolsSection = TOOLS.map(t => {
    return `- ${t.name}: ${t.description}. Params: ${JSON.stringify(t.parameters.properties)}`;
  }).join("\n");

  return `
[SYSTEM INSTRUCTION]
You are a highly capable AI agent specializing in ${niche}.
You have access to the following workspace tools. If you need to perform any file operations, read directories, run tests, or install packages, you MUST output a tool request block.

Available Tools:
${toolsSection}

To request a tool execution, you MUST output exactly a JSON block matching this structure at the very end of your response, with NO markdown formatting:
{
  "tool": "<tool_name>",
  "params": {
    "<param_name>": "<param_value>"
  }
}

Example tool request:
{
  "tool": "install_packages",
  "params": {
    "packages": ["express-validator"]
  }
}

Once you request a tool, the orchestrator will execute it and provide the results in the next turn.
If you have completed your task and do not need any further tools, respond with your final code changes or final text.

[USER REQUEST]
${prompt}
  `.trim();
}

export interface ToolCallRequest {
  tool: string;
  params: any;
}

export function parseToolCall(response: string): ToolCallRequest | null {
  const clean = response.trim();
  // Try parsing the whole response
  try {
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === "object" && typeof parsed.tool === "string") {
      return parsed as ToolCallRequest;
    }
  } catch (e) {}

  // If that fails, try extracting a JSON block
  const jsonBlockRegex = /```(?:json)?\n?([\s\S]*?)```/i;
  const match = jsonBlockRegex.exec(clean);
  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === "object" && typeof parsed.tool === "string") {
        return parsed as ToolCallRequest;
      }
    } catch (e) {}
  }

  // Also try looking for curly braces at the end of the text
  const lastCurlyStart = clean.lastIndexOf("{");
  if (lastCurlyStart !== -1) {
    try {
      const parsed = JSON.parse(clean.substring(lastCurlyStart));
      if (parsed && typeof parsed === "object" && typeof parsed.tool === "string") {
        return parsed as ToolCallRequest;
      }
    } catch (e) {}
  }

  return null;
}
