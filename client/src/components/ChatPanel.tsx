import { useState, useRef, useEffect, FormEvent } from "react";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function StreamingMessage({ content, isTyping, onComplete }: { content: string, isTyping?: boolean, onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (isTyping === false) {
      setDisplayed(content);
      return;
    }
    const interval = setInterval(() => {
      setDisplayed((prev) => {
        if (prev.length < content.length) {
          return content.slice(0, prev.length + 1);
        }
        clearInterval(interval);
        if (onComplete) onComplete();
        return prev;
      });
    }, 15);
    return () => clearInterval(interval);
  }, [content, isTyping, onComplete]);

  return (
    <div className="markdown-prose space-y-2 text-sm break-words min-w-0 max-w-full overflow-hidden">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({node, className, children, ...props}: any) => {
            const match = /language-(\w+)/.exec(className || '')
            return match ? (
              <div className="rounded-md overflow-hidden my-3 border border-white/10 shadow-lg max-w-full">
                <div className="bg-[#1e1e1e] px-4 py-1.5 text-xs text-white/50 border-b border-white/5 font-mono uppercase tracking-wider flex items-center justify-between">
                  <span>{match[1]}</span>
                </div>
                <div className="overflow-x-auto max-w-full">
                  <SyntaxHighlighter
                    {...props}
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: '16px', fontSize: '13px', background: '#0a0a0c', minWidth: '100%' }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              <code className="bg-black/40 px-1.5 py-0.5 rounded text-[#a78bfa] font-mono text-[13px] break-all" {...props}>
                {children}
              </code>
            )
          }
        }}
      >
        {displayed}
      </ReactMarkdown>
    </div>
  );
}

interface Message {
  sender: "user" | "assistant";
  text: string;
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (promptText: string) => void;
  isLoading: boolean;
  ratingPrompt?: { modelId: string; taskId: string; niche: string } | null;
  onRate?: (score: number) => void;
  onCancel?: () => void;
}

export default function ChatPanel({ messages, onSendMessage, isLoading, ratingPrompt, onRate, onCancel }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [activeStreamIndex, setActiveStreamIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, activeStreamIndex]);

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].sender === "assistant") {
      setActiveStreamIndex(messages.length - 1);
    } else {
      setActiveStreamIndex(null);
    }
  }, [messages.length]);

  const isExecutionActive = isLoading || activeStreamIndex !== null;

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const [welcomeMessage, setWelcomeMessage] = useState("What's next?");
  
  useEffect(() => {
    const messages = [
      "Welcome, Amigo 👋",
      "Ready to build, Commander?",
      "Swarm online. Awaiting orders.",
      "Hello there, Architect.",
      "Systems nominal. What's next?",
      "Greetings, Pioneer.",
      "The Hive is listening..."
    ];
    setWelcomeMessage(messages[Math.floor(Math.random() * messages.length)]);
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative min-w-0">
      
      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto px-4 py-8 space-y-6 scroll-smooth min-w-0 ${messages.length === 0 ? "hidden" : "block"}`}>
        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
            <span className="text-[10px] font-mono text-[#666] mb-1.5 uppercase">
              {m.sender === "user" ? "User" : "System"}
            </span>
            <div
              className={`max-w-[85%] min-w-0 overflow-hidden p-3 text-sm leading-relaxed ${
                m.sender === "user"
                  ? "bg-white/10 text-white shadow-md border border-white/10 rounded-2xl rounded-br-sm"
                  : "bg-gradient-to-r from-[var(--color-accent)]/10 to-transparent border-l-2 border-l-[var(--color-accent)] border-y border-y-white/5 border-r border-r-white/5 text-[var(--color-text-primary)] rounded-r-lg"
              }`}
            >
              {m.sender === "assistant" ? (
                <StreamingMessage 
                  content={m.text} 
                  isTyping={activeStreamIndex === idx}
                  onComplete={() => {
                    if (activeStreamIndex === idx) setActiveStreamIndex(null);
                  }}
                />
              ) : (
                <div className="whitespace-pre-wrap">{m.text}</div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-mono text-[#666] mb-1.5 uppercase">System</span>
            <div className="w-48 p-3 rounded-md bg-[#111] border border-[#222] space-y-2">
              <div className="h-1.5 bg-[#333] animate-shimmer rounded-full w-full"></div>
              <div className="h-1.5 bg-[#333] animate-shimmer rounded-full w-3/4"></div>
            </div>
          </div>
        )}

        {ratingPrompt && onRate && !isLoading && (
          <div className="flex flex-col items-center justify-center p-4 mt-4 border border-white/10 bg-white/5 rounded-xl">
            <span className="text-[10px] text-[#888] mb-3 uppercase tracking-wider font-semibold">
              Rate {ratingPrompt.niche} Specialist
            </span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(score => (
                <button
                  key={score}
                  onClick={() => onRate(score)}
                  className="w-8 h-8 flex items-center justify-center rounded bg-black/40 border border-white/20 hover:bg-white hover:text-black transition-colors text-xs font-bold text-white"
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Empty State / Center Screen */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-20">
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-12 text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40 text-center pb-2">
            {welcomeMessage}
          </h1>
        </div>
      )}

      {/* Input Area (Bottom Fixed or Centered if empty) */}
      <div className={`p-4 w-full max-w-3xl mx-auto transition-all duration-500 ease-in-out ${messages.length === 0 ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-10" : ""}`}>
        <form onSubmit={handleSubmit} className="flex gap-3 relative group w-full">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-[#1a1a1c]/80 backdrop-blur-xl border border-white/10 rounded-3xl px-8 py-5 pr-16 text-base text-white placeholder-white/40 focus:outline-none focus:border-[var(--color-accent)]/50 focus:ring-1 focus:ring-[var(--color-accent)]/50 focus:shadow-[0_0_30px_rgba(139,92,246,0.15)] transition-all shadow-[0_4px_20px_rgba(0,0,0,0.5)] resize-none overflow-y-auto min-h-[64px] max-h-[200px]"
            placeholder="Enter command..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={1}
            disabled={isLoading}
          />
          <button
            type={isExecutionActive ? "button" : "submit"}
            onClick={() => {
              if (isExecutionActive) {
                if (isLoading && onCancel) onCancel();
                if (activeStreamIndex !== null) setActiveStreamIndex(null);
              }
            }}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all duration-300 flex items-center justify-center ${
              isExecutionActive 
                ? "bg-white/10 text-white hover:bg-red-500/80 cursor-pointer" 
                : !input.trim() 
                  ? "bg-white/5 text-white/30 cursor-not-allowed" 
                  : "bg-[var(--color-accent)] text-white hover:scale-105 cursor-pointer shadow-[0_0_15px_var(--color-accent)]"
            }`}
            disabled={!isExecutionActive && !input.trim()}
          >
            {isExecutionActive ? (
              <div className="w-3.5 h-3.5 bg-white rounded-[2px]" />
            ) : (
              <Send size={18} className={input.trim() ? "translate-x-0.5" : ""} />
            )}
          </button>
        </form>
        <div className="text-center mt-3 text-xs text-white/50 font-medium">
          HiveFi Swarm Orchestrator may make mistakes. Verify critical actions.
        </div>
      </div>
    </div>
  );
}
