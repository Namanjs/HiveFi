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
  connectWallet: (isAutoConnect?: boolean) => Promise<void>;
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

  const connectWallet = useCallback(async (isAutoConnect: boolean = false) => {
    if (!window.ethereum) {
      if (!isAutoConnect) {
        setWallet((prev) => ({ ...prev, error: "Please install MetaMask or another Web3 wallet." }));
      }
      return;
    }

    if (isAutoConnect) {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length === 0) {
          return; // Exit silently if no accounts are authorized
        }

        const network = await provider.getNetwork();
        if (network.chainId !== 11155111n) {
          try {
            await provider.send("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]);
          } catch (e) {
            return; // Exit silently on switch error during silent check
          }
        }

        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        setWallet({
          address,
          isConnected: true,
          isConnecting: false,
          provider,
          signer,
          error: null,
        });
      } catch (err) {
        console.error("Auto-connect check failed:", err);
      }
      return;
    }

    setWallet((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const provider = new BrowserProvider(window.ethereum);
      
      // Enforce Sepolia Network
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        try {
          await provider.send("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]);
        } catch (switchError: any) {
          throw new Error("Please switch your wallet to the Ethereum Sepolia network.");
        }
      }

      // Prompt user to connect accounts
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length === 0) {
        throw new Error("No accounts found. Please authorize your wallet.");
      }
      
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
      connectWallet(true);
    }
  }, [connectWallet]);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else if (wallet.address !== accounts[0] && localStorage.getItem("walletConnected") === "true") {
          connectWallet(true);
        }
      };

      const handleChainChanged = (chainId: string | number) => {
        const hexChainId = typeof chainId === "number" ? "0x" + chainId.toString(16) : chainId;
        const prevChainId = sessionStorage.getItem("currentChainId");
        
        if (prevChainId && prevChainId.toLowerCase() !== hexChainId.toLowerCase()) {
          sessionStorage.setItem("currentChainId", hexChainId);
          window.location.reload();
        } else {
          sessionStorage.setItem("currentChainId", hexChainId);
        }
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
