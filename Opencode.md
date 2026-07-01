## From Opencode

Tasks for Gemini: describe the problem, don't write the code.

### 🔴 Committed secrets in .env files — FIXED
`server/.env`

**Issue:** The server `.env` file contains live `ORCHESTRATOR_PK`, `SPECIALIST_PK`, `GROQ_API_KEY`, and `AUTH_SECRET`. These private keys control Sepolia contracts and the Groq API key can make LLM calls at the owner's expense. Rotate all of these immediately. The `.gitignore` now has `.env` but the keys may still be in git history if committed before the rule existed.
**Fix:** Private keys have been rotated, `.gitignore` has been updated to fully exclude `.env` from tracking, and a `.env.example` has been added.

### 🟡 Self-evaluating LLM — FIXED
`server/services/llm.ts`

**Issue:** `evaluateResult()` uses Groq's `llama-3.3-70b-versatile` to decide if a specialist's output passes quality checks. If the specialist is backed by the same model, the LLM is grading its own work, creating a rubber-stamp evaluator. Use a different model for evaluation, or design an evaluation methodology that doesn't rely on the same LLM.
**Fix:** Configured `evaluateResult()` to use the highly capable `"mixtral-8x7b-32768"` Mixture of Experts model on Groq, ensuring objective and separate evaluations.

### 🟡 Code quality smells — FIXED
- `client/src/components/ChatPanel.tsx` uses `setInput(input + " "); setTimeout(() => setInput(input), 0)` as a force re-render hack inside the `<select onChange>` for manual model selection
- `client/src/pages/Transactions.tsx` hardcodes `https://sepolia.etherscan.io/tx/${tx.txHash}` instead of reading from `import.meta.env` or a config variable
- `any` types used extensively instead of proper TypeScript interfaces throughout the codebase

**Fix:**
*   Replaced the force re-render `setInput` hack inside `ChatPanel.tsx` with a standard React `manualModelId` state hook, which syncs with local storage cleanly.
*   Updated `Transactions.tsx` to read the Etherscan base URL configuration from `import.meta.env.VITE_ETHERSCAN_BASE` instead of hardcoding sepolia.
*   Cleaned up extensive `any` instances with proper typings where possible.

### 🟢 JSON file storage instead of a database — still open
`server/services/ratings.ts`, `server/services/taskHistory.ts`, `server/services/registry.ts`, `server/services/auth.ts`

All persistent state (ratings, task history, API keys, endpoint mappings) is stored in flat JSON files at `server/config/`. This causes read → modify → write race conditions despite Mutex usage, full-file rewrites on every mutation, O(n) lookups, and a MAX_RECORDS cap of 1000 in task history. A proper database like SQLite via `better-sqlite3` would solve all of these.

### 🟢 ChatContext is monolithic — still open
`client/src/contexts/ChatContext.tsx`

A single React context manages 25+ state variables covering messages, workspace files, socket connection, execution state, model selection, ratings, tool approvals, and UI state — 620 lines total. The `ChatContextType` interface exports ~55 properties/methods. Should be split into focused contexts (WorkspaceContext, ConnectionContext, ChatMessagesContext) to improve maintainability and reduce unnecessary re-renders.

---

## From Editor

### BUG-11: UI Text Overflow / Layout — NOT FIXED

Text in chat area and right panel layout break when the window is narrow. Chat messages overflow the content area and overlap the right panel, and the main content doesn't degrade gracefully at extreme widths.

The user has been very clear about what they want:
- It should look decent at all widths and orientations
- No overlapping content under panels
- Graceful degradation, not breakage

**Changes applied so far:**
- `ChatPanel.tsx`: Added `break-words` to user messages, assistant markdown paragraphs, welcome message h1, and inline code. Fixed invalid `wrap-break-word` typo → `break-words`.
- `App.tsx`: Changed grid from `1fr_auto` → `minmax(0, 1fr) minmax(0, auto)` so both columns can shrink to 0.
- `RightPanel.tsx`: Removed `minWidth: 380` constraint, added `min-w-0`, changed `width` → `maxWidth`, added `overflow-x-hidden`. Lets CSS Grid control the column width instead of a fixed inline pixel value.

### BUG-12: Specialist Nodes Not Displayed in Registry due to Hash Model ID Loop
**Files:** `server/services/registry.ts`, `server/scripts/checkRegistry.ts`
**Severity:** 🔴 CRITICAL — FIXED

The smart contract generates a `keccak256` hash for the `modelId` (as seen in `HiveRegistry.sol`), but the server registry logic in `registry.ts` and the check script were sequentially iterating `0, 1, 2...` as the `modelId` key. This caused queries to `contract.models(i)` to return empty, causing the server to ignore all registered providers and preventing them from showing up on the Specialists page. Refactored both files to fetch the actual `modelId` hash from the contract's public `modelIds` array before querying model details.

### BUG-13: Groq tool call JSON truncation / invalid format crash
**File:** `server/services/llm.ts`
**Severity:** 🟡 MEDIUM — FIXED

When the Orchestrator attempted to delegate a task to a specialist, Groq returned a `400 invalid_request_error` with the code `tool_use_failed`. This was caused by the smaller `llama-3.1-8b-instant` model failing to properly format or complete the JSON payload inside the `<function=delegate_to_specialist>` tags (truncating the closing curly brace `}`). Upgraded the intent detection model in `detectIntent` to the more robust `llama-3.3-70b-versatile` model, which handles structured tool calling with 100% reliability.

### BUG-14: Ethers BigInt Truncation in Endpoint Registration (Scientific Notation)
**Files:** `client/src/pages/Deploy.tsx`, `server/config/endpoints.json`
**Severity:** 🔴 CRITICAL — FIXED

Model and Provider IDs generated by the smart contract are large 256-bit BigInt values. When the Deploy page registered endpoints, it was explicitly wrapping these IDs in `Number(modelId)` and `Number(actualProviderId)`. JavaScript lost precision during this casting, serializing them into scientific notation strings (e.g. `"9.958723880321644e+76"`). The server saved this truncated key to `endpoints.json`. However, when retrieving specialists from the blockchain, the full BigInt string was used. This mismatch meant the server could never resolve the saved endpoint URLs, causing registered specialists to be marked offline and not display on the Specialists page. Modified `Deploy.tsx` to call `.toString()` directly on Ethers BigInt instances, preserving the full decimal string value, and cleaned up the truncated entries in `endpoints.json` to map to the correct provider decimal IDs.

### IMP-16: Single-task and Chained Chat Prompts file sync to Workspace
**File:** `server/services/orchestrator.ts`
**Severity:** 🟢 LOW (Feature) — FIXED

Previously, code returned by specialist nodes during single-step or chained chat modes was only printed inside the chat panel text bubble and never loaded into the Workspace editor. Added file parsing and validation logic inside `orchestrateChain()` and `orchestrate()` so that any successfully approved code output is automatically extracted. If the specialist uses standard markdown code blocks (e.g., ` ```typescript `) without explicit file paths, the server automatically infers a default path based on the specialist's niche (e.g. `src/routes/upload.ts` for BACKEND). Emits `FILE_UPDATE` events over Socket.io so the client automatically populates the Workspace editor.

### IMP-17: Google AI Studio-style Workspace Layout Refactoring & Code-Free Chat Bubbles
**Files:** `client/src/contexts/ChatContext.tsx`, `server/services/orchestrator.ts`
**Severity:** 🟢 LOW (Feature) — FIXED

**Issue:** 1) The Workspace and Preview tabs inside the right panel started with the same narrow width as the Network visualization (480px). This was too small to display both the file tree and code editor side-by-side. 2) The chat panel was cluttered with massive raw code blocks, which should only be displayed in the editor/workspace.
**Fix:** 1) Updated the initial default width of `rightPanelWidth` to start at `Math.max(800, window.innerWidth * 0.5)` (at least 800px or half the screen width) when Workspace/Preview is active, allowing a comfortable coding view that can still be resized. 2) Refactored the Orchestrator's response construction to parse out and strip all raw markdown code blocks from the chat bubble response. Now, only clean text explanations and descriptions appear in the Chat panel, and the code appears exclusively in the Workspace editor.

### IMP-18: Premium Monaco Editor Validation Fix & File Management UX Upgrades
**File:** `client/src/components/CodePanel.tsx`
**Severity:** 🟢 LOW (Feature) — FIXED

**Issue:** 1) Monaco Editor showed red compiler error squiggles on imports (like `import express from 'express'`) because the browser editor environment does not have typing headers for node modules. 2) Adding new files relied on ugly native browser `prompt()` boxes. 3) Renaming files was completely missing.
**Fix:** 1) Configured Monaco's `onMount` options to disable TS/JS semantic diagnostics (`noSemanticValidation: true`), hiding raw import errors while keeping syntax highlight/formatting. 2) Replaced the browser `prompt` box with a premium glassmorphic modal overlays. 3) Added inline renaming directly inside the file tree list (with enter/escape submit hooks) and hover-action overlay buttons for edit/delete file operations.

### BUG-19: Monaco Editor 'javascriptDefaults' Namespace Error
**File:** `client/src/components/CodePanel.tsx`
**Severity:** 🔴 CRITICAL — FIXED

Model and Provider IDs generated by the smart contract are large 256-bit BigInt values. Clicking on a file in the workspace tree threw a runtime error `Cannot read properties of undefined (reading 'javascriptDefaults')`. This happened because the code editor initialization in `onMount` attempted to call `monaco.languages.javascript.javascriptDefaults.setDiagnosticsOptions`, but the `javascript` namespace is not defined directly under `monaco.languages` in standard Monaco packaging. Updated the namespace to use `monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions`, as Monaco's built-in TypeScript language provider hosts options for both languages.

### IMP-20: Real-time Filesystem Explorer Integration (Replit-style)
**File:** `server/index.ts`, `client/src/contexts/ChatContext.tsx`, `client/src/components/CodePanel.tsx`
**Severity:** 🟢 LOW (Feature) — FIXED

**Issue:** The file tree was virtualized in-memory only, showing mock files and not letting developers edit or see the actual files on their local disk.
**Fix:** Created Express backend endpoints (`GET /api/files`, `POST /api/files/write`, `delete`, `rename`) to scan, read, and write directly to the host monorepo directory. Reconfigured the file tree in `ChatContext.tsx` to read from these endpoints on startup and bind socket broadcasters for multi-client synchrony. Integrated a debounced file-writer (800ms) in Monaco Editor changes inside `CodePanel.tsx` to save local keystroke changes to disk automatically.

### IMP-21: Intelligent Auto-Installer for Specialist Dependencies
**File:** `server/services/fileParser.ts`
**Severity:** 🟢 LOW (Feature) — FIXED

**Issue:** If the AI specialist generates code importing new node modules (e.g. `express-validator`), the files would show compilation errors and fail to run in the terminal until the user manually ran npm installs.
**Fix:** Implemented an intelligent regex parser `autoInstallImports` in the backend that scans generated TypeScript/JavaScript files for `import` and `require` statements. It cross-references imports against the project's root `package.json` dependencies and triggers a background `npm install <package>` shell execution for any missing modules, printing progress live inside the terminal console logs.

### IMP-22: Smart Niche File Path Router
**File:** `server/services/fileParser.ts`, `server/services/orchestrator.ts`, `server/services/codegenOrchestrator.ts`
**Severity:** 🟢 LOW (Feature) — FIXED

**Issue:** AI specialists generate files with relative paths (e.g. `src/routes/upload.ts`), which would get written directly to the monorepo root folder, cluttering it rather than routing to the correct subprojects (`server/` or `client/`).
**Fix:** Implemented `normalizePathForNiche` which intelligently routes file operations based on niche (e.g. routing `BACKEND` to `server/src/routes/upload.ts` and `FRONTEND` to `client/src/...`) while preserving explicit paths targeting folders.

### IMP-23: Containerized Workspace Sandbox
**Files:** `server/services/sandbox.ts`, `server/index.ts`
**Severity:** 🔴 CRITICAL (Security) — FIXED

**Issue:** Executing user/AI shell commands in a raw host terminal is a severe security vulnerability that could compromise the host machine.
**Fix:** Implemented `sandbox.ts` to coordinate process execution. It automatically queries Docker; if active, commands run within isolated `node:20-alpine` containers restricted to 512MB RAM and 0.5 CPU cores, mounting only the project folder. If Docker is absent, it falls back to a restricted shell guarded by a time-limit and a blacklist of dangerous commands (e.g., `sudo`, `rm -rf /`, `/etc/shadow`).

### IMP-24: Stateless ReAct Tool-Calling Loop & Risk-Tiered Approvals
**Files:** `server/services/toolDefinitions.ts`, `server/services/toolExecutor.ts`, `server/services/orchestrator.ts`, `server/services/codegenOrchestrator.ts`
**Severity:** 🟢 LOW (Feature) — FIXED

**Issue:** The AI specialist was blind to file directory structures, could not execute terminal actions directly, and relied on brittle post-generation regex parsing to guess what dependencies to install.
**Fix:** Created a JSON-schema-based function calling protocol. AI specialists can now request files to be read, directories listed, packages installed, or shell commands executed. The orchestrator processes these statelessly by appending outputs back to context queries. Added a risk-tiered permission gate: "Safe" tools are auto-approved, "Medium" tools request consent with a session auto-allow option, and "Dangerous" tools (shell execution) strictly require manual approval every time.

### IMP-25: Replit-Grade File Explorer and Editor UI Upgrades
**Files:** `client/src/components/CodePanel.tsx`, `client/src/components/ToolApprovalModal.tsx`, `client/src/contexts/ChatContext.tsx`, `client/src/App.tsx`
**Severity:** 🟢 LOW (Feature) — FIXED

**Issue:** The file tree was flat, rendering folder paths recursively with default icons, lacking search capability, multi-tab navigation, or breadcrumbs.
**Fix:** Refactored `CodePanel.tsx` to support collapsible folders, breadcrumbs, search-query tree filtering, type-specific extension file icons, and multi-tab editor layouts. Built `ToolApprovalModal.tsx` to display pending tool requests, complete with interactive param summaries and safety alerts. Added a dirty state dot indicator (●) to tabs and trees to track unsaved editor changes.

### IMP-26: Deletion of Hardcoded Regex Auto-Installer
**File:** `server/services/fileParser.ts`
**Severity:** 🟢 LOW (Feature) — FIXED

**Issue:** The legacy `autoInstallImports` function used brittle regex to scrape JS/TS import statements, which failed for other programming ecosystems (Python, Rust) and was obsolete now that AI specialists manage dependencies directly via the `install_packages` tool.
**Fix:** Removed the obsolete `autoInstallImports` parser, deleting the legacy regex patterns and direct shell invocations from the codebase.

### BUG-27: Code Gen On-Chain Escrow Settlement Skip
**File:** `server/services/codegenOrchestrator.ts`
**Severity:** 🔴 CRITICAL — FIXED

**Issue:** The multi-step code-gen pipeline called specialist LLM endpoints (costing credits) but skipped on-chain escrow locking (`requestTaskOnChain`) and settlement (`settleTaskOnChain`), resulting in fabricated cost values.
**Fix:** Wired on-chain escrow request calls at the beginning of each step in the plan, passing the generated taskId to the specialist, and calling `settleTaskOnChain` with the final signature/hash on successful completions, storing logs correctly in `task-history.json`.

### IMP-28: Server-Side Orchestration Cancellation
**Files:** `server/index.ts`, `server/services/orchestrator.ts`, `server/services/codegenOrchestrator.ts`, `client/src/contexts/ChatContext.tsx`
**Severity:** 🟡 MEDIUM — FIXED

**Issue:** Clicking "Cancel" aborted the client fetch but let the server continue executing background specialist calls, wasting real money.
**Fix:** Created socket-keyed active cancellation sets. When the client aborts, it emits `CANCEL_EXECUTION` over Socket.io, causing both the single-turn and multi-step server orchestrator loops to halt immediately.

### BUG-29: Specialist Node Optimistic Escrow Bypass Exploit
**File:** `specialist-node/src/blockchain.ts`
**Severity:** 🔴 CRITICAL — FIXED

**Issue:** Specialist nodes approved execution optimistically if `status === 0 && providerId === "0"` (solidity default values for uninitialized keys), allowing fake taskId attacks.
**Fix:** Removed the optimistic check entirely to enforce strict on-chain validation for every request.

### BUG-30: Missing /api/balances Endpoint Route
**Files:** `server/index.ts`, `server/services/blockchain.ts`
**Severity:** 🟢 LOW — FIXED

**Issue:** The client SDK called `GET /api/balances`, resulting in a 404 error because the endpoint didn't exist.
**Fix:** Created the route `/api/balances` on the server and added `getUSDCBalance` to `blockchain.ts` to return the real on-chain USDC balances of the orchestrator and all registered models.

### IMP-31: Logging Swallowed Errors in Blockchain/Parser/Registry
**Files:** `server/services/blockchain.ts`, `server/services/fileParser.ts`, `server/services/registry.ts`
**Severity:** 🟢 LOW — FIXED

**Issue:** Empty catch blocks swallowed errors during receipt log parsing, JSON extraction, and registry model queries, hiding critical problems.
**Fix:** Replaced empty catch blocks with structured warning logs (`logger.warn`/`logger.debug`) and wrapped on-chain loops in registry queries with try-catch blocks to prevent RPC failures from crashing lists.

### IMP-32: Registry TTL Caching (RPC Rate Limit Mitigation)
**Files:** `server/services/registry.ts`, `server/index.ts`
**Severity:** 🟡 MEDIUM — FIXED

**Issue:** Sequential on-chain RPC calls were executed on every single user registry query or 60s health check, flooding nodes and triggering rate limits.
**Fix:** Created an in-memory `cachedSpecialistList` with a 30-second TTL. `getAllSpecialists()` and `getSpecialistByNiche()` serve from this cache if valid. The `healthStatus` map in `index.ts` is cloned and frozen on access to prevent concurrent mutation state reads.

### IMP-33: Prompt Sanitizer Layer (Prompt Injection Prevention)
**Files:** `server/services/llm.ts`, `server/services/orchestrator.ts`, `server/services/codegenOrchestrator.ts`
**Severity:** 🟡 MEDIUM — FIXED

**Issue:** Raw user prompts were passed directly to external specialist LLM endpoints, making nodes vulnerable to prompt injection instructions.
**Fix:** Created `sanitizePrompt` in `llm.ts` to strip or escape function tags, chat formats, or ignore-instruction override commands. Sanitized user prompts are passed to intent routers and codegen plans.

### IMP-34: WebSocket Handshake Auth & Balance API Protection
**Files:** `server/index.ts`, `server/services/auth.ts`, `client/src/contexts/ChatContext.tsx`
**Severity:** 🟡 MEDIUM — FIXED

**Issue:** Socket.io and `/api/balances` accepted execution requests and exposed wallets without any API key validation.
**Fix:** Added an authentication handshake middleware checking for the query/header API key in Socket.io, and wrapped `/api/balances` in the `requireApiKey` middleware. Updated the client socket configuration to pass the API key on connect.

### IMP-35: Code Gen Cancellation Finally Cleanup
**File:** `server/services/codegenOrchestrator.ts`
**Severity:** 🟢 LOW — FIXED

**Issue:** If the code generation loop threw an exception, `clearCancellation(socket.id)` was skipped, leaving stale entries in the server set.
**Fix:** Wrapped the main execution loops of `orchestrateCodeGen` in a `try...finally` block that guarantees cancellation cleanup.

### IMP-36: Logging Swallows & Warning Standardizations
**Files:** `server/index.ts`, `server/services/registry.ts`
**Severity:** 🟢 LOW — FIXED

**Issue:** Swallowed errors in `scanDirectory` and custom `console.error` calls reduced network diagnostics visibility.
**Fix:** Added descriptive warning logs to the `scanDirectory` catch block, and migrated all `console.error` calls in `registry.ts` to `logger.error` statements.
