import type { FileOperation } from "./projectState";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { logger } from "./logger";

export function parseFileOperations(text: string): FileOperation[] {
  const operations: FileOperation[] = [];
  const seenPaths = new Set<string>();

  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object") {
      if (json.files && typeof json.files === "object") {
        for (const [path, content] of Object.entries(json.files)) {
          if (typeof path === "string" && typeof content === "string") {
            operations.push({ type: "write", path, content });
            seenPaths.add(path);
          }
        }
      }
      if (Array.isArray(json.delete)) {
        for (const path of json.delete) {
          if (typeof path === "string") {
            operations.push({ type: "delete", path });
          }
        }
      }
      if (json.rename && typeof json.rename === "object") {
        for (const [oldPath, newPath] of Object.entries(json.rename)) {
          if (typeof oldPath === "string" && typeof newPath === "string") {
            operations.push({ type: "rename", path: oldPath, newPath });
          }
        }
      }
    }
  } catch (err: any) {
    logger.debug(`parseFileOperations: text is not JSON formatted: ${err.message}`);
  }

  const fileBlockRegex = /```file:([^\n]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = fileBlockRegex.exec(text)) !== null) {
    const path = match[1].trim();
    let content = match[2];

    if (content.startsWith("\n")) content = content.slice(1);
    if (content.endsWith("\n")) content = content.slice(0, -1);

    if (!seenPaths.has(path)) {
      operations.push({ type: "write", path, content });
      seenPaths.add(path);
    }
  }

  const deleteBlockRegex = /```delete:([^\n]+)```/g;
  while ((match = deleteBlockRegex.exec(text)) !== null) {
    const path = match[1].trim();
    if (!seenPaths.has(path)) {
      operations.push({ type: "delete", path });
      seenPaths.add(path);
    }
  }

  return operations;
}

export function applyOperations(
  state: { files: Record<string, string> },
  operations: FileOperation[]
): { files: Record<string, string> } {
  const newFiles = { ...state.files };

  for (const op of operations) {
    switch (op.type) {
      case "write":
        if (op.content !== undefined) {
          newFiles[op.path] = op.content;
        }
        break;
      case "delete":
        delete newFiles[op.path];
        break;
      case "rename":
        if (op.newPath && newFiles[op.path] !== undefined) {
          newFiles[op.newPath] = newFiles[op.path];
          delete newFiles[op.path];
        }
        break;
    }
  }

  return { files: newFiles };
}

export function validateFilePath(path: string): boolean {
  if (path.startsWith("/")) return false;
  if (path.includes("..")) return false;
  if (!path.trim()) return false;
  if (path.includes("\0")) return false;
  if (!path.includes(".") && !path.endsWith("/")) {
    const allowedNoExt = ["dockerfile", "makefile", "readme", "license", ".gitignore", ".env", ".env.example"];
    const basename = path.split("/").pop()?.toLowerCase() || "";
    if (!allowedNoExt.includes(basename)) return false;
  }
  return true;
}

export function validateOperations(operations: FileOperation[]): {
  valid: FileOperation[];
  invalid: { operation: FileOperation; reason: string }[];
} {
  const valid: FileOperation[] = [];
  const invalid: { operation: FileOperation; reason: string }[] = [];

  for (const op of operations) {
    if (!validateFilePath(op.path)) {
      invalid.push({ operation: op, reason: `Invalid path: ${op.path}` });
      continue;
    }
    if (op.type === "rename" && op.newPath && !validateFilePath(op.newPath)) {
      invalid.push({ operation: op, reason: `Invalid target path: ${op.newPath}` });
      continue;
    }
    if (op.type === "write" && op.content !== undefined && op.content.length > 50000) {
      invalid.push({ operation: op, reason: `File too large: ${op.path} (${op.content.length} chars, max 50000)` });
      continue;
    }
    valid.push(op);
  }

  return { valid, invalid };
}

export function normalizePathForNiche(filePath: string, niche: string): string {
  const clean = filePath.replace(/^\.\//, "").trim();

  // If it already starts with a valid monorepo root folder, keep it!
  if (
    clean.startsWith("server/") ||
    clean.startsWith("client/") ||
    clean.startsWith("contracts/") ||
    clean.startsWith("specialist-node/")
  ) {
    return clean;
  }

  // Otherwise, route based on niche!
  const upperNiche = niche.toUpperCase();
  if (upperNiche === "BACKEND" || upperNiche === "SQL") {
    return `server/${clean}`;
  }
  if (upperNiche === "FRONTEND") {
    return `client/${clean}`;
  }

  return clean;
}


