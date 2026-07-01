import { spawn, execSync, ChildProcess } from "child_process";
import * as path from "path";

let hasDockerChecked = false;
let isDockerAvailable = false;

function checkDocker(): boolean {
  if (hasDockerChecked) return isDockerAvailable;
  try {
    execSync("docker --version", { stdio: "ignore" });
    isDockerAvailable = true;
  } catch (e) {
    isDockerAvailable = false;
  }
  hasDockerChecked = true;
  return isDockerAvailable;
}

export interface SandboxOptions {
  enableNetwork?: boolean;
  memoryLimitMb?: number;
  cpuLimit?: number;
  baseImage?: string;
}

export interface RunResult {
  process: ChildProcess;
  kill: () => void;
}

/**
 * Runs a command in a sandboxed Docker container (if available), or falls back to a restricted host shell.
 */
export function runCommandInSandbox(
  command: string,
  projectRoot: string,
  options: SandboxOptions = {}
): RunResult {
  const useDocker = checkDocker();
  const enableNetwork = options.enableNetwork !== false;
  const memoryLimit = options.memoryLimitMb || 512;
  const cpuLimit = options.cpuLimit || 0.5;
  const baseImage = options.baseImage || "node:20-alpine";

  if (useDocker) {
    const dockerArgs = [
      "run",
      "--rm",
      "-i",
      ...(enableNetwork ? [] : ["--network=none"]),
      `-m=${memoryLimit}m`,
      `--cpus=${cpuLimit}`,
      "-v", `${path.resolve(projectRoot)}:/workspace`,
      "-w", "/workspace",
      baseImage,
      "sh", "-c", command
    ];

    const process = spawn("docker", dockerArgs);

    return {
      process,
      kill: () => {
        try {
          process.kill("SIGKILL");
        } catch (e) {}
      }
    };
  } else {
    // Fallback to restricted shell
    return runCommandInRestrictedShell(command, projectRoot);
  }
}

/**
 * Restricted shell fallback with basic keyword blocking and path checks
 */
function runCommandInRestrictedShell(command: string, projectRoot: string): RunResult {
  const blacklist = [
    "sudo ", "rm -rf /", "chmod ", "chown ", "passwd", "shadow", 
    "curl |", "wget |", "/etc/", "/var/run", "systemctl", "service"
  ];
  
  const isMalicious = blacklist.some(term => command.includes(term));
  if (isMalicious) {
    const dummy = spawn("sh", ["-c", `echo "Error: Command blocked by security policy." >&2; exit 1`]);
    return {
      process: dummy,
      kill: () => {}
    };
  }

  const process = spawn("sh", ["-c", command], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PATH: process.env.PATH
    }
  });

  return {
    process,
    kill: () => {
      try {
        process.kill();
      } catch (e) {}
    }
  };
}
