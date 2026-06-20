import { Link, useLocation } from "react-router-dom";
import { Terminal, Cpu, FileText, Rocket, ChevronLeft, ChevronRight, Settings, Menu, Hexagon } from "lucide-react";
import { useState, useEffect } from "react";
import HowSwarmWorksModal from "./HowSwarmWorksModal";

export default function NavBar() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    const handleOpenModal = () => setShowHowItWorks(true);
    window.addEventListener('open-how-swarm-works', handleOpenModal);
    return () => window.removeEventListener('open-how-swarm-works', handleOpenModal);
  }, []);

  const navItem = (path: string, label: string, Icon: any) => {
    const isActive = location.pathname === path;
    return (
      <Link
        to={path}
        onClick={() => setIsMobileOpen(false)}
        className={`flex items-center px-4 py-3 text-sm font-medium transition-all duration-500 smooth-spring rounded-xl ${
          isActive ? "bg-white/10 text-white" : "text-[#888] hover:bg-white/5 hover:text-white"
        } ${isCollapsed ? "justify-center px-0" : ""}`}
        data-tooltip={isCollapsed ? label : undefined}
      >
        <Icon size={18} className="shrink-0" />
        <span className={`transition-all duration-500 smooth-spring whitespace-nowrap overflow-hidden ${isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"}`}>
          {label}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Hamburger Toggle (Visible only when mobile nav is closed) */}
      <button 
        className="md:hidden fixed top-4 left-4 z-[90] p-2 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-xl text-white"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-[95] backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <nav className={`flex flex-col h-full py-6 border-r border-white/5 bg-black/80 md:bg-black/20 backdrop-blur-3xl shrink-0 transition-all duration-500 smooth-spring fixed md:relative z-[100] ${
        !isMobileOpen ? "-translate-x-full md:translate-x-0" : "translate-x-0"
      } ${isCollapsed ? "w-20 items-center px-2" : "w-64 px-4"}`}>
        
        <button 
          onClick={() => {
            if (window.innerWidth < 768) {
              setIsMobileOpen(false);
            } else {
              setIsCollapsed(!isCollapsed);
            }
          }}
          className="absolute -right-4 top-6 flex items-center justify-center w-8 h-8 bg-[#1a1a1c] border border-white/10 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors z-50 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className={`flex items-center mb-10 transition-all duration-500 smooth-spring ${isCollapsed ? "justify-center w-full px-0 gap-0" : "px-2 gap-3"}`}>
        <div className="w-8 h-8 bg-[var(--color-accent)] text-white font-bold flex items-center justify-center rounded-xl shadow-[0_0_15px_var(--color-accent-glow)] shrink-0">
          H
        </div>
        <span className={`font-bold tracking-[0.2em] uppercase text-sm text-white whitespace-nowrap overflow-hidden transition-all duration-500 smooth-spring ${isCollapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"}`}>
          HiveFi
        </span>
      </div>
      
      <div className={`flex flex-col gap-2 flex-1 w-full`}>
        {navItem("/", "Chat", Terminal)}
        {navItem("/specialists", "Specialists", Cpu)}
        {navItem("/transactions", "Transactions", FileText)}
        {navItem("/deploy", "Deploy", Rocket)}
        {navItem("/settings", "Settings", Settings)}
      </div>

      {/* Status Footer */}
      <div className={`mt-auto pt-6 border-t border-white/5 flex flex-col gap-5 ${isCollapsed ? 'items-center' : 'block'}`}>
        
        <div className={`w-full ${isCollapsed ? "px-2 flex justify-center" : "px-4"}`}>
          <button
            onClick={() => setShowHowItWorks(true)}
            className={`flex items-center transition-all duration-300 rounded-xl border border-white/10 bg-[#18181b] text-white/90 hover:text-white hover:border-white/30 hover:bg-[#27272a] shadow-sm ${
              isCollapsed ? "justify-center p-3 w-11 h-11" : "w-full px-3 py-2.5"
            }`}
            data-tooltip={isCollapsed ? "How Swarm Works" : undefined}
          >
            <Hexagon size={16} className="shrink-0 text-white" />
            <span className={`transition-all duration-500 smooth-spring whitespace-nowrap ${isCollapsed ? "max-w-0 opacity-0 ml-0 overflow-hidden" : "max-w-[200px] opacity-100 ml-2.5 overflow-visible"}`}>
              How Swarm Works
            </span>
          </button>
        </div>

        <div className={`font-mono text-xs text-[#aaa] space-y-2 ${isCollapsed ? 'hidden' : 'px-4 block'}`}>
          <div>PROTOCOL V1.0.0</div>
          <div>ETHEREUM SEPOLIA</div>
        </div>
      </div>
    </nav>
    <HowSwarmWorksModal open={showHowItWorks} onClose={() => setShowHowItWorks(false)} />
    </>
  );
}
