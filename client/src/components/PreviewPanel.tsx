import { useMemo, useState, lazy, Suspense } from "react";
import { useChat } from "../contexts/ChatContext";

const SandpackReact = lazy(() =>
  import("@codesandbox/sandpack-react").then(m => ({
    default: ({ files, template, options, ...props }: any) => (
      <m.SandpackProvider files={files} template={template} options={options}>
        <m.SandpackLayout {...props}>
          <m.SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={true}
            showNavigator={true}
          />
        </m.SandpackLayout>
      </m.SandpackProvider>
    ),
  }))
);

export default function PreviewPanel() {
  const { workspaceFiles } = useChat();
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewMode, setPreviewMode] = useState<"frontend" | "backend">("frontend");

  const sandpackFiles = useMemo(() => {
    const files: Record<string, { code: string }> = {};
    for (const [path, content] of Object.entries(workspaceFiles)) {
      if (path.startsWith("server/") || path.startsWith("api/")) continue;
      files["/" + path] = { code: content };
    }
    return files;
  }, [workspaceFiles]);

  const sandpackTemplate = useMemo(() => {
    if (sandpackFiles["/app.tsx"] || sandpackFiles["/src/app.tsx"]) return "react-ts" as const;
    if (sandpackFiles["/index.html"] && !sandpackFiles["/app.tsx"]) return "static" as const;
    return "react-ts" as const;
  }, [sandpackFiles]);

  const hasFrontendFiles = Object.keys(sandpackFiles).length > 0;
  const hasBackendFiles = useMemo(() => {
    return Object.keys(workspaceFiles).some(f =>
      f.startsWith("server/") || f.startsWith("api/") || f.endsWith(".py")
    );
  }, [workspaceFiles]);

  const viewportWidths = { desktop: "100%", tablet: "768px", mobile: "375px" };

  if (!hasFrontendFiles && !hasBackendFiles) {
    return (
      <div className="flex items-center justify-center h-full text-white/20 text-sm">
        No frontend or backend files to preview.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/20 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setPreviewMode("frontend")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              previewMode === "frontend" ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]" : "text-white/40 hover:text-white"
            }`}
            disabled={!hasFrontendFiles}
          >Frontend</button>
          <button onClick={() => setPreviewMode("backend")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              previewMode === "backend" ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]" : "text-white/40 hover:text-white"
            }`}
            disabled={!hasBackendFiles}
          >Backend API</button>
        </div>
        <div className="flex items-center gap-1">
          {(["desktop", "tablet", "mobile"] as const).map(v => (
            <button key={v} onClick={() => setViewport(v)}
              className={`px-2 py-1 text-[10px] rounded transition-colors uppercase tracking-wider ${
                viewport === v ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
              }`}
            >{v[0]}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-start justify-center overflow-auto bg-[#0a0a0a] p-4">
        {previewMode === "frontend" && hasFrontendFiles ? (
          <div className="border border-white/10 rounded-lg overflow-hidden transition-all duration-300 w-full h-full"
            style={{ maxWidth: viewportWidths[viewport] }}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-full text-white/40 text-sm p-12">
                Loading preview sandbox...
              </div>
            }>
              <SandpackReact
                files={sandpackFiles}
                template={sandpackTemplate}
                options={{
                  layout: "preview",
                  editorHeight: "100%",
                  showTabs: false,
                  showNavigator: true,
                  resizablePanels: false,
                  initMode: "lazy",
                  externalResources: [
                    "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css",
                  ],
                }}
                customSetup={{
                  dependencies: {
                    "lucide-react": "latest",
                    "recharts": "latest",
                    "canvas-confetti": "latest",
                    "react-router-dom": "latest",
                    "react": "^18.0.0",
                    "react-dom": "^18.0.0",
                  },
                }}
              />
            </Suspense>
          </div>
        ) : previewMode === "backend" ? (
          <div className="w-full max-w-2xl text-sm text-white/60 font-mono p-6 overflow-y-auto h-full">
            <div className="text-[var(--color-accent)] font-bold mb-4">// Backend API Routes</div>
            {Object.entries(workspaceFiles)
              .filter(([path]) => path.startsWith("server/") || path.startsWith("api/"))
              .map(([path, content]) => (
                <div key={path} className="mb-6">
                  <div className="text-white/40 text-xs mb-2">{path}</div>
                  <pre className="bg-black/40 border border-white/5 rounded-lg p-4 overflow-x-auto text-[12px] leading-relaxed max-h-[400px] overflow-y-auto">
                    {content.slice(0, 2000)}
                    {content.length > 2000 ? "\n\n// ... truncated ..." : ""}
                  </pre>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-white/20 text-sm">No content to preview</div>
        )}
      </div>
    </div>
  );
}
