import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-full p-8">
          <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-center max-w-md">
            <p className="text-red-400 font-bold mb-2">Something went wrong</p>
            <p className="text-[#888] text-sm">{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white/10 text-white rounded-md text-sm">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
