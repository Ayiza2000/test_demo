import React, { createContext, useState, useEffect, useContext } from 'react';
import detectEthereumProvider from '@metamask/detect-provider';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { ethers } from 'ethers';

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState(null);
  const [walletType, setWalletType] = useState(null);

  // Check if MetaMask is installed
  const checkMetaMask = async () => {
    const provider = await detectEthereumProvider();
    if (provider) {
      return provider;
    }
    return null;
  };

  // Initialize WalletConnect
  const initWalletConnect = async () => {
    try {
      const walletConnectProvider = new WalletConnectProvider({
        rpc: {
          1: 'https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID',
          56: 'https://bsc-dataseed.binance.org/',
          137: 'https://polygon-rpc.com/',
          80001: 'https://rpc-mumbai.maticvigil.com/',
        },
        qrcodeModalOptions: {
          mobileLinks: [
            'rainbow',
            'metamask',
            'argent',
            'trust',
            'imtoken',
            'pillar'
          ]
        }
      });

      await walletConnectProvider.enable();
      
      const web3Provider = new ethers.providers.Web3Provider(walletConnectProvider);
      const signer = web3Provider.getSigner();
      const address = await signer.getAddress();
      
      return { provider: walletConnectProvider, web3Provider, address };
    } catch (error) {
      console.error('WalletConnect error:', error);
      throw error;
    }
  };

  // Connect to MetaMask
  const connectMetaMask = async () => {
    const ethProvider = await checkMetaMask();
    if (!ethProvider) {
      throw new Error('MetaMask not installed');
    }

    const accounts = await ethProvider.request({
      method: 'eth_requestAccounts'
    });

    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }

    return { provider: ethProvider, address: accounts[0] };
  };

  // Get balance and chain info
  const getWalletInfo = async (provider, address) => {
    const web3Provider = new ethers.providers.Web3Provider(provider);
    
    // Get chain ID
    const network = await web3Provider.getNetwork();
    const chainId = network.chainId;

    // Get balance - ethers v5 uses utils.formatEther
    const balance = await web3Provider.getBalance(address);
    const balanceInEth = ethers.utils.formatEther(balance);

    return { chainId, balance: balanceInEth, web3Provider };
  };

  // Connect wallet
  const connectWallet = async (type = 'metamask') => {
    setIsLoading(true);
    try {
      let result;
      let walletTypeUsed = type;

      if (type === 'walletconnect') {
        result = await initWalletConnect();
        walletTypeUsed = 'walletconnect';
      } else {
        result = await connectMetaMask();
        walletTypeUsed = 'metamask';
      }

      const { provider, address } = result;
      
      const { chainId, balance, web3Provider } = await getWalletInfo(provider, address);

      setAccount(address);
      setChainId(chainId);
      setBalance(balance);
      setIsConnected(true);
      setProvider(provider);
      setWalletType(walletTypeUsed);

      localStorage.setItem('walletConnected', 'true');
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('walletType', walletTypeUsed);

      return { success: true, address };
    } catch (error) {
      console.error('Error connecting wallet:', error);
      
      if (error.code === 4001) {
        alert('Please connect your wallet to continue.');
      } else if (error.message === 'MetaMask not installed') {
        alert('Please install MetaMask or use WalletConnect!');
      } else {
        alert(`Failed to connect wallet: ${error.message}`);
      }
      
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      if (walletType === 'walletconnect' && provider) {
        await provider.disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting WalletConnect:', error);
    } finally {
      setAccount(null);
      setIsConnected(false);
      setBalance(null);
      setChainId(null);
      setProvider(null);
      setWalletType(null);
      localStorage.removeItem('walletConnected');
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('walletType');
    }
  };

  // Check existing connection
  const checkConnection = async () => {
    const wasConnected = localStorage.getItem('walletConnected') === 'true';
    const savedAddress = localStorage.getItem('walletAddress');
    const savedWalletType = localStorage.getItem('walletType');

    if (!wasConnected || !savedAddress) {
      return;
    }

    try {
      if (savedWalletType === 'walletconnect') {
        const walletConnectProvider = new WalletConnectProvider({
          rpc: {
            1: 'https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID',
            56: 'https://bsc-dataseed.binance.org/',
            137: 'https://polygon-rpc.com/',
          }
        });

        if (walletConnectProvider.connected) {
          const web3Provider = new ethers.providers.Web3Provider(walletConnectProvider);
          const signer = web3Provider.getSigner();
          const address = await signer.getAddress();
          
          if (address.toLowerCase() === savedAddress.toLowerCase()) {
            const { chainId, balance } = await getWalletInfo(walletConnectProvider, address);
            setAccount(address);
            setChainId(chainId);
            setBalance(balance);
            setIsConnected(true);
            setProvider(walletConnectProvider);
            setWalletType('walletconnect');
          }
        }
      } else {
        const ethProvider = await checkMetaMask();
        if (ethProvider) {
          const accounts = await ethProvider.request({
            method: 'eth_accounts'
          });
          
          if (accounts.length > 0 && accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
            const { chainId, balance } = await getWalletInfo(ethProvider, accounts[0]);
            setAccount(accounts[0]);
            setChainId(chainId);
            setBalance(balance);
            setIsConnected(true);
            setProvider(ethProvider);
            setWalletType('metamask');
          }
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      disconnectWallet();
    }
  };

  // Switch network
  const switchNetwork = async (chainId) => {
    try {
      if (walletType === 'metamask') {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      } else if (walletType === 'walletconnect') {
        alert('Please switch network in your wallet app');
      }
    } catch (error) {
      console.error('Error switching network:', error);
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          const address = accounts[0];
          setAccount(address);
          setIsConnected(true);
          localStorage.setItem('walletAddress', address);
          localStorage.setItem('walletConnected', 'true');
        } else {
          disconnectWallet();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    checkConnection();
  }, []);

  return (
    <WalletContext.Provider value={{
      account,
      chainId,
      balance,
      isConnected,
      isLoading,
      walletType,
      connectWallet,
      disconnectWallet,
      switchNetwork
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};