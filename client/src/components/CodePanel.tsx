import { useMemo, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { useChat } from "../contexts/ChatContext";
import { FolderOpen, FileCode2, Plus, Trash2, AlertTriangle } from "lucide-react";

export default function CodePanel() {
  const {
    workspaceFiles,
    activeFilePath,
    setActiveFilePath,
    setWorkspaceFiles,
    handleNewFile,
    handleDeleteFile,
  } = useChat();

  const fileTree = useMemo(() => {
    const root: Record<string, any> = {};
    for (const filePath of Object.keys(workspaceFiles)) {
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
  }, [workspaceFiles]);

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

  const currentContent = activeFilePath ? workspaceFiles[activeFilePath] || "" : "";

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (activeFilePath && value !== undefined) {
      setWorkspaceFiles(prev => ({ ...prev, [activeFilePath]: value }));
    }
  }, [activeFilePath, setWorkspaceFiles]);

  const handleNewFilePrompt = () => {
    const name = prompt("Enter file path (e.g., src/utils/helper.ts):");
    if (name) handleNewFile(name);
  };

  const renderTree = (node: Record<string, any>, basePath: string): JSX.Element[] => {
    return Object.entries(node).map(([key, value]) => {
      const fullPath = basePath ? `${basePath}/${key}` : key;
      if (value === null) {
        const isUnparsed = fullPath.startsWith("_unparsed/");
        return (
          <div
            key={fullPath}
            onClick={() => setActiveFilePath(fullPath)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer rounded-md transition-colors
              ${activeFilePath === fullPath
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : isUnparsed
                  ? "text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/5"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
          >
            {isUnparsed ? <AlertTriangle size={14} className="shrink-0 text-amber-400/70" /> : <FileCode2 size={14} className="shrink-0" />}
            <span className="truncate">{isUnparsed ? key.replace(/\.md$/, '') : key}</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteFile(fullPath); }}
              className="ml-auto opacity-0 hover:opacity-100 text-red-400 hover:text-red-300"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      } else {
        return (
          <div key={fullPath}>
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/40 font-medium">
              <FolderOpen size={14} />
              <span>{key}</span>
            </div>
            <div className="ml-3">
              {renderTree(value, fullPath)}
            </div>
          </div>
        );
      }
    });
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="w-64 shrink-0 border-r border-white/10 bg-black/30 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] font-bold tracking-wider text-white/30 uppercase">
            Files
          </span>
          <button
            onClick={handleNewFilePrompt}
            className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
            title="New file"
          >
            <Plus size={14} />
          </button>
        </div>
        {Object.keys(workspaceFiles).length === 0 ? (
          <div className="text-xs text-white/20 text-center py-8">
            No files yet. Generate code from the chat panel.
          </div>
        ) : (
          <>
            {Object.keys(workspaceFiles).some(p => p.startsWith("_unparsed/")) && (
              <div className="mb-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400/80 leading-relaxed">
                ⚠️ Some files contain raw specialist output (unparsed). Open them to extract code manually.
              </div>
            )}
            {renderTree(fileTree, "")}
          </>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {activeFilePath ? (
          <Editor
            key={activeFilePath}
            height="100%"
            language={getLanguage(activeFilePath)}
            value={currentContent}
            onChange={handleEditorChange}
            theme="vs-dark"
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
              suggestOnTriggerCharacters: false,
              quickSuggestions: false,
            }}
            loading={
              <div className="flex items-center justify-center h-full text-white/40 text-sm">
                Loading editor...
              </div>
            }
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/20 text-sm">
            Select a file from the tree to view its contents
          </div>
        )}
      </div>
    </div>
  );
}
