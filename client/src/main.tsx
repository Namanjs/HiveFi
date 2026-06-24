import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './index.css'
import App from './App'
import Specialists from './pages/Specialists'
import Transactions from './pages/Transactions'
import Deploy from './pages/Deploy'
import Settings from './pages/Settings'
import NavBar from './components/NavBar'
import ErrorBoundary from './components/ErrorBoundary'
import { WalletProvider } from './contexts/WalletContext'
import { ChatProvider } from './contexts/ChatContext'

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <h1 className="text-7xl font-bold text-white/10">404</h1>
      <p className="text-white/40 mt-4 text-lg">Page not found</p>
      <Link to="/" className="mt-8 px-8 py-3 bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/30 rounded-xl text-[var(--color-accent)] text-sm font-semibold hover:bg-[var(--color-accent)]/30 transition-all">
        Go Home
      </Link>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <ChatProvider>
        <BrowserRouter>
          <div className="flex h-screen w-screen text-white overflow-hidden bg-transparent">
          <NavBar />
          <div className="flex-1 overflow-hidden relative">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<App />} />
                <Route path="/specialists" element={<Specialists />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/deploy" element={<Deploy />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </div>
        </div>
        </BrowserRouter>
      </ChatProvider>
    </WalletProvider>
  </StrictMode>,
)
