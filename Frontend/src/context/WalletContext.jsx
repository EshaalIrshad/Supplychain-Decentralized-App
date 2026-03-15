import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";

// Hardhat local network chain ID
const HARDHAT_CHAIN_ID = "0x7a69"; // 31337 in hex

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState("");
  const [role, setRole] = useState(""); // from blockchain
  const [network, setNetwork] = useState("");
  const [error, setError] = useState("");

  // Fetch the wallet's role from the backend (which reads the chain)
  const fetchRole = useCallback(async (address) => {
    if (!address) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const roleNum = await contract.getRole(address);
      const roleMap = {
        0: "None",
        1: "Manufacturer",
        2: "Distributor",
        3: "Retailer",
        4: "Consumer",
      };
      setRole(roleMap[Number(roleNum)] || "None");
    } catch {
      setRole("None");
    }
  }, []);

  // Re-check on mount in case MetaMask is already connected
  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) return;
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        const { chainId } = await provider.getNetwork();
        setNetwork(chainId.toString());
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          await fetchRole(accounts[0]);
        }
      } catch {
        /* ignore */
      }
    };
    init();

    // Listen for MetaMask account/chain changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", async (accounts) => {
        setAccount(accounts[0] || "");
        setRole("");
        if (accounts[0]) await fetchRole(accounts[0]);
      });
      window.ethereum.on("chainChanged", (chainId) => {
        setNetwork(parseInt(chainId, 16).toString());
      });
    }
  }, [fetchRole]);

  const connectWallet = async () => {
    setError("");
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install it from metamask.io");
      return false;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const { chainId } = await provider.getNetwork();
      setNetwork(chainId.toString());

      // Warn if not on Hardhat local network
      if (chainId.toString() !== "31337") {
        setError(
          `Wrong network. MetaMask is on chain ${chainId} but this app needs Hardhat local (chain 31337). ` +
            `Please switch MetaMask to Localhost 8545.`,
        );
        return false;
      }

      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        await fetchRole(accounts[0]);
        return true;
      }
    } catch (err) {
      setError("Failed to connect wallet: " + err.message);
    }
    return false;
  };

  const refreshRole = () => fetchRole(account);

  const getProvider = () =>
    window.ethereum ? new BrowserProvider(window.ethereum) : null;

  return (
    <WalletContext.Provider
      value={{
        account,
        role,
        network,
        error,
        connectWallet,
        refreshRole,
        getProvider,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
