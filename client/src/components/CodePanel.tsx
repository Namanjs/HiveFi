import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { useChat } from "../contexts/ChatContext";
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileText, 
  Database, 
  Lock, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Edit3, 
  X, 
  Terminal, 
  Search 
} from "lucide-react";

export default function CodePanel() {
  const {
    workspaceFiles,
    activeFilePath,
    setActiveFilePath,
    setWorkspaceFiles,
    handleNewFile,
    handleDeleteFile,
    handleRenameFile,
    socket,
  } = useChat() as any;

  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  
  // Folder tree collapse/expand states
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Editor Tabs and Dirty state
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());

  // Terminal States
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<{ text: string; isError?: boolean }[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs, isTerminalOpen]);

  // Connect socket listeners for terminal outputs
  useEffect(() => {
    if (!socket) return;

    const handleOutput = (data: { text: string; isError?: boolean }) => {
      setTerminalLogs(prev => [...prev, { text: data.text, isError: data.isError }]);
    };

    const handleExit = (data: { code: number }) => {
      setTerminalLogs(prev => [...prev, { text: `\nProcess exited with code ${data.code}\n` }]);
      setIsExecuting(false);
    };

    socket.on("TERMINAL_OUTPUT", handleOutput);
    socket.on("TERMINAL_EXIT", handleExit);

    return () => {
      socket.off("TERMINAL_OUTPUT", handleOutput);
      socket.off("TERMINAL_EXIT", handleExit);
    };
  }, [socket]);

  // Expand top levels of folders automatically on load
  useEffect(() => {
    if (Object.keys(workspaceFiles).length > 0 && expandedFolders.size === 0) {
      const initial = new Set<string>();
      for (const pathKey of Object.keys(workspaceFiles)) {
        const parts = pathKey.split("/");
        if (parts.length > 1) {
          initial.add(parts[0]);
          if (parts.length > 2) {
            initial.add(`${parts[0]}/${parts[1]}`);
          }
        }
      }
      setExpandedFolders(initial);
    }
  }, [workspaceFiles]);

  // Track active file path inside open tabs list
  useEffect(() => {
    if (activeFilePath && !openTabs.includes(activeFilePath)) {
      setOpenTabs(prev => [...prev, activeFilePath]);
    }
  }, [activeFilePath, openTabs]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleCloseTab = (tabPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const index = openTabs.indexOf(tabPath);
    const nextTabs = openTabs.filter(t => t !== tabPath);
    setOpenTabs(nextTabs);
    
    if (activeFilePath === tabPath) {
      if (nextTabs.length > 0) {
        const nextActive = nextTabs[Math.max(0, index - 1)];
        setActiveFilePath(nextActive);
      } else {
        setActiveFilePath(null);
      }
    }
  };

  const handleExecuteCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commandInput.trim();
    if (!trimmed) return;

    if (!socket) {
      setTerminalLogs(prev => [...prev, { text: "Error: Socket connection offline\n", isError: true }]);
      return;
    }

    setTerminalLogs(prev => [...prev, { text: `hivefi-workspace $ ${trimmed}\n` }]);
    setIsExecuting(true);
    socket.emit("EXECUTE_COMMAND", { command: trimmed });
    setCommandInput("");
  };

  const fileTree = useMemo(() => {
    const root: Record<string, any> = {};
    const query = searchQuery.trim().toLowerCase();
    
    for (const filePath of Object.keys(workspaceFiles)) {
      if (query && !filePath.toLowerCase().includes(query)) {
        continue;
      }
      
      const parts = filePath.split("/");
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = null;
        } else {
          if (!current[part]) current[part] = {};
          if (typeof current[part] === "object") {
            current = current[part];
          } else {
            break;
          }
        }
      }
    }
    return root;
  }, [workspaceFiles, searchQuery]);

  const getLanguage = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      html: "html", htm: "html", css: "css", scss: "scss", json: "json",
      md: "markdown", py: "python", sql: "sql", yaml: "yaml", yml: "yaml",
      xml: "xml", svg: "xml", env: "dotenv", sh: "shell", bash: "shell",
    };
    return map[ext || ""] || "plaintext";
  };

  const getFileIcon = (filePath: string) => {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const filename = filePath.split("/").pop() || "";
    
    if (filename === ".env" || filename.startsWith(".env.")) {
      return <Lock size={13} className="shrink-0 text-amber-500/80" />;
    }
    if (ext === "json") {
      return <FileCode size={13} className="shrink-0 text-emerald-400" />;
    }
    if (ext === "ts" || ext === "tsx") {
      return <FileCode size={13} className="shrink-0 text-blue-400" />;
    }
    if (ext === "js" || ext === "jsx") {
      return <FileCode size={13} className="shrink-0 text-yellow-400" />;
    }
    if (ext === "css" || ext === "scss") {
      return <FileText size={13} className="shrink-0 text-purple-400" />;
    }
    if (ext === "html") {
      return <FileText size={13} className="shrink-0 text-orange-400" />;
    }
    if (ext === "sql") {
      return <Database size={13} className="shrink-0 text-cyan-400" />;
    }
    if (ext === "md") {
      return <FileText size={13} className="shrink-0 text-sky-400" />;
    }
    return <File size={13} className="shrink-0 text-white/50" />;
  };

  const currentContent = activeFilePath ? workspaceFiles[activeFilePath] || "" : "";

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (activeFilePath && value !== undefined) {
      setWorkspaceFiles((prev: any) => ({ ...prev, [activeFilePath]: value }));
      
      // Add file to dirty state
      setDirtyFiles(prev => {
        const next = new Set(prev);
        next.add(activeFilePath);
        return next;
      });

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
        fetch(`${API_BASE}/api/files/write`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_API_KEY || ""
          },
          body: JSON.stringify({ filePath: activeFilePath, content: value })
        })
        .then(() => {
          // Remove from dirty files list
          setDirtyFiles(prev => {
            const next = new Set(prev);
            next.delete(activeFilePath);
            return next;
          });
        })
        .catch(err => console.error("Error writing file change to disk:", err));
      }, 800);
    }
  }, [activeFilePath, setWorkspaceFiles]);

  const handleCreateFile = () => {
    const trimmed = newFilePath.trim();
    if (trimmed) {
      handleNewFile(trimmed);
      setNewFilePath("");
      setIsModalOpen(false);
    }
  };

  const handleRenameSubmit = (oldPath: string) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== oldPath.split("/").pop()) {
      const dirParts = oldPath.split("/");
      dirParts.pop();
      const newPath = dirParts.length > 0 ? `${dirParts.join("/")}/${trimmed}` : trimmed;
      handleRenameFile(oldPath, newPath);
      
      // Update open tabs list with renamed path
      setOpenTabs(prev => prev.map(tab => tab === oldPath ? newPath : tab));
      
      if (activeFilePath === oldPath) {
        setActiveFilePath(newPath);
      }
    }
    setEditingPath(null);
  };

  const renderTree = (node: Record<string, any>, basePath: string): React.ReactNode[] => {
    // Sort directories first, then files alphabetically
    const sortedEntries = Object.entries(node).sort(([keyA, valA], [keyB, valB]) => {
      const isDirA = valA !== null;
      const isDirB = valB !== null;
      if (isDirA && !isDirB) return -1;
      if (!isDirA && isDirB) return 1;
      return keyA.localeCompare(keyB);
    });

    return sortedEntries.map(([key, value]) => {
      const fullPath = basePath ? `${basePath}/${key}` : key;
      if (value === null) {
        const isUnparsed = fullPath.startsWith("_unparsed/");
        const isEditing = editingPath === fullPath;
        const isDirty = dirtyFiles.has(fullPath);

        return (
          <div
            key={fullPath}
            onClick={() => { if (!isEditing) setActiveFilePath(fullPath); }}
            className={`group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer rounded-md transition-colors
              ${activeFilePath === fullPath
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-medium"
                : isUnparsed
                  ? "text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/5"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
          >
            {isUnparsed ? (
              <AlertTriangle size={13} className="shrink-0 text-amber-400/70" />
            ) : (
              getFileIcon(fullPath)
            )}

            {isEditing ? (
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => handleRenameSubmit(fullPath)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit(fullPath);
                  if (e.key === "Escape") setEditingPath(null);
                }}
                className="bg-black/60 border border-white/20 text-white text-xs px-2 py-0.5 rounded focus:outline-none focus:border-[var(--color-accent)] w-full min-w-0"
                autoFocus
              />
            ) : (
              <>
                <span className="truncate flex-1">
                  {isUnparsed ? key.replace(/\.md$/, '') : key}
                </span>
                
                {/* Dirty state dot */}
                {isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shrink-0 opacity-80" />
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPath(fullPath);
                      setRenameValue(key);
                    }}
                    className="text-white/40 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors"
                    title="Rename"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(fullPath);
                    }}
                    className="text-red-400/70 hover:text-red-400 p-0.5 rounded hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      } else {
        const isFolderExpanded = expandedFolders.has(fullPath);

        return (
          <div key={fullPath}>
            <div 
              onClick={() => toggleFolder(fullPath)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/50 font-medium hover:text-white hover:bg-white/5 rounded-md cursor-pointer select-none"
            >
              {isFolderExpanded ? (
                <ChevronDown size={14} className="shrink-0 text-white/30" />
              ) : (
                <ChevronRight size={14} className="shrink-0 text-white/30" />
              )}
              {isFolderExpanded ? (
                <FolderOpen size={13} className="shrink-0 text-[var(--color-accent)]/80" />
              ) : (
                <Folder size={13} className="shrink-0 text-white/40" />
              )}
              <span className="truncate">{key}</span>
            </div>
            {isFolderExpanded && (
              <div className="ml-3 border-l border-white/5 pl-1.5">
                {renderTree(value, fullPath)}
              </div>
            )}
          </div>
        );
      }
    });
  };

  return (
    <div className="flex h-full min-h-0 relative select-none w-full">
      {/* File Tree Panel */}
      <div className="w-64 shrink-0 border-r border-white/10 bg-black/25 flex flex-col h-full">
        
        {/* Title and search bar container */}
        <div className="p-3 border-b border-white/5 bg-black/10 shrink-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] font-bold tracking-wider text-white/30 uppercase font-sans">
              Files
            </span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
              title="New file"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Search box */}
          <div className="relative flex items-center bg-black/40 border border-white/10 rounded-md">
            <Search size={12} className="absolute left-2.5 text-white/20" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-transparent border-none text-white text-xs pl-8 pr-2 py-1.5 focus:outline-none focus:ring-0 placeholder-white/20 font-sans"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-white/40 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Tree Render Scroll Area */}
        <div className="flex-1 overflow-y-auto p-2">
          {Object.keys(workspaceFiles).length === 0 ? (
            <div className="text-xs text-white/20 text-center py-8">
              No files yet. Generate code from the chat panel.
            </div>
          ) : (
            <>
              {Object.keys(workspaceFiles).some(p => p.startsWith("_unparsed/")) && (
                <div className="mb-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400/80 leading-relaxed font-sans">
                  ⚠️ Some files contain raw specialist output (unparsed). Open them to extract code manually.
                </div>
              )}
              {renderTree(fileTree, "")}
            </>
          )}
        </div>
      </div>

      {/* Editor & Collapsible Terminal Container */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-[#1e1e1e]">
        
        {/* Editor Tabs Bar */}
        {openTabs.length > 0 && (
          <div className="flex items-center bg-[#151516] border-b border-white/5 overflow-x-auto shrink-0 select-none scrollbar-none">
            {openTabs.map((tabPath) => {
              const filename = tabPath.split("/").pop() || "";
              const isActive = activeFilePath === tabPath;
              const isDirty = dirtyFiles.has(tabPath);
              return (
                <div
                  key={tabPath}
                  onClick={() => setActiveFilePath(tabPath)}
                  className={`group flex items-center gap-2 px-4 py-2 text-xs border-r border-white/5 cursor-pointer font-sans transition-all
                    ${isActive 
                      ? "bg-[#1e1e1e] text-white font-medium border-t-2 border-t-[var(--color-accent)]" 
                      : "text-white/40 hover:text-white/80 bg-black/10"
                    }`}
                >
                  {getFileIcon(tabPath)}
                  <span className="truncate max-w-[120px]">{filename}</span>
                  
                  {/* Close or Dirty Dot */}
                  {isDirty ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] block group-hover:hidden shrink-0" />
                  ) : null}
                  <button
                    onClick={(e) => handleCloseTab(tabPath, e)}
                    className={`${isDirty ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100"} hover:bg-white/10 rounded p-0.5 transition-all text-white/40 hover:text-white shrink-0`}
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Path Breadcrumbs */}
        {activeFilePath && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-[#141415] text-[10px] text-white/40 font-mono shrink-0 select-none">
            {activeFilePath.split("/").map((part: string, i: number, arr: string[]) => {
              const isLast = i === arr.length - 1;
              const segmentPath = arr.slice(0, i + 1).join("/");
              return (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-white/10">/</span>}
                  <span 
                    onClick={() => !isLast && setActiveFilePath(segmentPath)}
                    className={`hover:text-white transition-colors cursor-pointer ${isLast ? "text-white/60 font-semibold" : ""}`}
                  >
                    {part}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Monaco Editor Panel */}
        <div className="flex-1 min-h-0 relative">
          {activeFilePath ? (
            <Editor
              key={activeFilePath}
              height="100%"
              language={getLanguage(activeFilePath)}
              value={currentContent}
              onChange={handleEditorChange}
              theme="vs-dark"
              onMount={(_, monaco) => {
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                  noSemanticValidation: true,
                  noSyntaxValidation: false,
                });
                monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                  noSemanticValidation: true,
                  noSyntaxValidation: false,
                });
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 16 },
                renderWhitespace: "selection",
                bracketPairColorization: { enabled: true },
                suggestOnTriggerCharacters: true,
                quickSuggestions: { other: true, comments: false, strings: false },
              }}
              loading={
                <div className="flex items-center justify-center h-full text-white/40 text-sm">
                  Loading editor...
                </div>
              }
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white/20 text-sm font-sans">
              Select a file from the tree to view its contents
            </div>
          )}
        </div>

        {/* Collapsible terminal drawer */}
        <div className={`border-t border-white/10 flex flex-col transition-all bg-[#0a0a0b] font-mono text-[11px] ${
          isTerminalOpen ? "h-64" : "h-8"
        }`}>
          {/* Terminal Title Bar */}
          <div 
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className="flex items-center justify-between px-4 py-2 border-b border-white/5 cursor-pointer bg-black/40 hover:bg-black/60 transition-colors shrink-0"
          >
            <div className="flex items-center gap-2 font-semibold text-[10px] tracking-wider text-white/40 uppercase font-sans">
              <Terminal size={12} className={isExecuting ? "text-[var(--color-accent)] animate-pulse" : "text-white/40"} />
              Terminal
              {isExecuting && <span className="lowercase text-white/20 font-light">(running...)</span>}
            </div>
            <div className="flex items-center gap-3 font-sans">
              {isTerminalOpen && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTerminalLogs([]);
                  }}
                  className="text-[10px] text-white/40 hover:text-white hover:underline transition-all"
                >
                  Clear Logs
                </button>
              )}
              <span className="text-white/40 text-[10px]">
                {isTerminalOpen ? "Collapse" : "Expand"}
              </span>
            </div>
          </div>

          {/* Terminal Console Output & Input Area */}
          {isTerminalOpen && (
            <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-none font-mono text-white/80 leading-relaxed whitespace-pre-wrap select-text">
                {terminalLogs.length === 0 ? (
                  <div className="text-white/20 italic">Terminal ready. Run bash commands relative to the project root.</div>
                ) : (
                  terminalLogs.map((log, i) => (
                    <div key={i} className={log.isError ? "text-red-400" : "text-white/80"}>
                      {log.text}
                    </div>
                  ))
                )}
                <div ref={terminalEndRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleExecuteCommand} className="flex items-center gap-2 border-t border-white/5 pt-2 mt-2 shrink-0">
                <span className="text-[var(--color-accent)] shrink-0 select-none">hivefi-workspace $</span>
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  disabled={isExecuting}
                  className="flex-1 bg-transparent border-none outline-none text-white focus:ring-0 focus:outline-none py-0 px-1 font-mono text-[11px]"
                  placeholder={isExecuting ? "Executing process... Please wait." : "Type command and press Enter..."}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Premium Glassmorphic New File Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] transition-all">
          <div className="w-[400px] border border-white/10 bg-[#161616]/95 backdrop-blur-md rounded-xl p-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
            <h3 className="text-sm font-semibold text-white mb-1 font-sans">Create New File</h3>
            <p className="text-[11px] text-white/40 mb-4 font-sans">
              Enter a file path. Nested directories will be created automatically.
            </p>

            <input
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="e.g., src/utils/formatter.ts"
              className="w-full bg-black/40 border border-white/10 rounded-lg text-white text-xs px-3 py-2.5 mb-4 focus:outline-none focus:border-[var(--color-accent)] placeholder-white/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFile();
              }}
              autoFocus
            />

            <div className="flex justify-end gap-2 text-xs font-sans">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                className="px-4 py-2 bg-[var(--color-accent)] text-black font-semibold rounded-lg hover:brightness-110 transition-all shadow-md shadow-[var(--color-accent)]/10"
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
