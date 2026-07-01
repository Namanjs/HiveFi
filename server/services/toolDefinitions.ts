export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  requiresApproval: boolean;
  riskTier: "safe" | "medium" | "dangerous";
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the entire contents of a file from the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to read (relative to the workspace root)." }
      },
      required: ["path"]
    },
    requiresApproval: false,
    riskTier: "safe"
  },
  {
    name: "list_directory",
    description: "List files and folders in a workspace directory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional path to list (defaults to workspace root)." }
      }
    },
    requiresApproval: false,
    riskTier: "safe"
  },
  {
    name: "write_file",
    description: "Create or overwrite a file in the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to create or write." },
        content: { type: "string", description: "The text content of the file." }
      },
      required: ["path", "content"]
    },
    requiresApproval: true,
    riskTier: "medium"
  },
  {
    name: "install_packages",
    description: "Install one or more external packages/dependencies via a package manager.",
    parameters: {
      type: "object",
      properties: {
        packages: { 
          type: "array", 
          items: { type: "string" }, 
          description: "List of package names to install." 
        },
        manager: { 
          type: "string", 
          enum: ["npm", "pip", "cargo"], 
          description: "Optional package manager to use (defaults to npm)." 
        }
      },
      required: ["packages"]
    },
    requiresApproval: true,
    riskTier: "medium"
  },
  {
    name: "execute_command",
    description: "Run an arbitrary shell command inside the workspace sandbox.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The exact shell command to execute." }
      },
      required: ["command"]
    },
    requiresApproval: true,
    riskTier: "dangerous"
  }
];
