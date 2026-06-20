import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

interface DropdownMenuProps {
  label: string;
  options: { id: string; label: string; subLabel?: string }[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placement?: "top" | "bottom";
}

export function DropdownMenu({ label, options, value, onChange, disabled, placement = "bottom" }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, minWidth: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        menuRef.current && 
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    
    function handleScroll() {
      // Close if scrolling happens outside the dropdown itself
      if (isOpen && containerRef.current) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("scroll", handleScroll, true); // Use capture phase to catch scroll events
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: placement === "bottom" ? rect.bottom + 4 : rect.top - 4,
        left: rect.left,
        minWidth: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
        className="inline-flex justify-between items-center w-full min-w-[200px] rounded-lg border border-white/10 bg-[#18181b] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : label}</span>
        <ChevronDown className="-mr-1 ml-2 h-4 w-4 opacity-50" aria-hidden="true" />
      </button>

      {isOpen && createPortal(
        <div 
          ref={menuRef}
          className={`fixed z-[9999] w-max rounded-lg bg-[#09090b] shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-white/10 animate-in fade-in zoom-in-95 duration-100 ${
            placement === "top" ? "-translate-y-full origin-bottom-left" : "origin-top-left"
          }`}
          style={{
            top: coords.top,
            left: coords.left,
            minWidth: coords.minWidth
          }}
        >
          <div className="py-1">
            {options.map((option) => {
              const isSelected = option.id === value;
              return (
                <button
                  key={option.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left flex items-center px-4 py-2 text-sm transition-colors hover:bg-white/10 hover:text-white ${
                    isSelected ? "bg-white/10 text-white" : "text-[#a1a1aa]"
                  }`}
                >
                  <span className="flex-1 text-left whitespace-normal break-words">
                    {option.label}
                    {option.subLabel && <span className="ml-2 text-xs opacity-60">({option.subLabel})</span>}
                  </span>
                  {isSelected && <Check className="ml-2 h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
