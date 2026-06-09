import { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  error: string | null;
}

export interface WalletContextType extends WalletState {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    provider: null,
    signer: null,
    error: null,
  });

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setWallet((prev) => ({ ...prev, error: "Please install MetaMask or another Web3 wallet." }));
      return;
    }

    setWallet((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Force the permission prompt even if previously connected
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
      await provider.send("eth_requestAccounts", []);
      
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      localStorage.setItem("walletConnected", "true");

      setWallet({
        address,
        isConnected: true,
        isConnecting: false,
        provider,
        signer,
        error: null,
      });
    } catch (err: any) {
      setWallet((prev) => ({
        ...prev,
        isConnecting: false,
        error: err.message || "Failed to connect wallet",
      }));
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    localStorage.removeItem("walletConnected");
    setWallet({
      address: null,
      isConnected: false,
      isConnecting: false,
      provider: null,
      signer: null,
      error: null,
    });
  }, []);

  // Check for existing connection on mount
  useEffect(() => {
    if (localStorage.getItem("walletConnected") === "true") {
      connectWallet();
    }
  }, [connectWallet]);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else if (wallet.address !== accounts[0] && localStorage.getItem("walletConnected") === "true") {
          connectWallet();
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
          window.ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, [wallet.address, connectWallet, disconnectWallet]);

  return (
    <WalletContext.Provider value={{ ...wallet, connectWallet, disconnectWallet }}>
      {children}
    </WalletContext.Provider>
  );
}
