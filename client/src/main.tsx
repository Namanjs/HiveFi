import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
              </Routes>
            </ErrorBoundary>
          </div>
        </div>
        </BrowserRouter>
      </ChatProvider>
    </WalletProvider>
  </StrictMode>,
)
