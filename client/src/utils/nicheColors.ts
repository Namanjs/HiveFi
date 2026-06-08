/**
 * Shared utility for consistent niche-based color styling across the app.
 * Returns Tailwind classes for background, text, and border.
 */
export function getNicheColor(niche: string): string {
  switch (niche) {
    case "SQL": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "PYTHON": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "FRONTEND": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "DESIGN": return "bg-pink-500/20 text-pink-400 border-pink-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}
