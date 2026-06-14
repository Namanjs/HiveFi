import { useEffect, useRef, useState } from "react";

interface AnimatedBalanceProps {
  value: string;
  className?: string;
  onFlash?: "up" | "down" | null;
}

export default function AnimatedBalance({ value, className = "" }: AnimatedBalanceProps) {
  const parsed = parseFloat(value);
  const safeTarget = Number.isFinite(parsed) ? parsed : 0;

  const [display, setDisplay] = useState(safeTarget);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevRef = useRef(safeTarget);

  useEffect(() => {
    if (safeTarget === prevRef.current) return;

    const start = prevRef.current;
    const delta = safeTarget - start;
    setFlash(delta > 0 ? "up" : "down");

    const duration = 700;
    const startTime = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start + delta * eased);
      if (t < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        prevRef.current = safeTarget;
        setDisplay(safeTarget);
      }
    };

    frameId = requestAnimationFrame(tick);
    const flashTimer = setTimeout(() => setFlash(null), 900);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(flashTimer);
    };
  }, [safeTarget]);

  const flashClass =
    flash === "up"
      ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
      : flash === "down"
        ? "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.4)]"
        : "text-white";

  return (
    <span className={`transition-colors duration-300 ${flashClass} ${className}`}>
      {display.toFixed(2)}
    </span>
  );
}
