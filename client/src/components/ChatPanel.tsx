import { useState, useRef, useEffect, FormEvent, useMemo } from "react";
import { Send, Square, ArrowDown, Copy, Check } from "lucide-react";
import { IntentAnalysisMessage } from "./IntentAnalysisMessage";
import { useChat } from "../contexts/ChatContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeBlockRenderer = ({ node, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let lang = match ? match[1].toLowerCase() : '';
  if (lang === 'frontend') lang = 'tsx';
  else if (lang === 'design') lang = 'css';
  else if (lang === 'sql') lang = 'sql';
  else if (lang === 'python') lang = 'python';

  return match ? (
    <div className="rounded-xl overflow-hidden bg-[#0d0d0f] border border-white/5 shadow-xl max-w-full my-5 group/code">
      <div className="bg-white/2 px-4 py-2 text-xs text-white/40 border-b border-white/5 font-mono uppercase tracking-wider flex items-center justify-between">
        <span>{match[1]}</span>
        <button onClick={handleCopy} className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Copy code"}</span>
        </button>
      </div>
      <div className="w-full">
        <SyntaxHighlighter
          {...props}
          style={vscDarkPlus}
          language={lang}
          PreTag="div"
          wrapLines={true}
          wrapLongLines={true}
          lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }}
          customStyle={{ 
            margin: 0, 
            padding: '16px', 
            fontSize: '13px', 
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
            background: 'transparent', 
            width: '100%', 
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    </div>
  ) : (
    <code className="bg-(--color-accent)/15 text-(--color-accent) px-1.5 py-0.5 rounded-md font-mono text-[13px] border border-(--color-accent)/20 wrap-break-word" {...props}>
      {children}
    </code>
  );
};

const MessageCopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-(--color-accent) transition-colors cursor-pointer mt-2 py-1 px-2 rounded-md hover:bg-white/5">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      <span className="font-medium">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
};

const MarkdownComponents = {
  code: CodeBlockRenderer,
  p: ({ children }: any) => <p className="mb-4 last:mb-0 leading-[1.75] text-white/90 whitespace-pre-wrap">{children}</p>,
  h1: ({ children }: any) => <h1 className="text-2xl font-bold mt-8 mb-4 text-white tracking-tight font-sans">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-semibold mt-8 mb-4 text-white tracking-tight font-sans">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-semibold mt-6 mb-3 text-white tracking-tight font-sans">{children}</h3>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-4 space-y-2 text-white/90 marker:text-(--color-accent)">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-white/90 marker:text-(--color-accent)">{children}</ol>,
  li: ({ children }: any) => <li className="leading-[1.75] pl-1">{children}</li>,
  blockquote: ({ children }: any) => <blockquote className="border-l-4 border-(--color-accent) pl-4 py-1 my-5 bg-linear-to-r from-(--color-accent)/10 to-transparent rounded-r-lg italic text-white/80">{children}</blockquote>,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-(--color-accent) hover:underline underline-offset-4 decoration-white/30 hover:decoration-(--color-accent) transition-all font-medium">{children}</a>,
  table: ({ children }: any) => <div className="overflow-x-auto my-6 border border-white/10 rounded-xl"><table className="min-w-full divide-y divide-white/10 text-sm">{children}</table></div>,
  thead: ({ children }: any) => <thead className="bg-[#1a1a1c]">{children}</thead>,
  tbody: ({ children }: any) => <tbody className="divide-y divide-white/10">{children}</tbody>,
  tr: ({ children }: any) => <tr className="hover:bg-white/2 transition-colors">{children}</tr>,
  th: ({ children }: any) => <th className="px-5 py-3.5 text-left font-semibold text-white/90 tracking-wide">{children}</th>,
  td: ({ children }: any) => <td className="px-5 py-3.5 text-white/80">{children}</td>,
  hr: () => <hr className="border-white/10 my-8" />,
  strong: ({ children }: any) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }: any) => <em className="italic text-white/90">{children}</em>,
  pre: ({ children }: any) => <>{children}</>
};

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
    <div className="w-full min-w-0 max-w-full text-[15px]">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={MarkdownComponents as any}
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
  onSendMessage: (promptText: string, maxFee?: number) => void;
  isLoading: boolean;
  executionStep?: string | null;
  currentNiche?: string | null;
  ratingPrompt?: { modelId: string; taskId: string; niche: string } | null;
  onRate?: (score: number) => void;
  onCancel?: () => void;
  pendingIntent?: any;
  onExecutePrompt?: (nicheModels: Record<string, string>, maxFee?: number) => void;
}

export default function ChatPanel({ messages, onSendMessage, isLoading, ratingPrompt, onRate, onCancel, pendingIntent, onExecutePrompt }: ChatPanelProps) {
  const {
    input,
    setInput,
    activeStreamIndex,
    setActiveStreamIndex,
    availableModels,
    selectedModels,
    setSelectedModels
  } = useChat();

  const [maxFee, setMaxFee] = useState<number>(() => {
    return parseFloat(localStorage.getItem("max_fee") || "2.00");
  });
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Listen for cross-component storage updates (like from SettingsModal)
    const handleStorageChange = () => {
      const stored = parseFloat(localStorage.getItem("max_fee") || "2.00");
      setMaxFee((prev) => {
        if (prev !== stored) return stored;
        return prev;
      });
    };
    window.addEventListener("local-storage-update", handleStorageChange);
    return () => window.removeEventListener("local-storage-update", handleStorageChange);
  }, []);

  // Sync maxFee out to localStorage when user changes it from terminal
  useEffect(() => {
    const currentStored = parseFloat(localStorage.getItem("max_fee") || "2.00");
    if (maxFee !== currentStored && !isNaN(maxFee)) {
      localStorage.setItem("max_fee", maxFee.toString());
      window.dispatchEvent(new Event("local-storage-update"));
    }
  }, [maxFee]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 100);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };



  const welcomeMessage = useMemo(() => {
    const messages = [
      "Welcome, Amigo 👋",
      "Ready to build, Commander?",
      "Swarm online. Awaiting orders.",
      "Hello there, Architect.",
      "Systems nominal. What's next?",
      "Greetings, Pioneer.",
      "The Hive is listening..."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, activeStreamIndex]);

  const isExecutionActive = isLoading || activeStreamIndex !== null;

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input, maxFee);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative min-w-0">
      
      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Chat messages"
        className={`chat-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-8 pr-2 space-y-6 scroll-smooth min-w-0 ${messages.length === 0 ? "hidden" : "block"}`}
      >
        {messages.map((m, idx) => (
          <div key={idx} className={`flex w-full group/msg ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
            {m.sender === "user" ? (
              <div className="max-w-[85%] bg-[#1e1e20] text-white border border-white/10 rounded-3xl rounded-br-sm px-5 py-3.5 text-[15px] leading-relaxed shadow-lg whitespace-pre-wrap">
                {m.text}
              </div>
            ) : (
              <div className="max-w-full w-full flex gap-5">
                {/* Assistant Avatar */}
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-(--color-accent) to-(--color-secondary-accent) shrink-0 flex items-center justify-center shadow-lg border border-white/10 mt-0.5">
                   <span className="text-white font-bold text-sm tracking-tighter">H</span>
                </div>
                {/* Assistant Content */}
                <div className="flex-1 min-w-0 flex flex-col items-start max-w-[calc(100%-3rem)]">
                  <div className="font-semibold text-white mb-2 text-[15px]">HiveFi</div>
                  <StreamingMessage 
                    content={m.text} 
                    isTyping={activeStreamIndex === idx}
                    onComplete={() => {
                      if (activeStreamIndex === idx) setActiveStreamIndex(null);
                    }}
                  />
                  {activeStreamIndex !== idx && (
                    <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity">
                      <MessageCopyButton text={m.text} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex w-full justify-start gap-5 animate-in fade-in duration-300">
             <div className="w-8 h-8 rounded-full bg-linear-to-br from-(--color-accent) to-(--color-secondary-accent) shrink-0 flex items-center justify-center shadow-lg border border-white/10 mt-0.5">
                 <span className="text-white font-bold text-sm tracking-tighter">H</span>
              </div>
              <div className="flex-1 min-w-0 flex flex-col items-start gap-3">
                <div className="font-semibold text-white text-[15px]">HiveFi</div>
                <div className="flex items-center gap-1.5 h-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-(--color-accent)/80 animate-bounce [animation-delay:0ms]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-(--color-accent)/80 animate-bounce [animation-delay:150ms]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-(--color-accent)/80 animate-bounce [animation-delay:300ms]"></div>
                </div>
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

        {pendingIntent && onExecutePrompt && !isLoading && (
          <IntentAnalysisMessage
            intent={pendingIntent}
            availableModels={availableModels}
            selectedModels={selectedModels}
            onModelSelect={(niche, modelId) => setSelectedModels(prev => ({ ...prev, [niche]: modelId }))}
            onExecute={() => onExecutePrompt(selectedModels, maxFee)}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to latest messages"
          title="Scroll to latest messages"
          className="absolute bottom-32 right-1/2 translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium rounded-full hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-[#131314] transition-all shadow-lg z-50 animate-fade-in"
        >
          <ArrowDown size={18} aria-hidden="true" />
          <span>Latest</span>
        </button>
      )}

      {/* Input Area (Centered if empty, Bottom Fixed if active) */}
      <div className={`w-full max-w-4xl 2xl:max-w-5xl mx-auto transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] relative ${messages.length === 0 ? "flex-1 flex flex-col justify-center px-4 md:px-8" : "p-4 md:px-8 mt-auto"}`}>
        
        {messages.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[150px] w-full px-4">
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-transparent bg-clip-text bg-linear-to-r from-white via-white/80 to-white/40 text-center pb-2 drop-shadow-sm">
              {welcomeMessage}
            </h1>
          </div>
        )}
        
        {/* Delegation Strategy Indicator */}
        {localStorage.getItem("delegation_mode") === "manual" && (
          <div className="mb-3 px-4 flex items-center justify-end">
            <div className="relative group">
              <select
                value={localStorage.getItem("manual_model_id") || ""}
                onChange={(e) => {
                  localStorage.setItem("manual_model_id", e.target.value);
                  // force re-render Hack
                  setInput(input + " "); setTimeout(() => setInput(input), 0);
                }}
                className="bg-[#18181b] border border-white/10 rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 appearance-none cursor-pointer transition-all hover:border-white/30"
              >
                <option value="" disabled className="bg-[#121214]">Select a model...</option>
                {availableModels.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#121214]">{m.name} ({m.niche}) - {m.pricePerQuery} USDC</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--color-accent)] group-hover:text-white transition-colors">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-3 relative group w-full">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-[#18181b] border border-white/10 rounded-2xl px-6 py-4 pr-16 text-base text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all resize-none overflow-y-auto min-h-[60px] max-h-[200px] scrollbar-none [&::-webkit-scrollbar]:hidden"
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
            aria-label={isExecutionActive ? "Stop response" : "Send message"}
            title={isExecutionActive ? "Stop response" : "Send message"}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
              isExecutionActive 
                ? "bg-white/10 text-white hover:bg-red-500/80 cursor-pointer" 
                : !input.trim() 
                  ? "bg-white/5 text-white/30 cursor-not-allowed" 
                  : "bg-white text-black hover:bg-white/90 cursor-pointer shadow-sm"
            }`}
            disabled={!isExecutionActive && !input.trim()}
          >
            {isExecutionActive ? (
              <Square size={18} className="fill-current" />
            ) : (
              <Send size={18} className={input.trim() ? "translate-x-0.5" : ""} />
            )}
          </button>
        </form>
        <div className="flex items-center justify-between mt-3 px-4">
          <div className="flex items-center gap-2 text-xs text-white/40 font-medium hover:text-white/70 transition-colors group/fee">
            <span>Max Fee:</span>
            <div className="flex items-center gap-1 bg-black/20 rounded-md px-1 py-0.5 border border-white/5 group-hover/fee:border-white/20 transition-colors">
              <button 
                type="button"
                onClick={() => setMaxFee(prev => Math.max(0.001, parseFloat((prev - 0.01).toFixed(3))))}
                className="text-white/40 hover:text-(--color-accent) hover:bg-(--color-accent)/10 w-5 h-5 flex items-center justify-center rounded transition-colors pb-0.5"
              >-</button>
              <input 
                type="number" 
                step="0.001" min="0.001" max="50" value={maxFee}
                size={Math.max(4, maxFee.toString().length + 1)}
                onChange={(e) => setMaxFee(parseFloat(e.target.value) || 0)}
                onBlur={(e) => setMaxFee(Math.min(50, Math.max(0.001, parseFloat(e.target.value) || 0.001)))}
                className="fee-input bg-transparent text-white text-center outline-none font-mono [appearance:textfield] min-w-[32px] max-w-[100px]"
              />
              <button 
                type="button"
                onClick={() => setMaxFee(prev => parseFloat((prev + 0.01).toFixed(3)))}
                className="text-white/40 hover:text-(--color-accent) hover:bg-(--color-accent)/10 w-5 h-5 flex items-center justify-center rounded transition-colors pb-0.5"
              >+</button>
            </div>
            <span>USDC</span>
          </div>
          <div className="text-xs text-white/30 font-medium">
            HiveFi Orchestrator may make mistakes. Verify transactions.
          </div>
        </div>


      </div>
    </div>
  );
}
