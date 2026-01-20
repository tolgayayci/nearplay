import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Wallet,
  Zap,
  LogOut,
  RefreshCw,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  Check,
  Globe,
} from 'lucide-react';
import { useWallet, formatNearAmount, Network } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Network indicator dot
function NetworkDot({ network, className }: { network: Network; className?: string }) {
  return (
    <div
      className={cn(
        'h-2 w-2 rounded-full',
        network === 'mainnet' ? 'bg-green-500' : 'bg-muted-foreground',
        className
      )}
    />
  );
}

// Truncate address helper
function truncateAddress(address: string, startChars = 8, endChars = 6): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

export function WalletButton() {
  const {
    deploymentMode,
    setDeploymentMode,
    network,
    setNetwork,
    isConnected,
    accountId,
    accountBalance,
    isInitializing,
    isLoadingBalance,
    connectWallet,
    disconnectWallet,
    refreshBalance,
  } = useWallet();

  const { toast } = useToast();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Handlers
  const handleCopyAddress = () => {
    if (accountId) {
      navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied',
        description: 'Address copied to clipboard',
      });
    }
  };

  const handleViewOnExplorer = () => {
    if (accountId) {
      const explorerUrl = network === 'mainnet'
        ? `https://nearblocks.io/address/${accountId}`
        : `https://testnet.nearblocks.io/address/${accountId}`;
      window.open(explorerUrl, '_blank');
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectWallet();
      toast({
        title: 'Disconnected',
        description: 'Wallet disconnected',
      });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setIsDisconnecting(false);
      setIsOpen(false);
    }
  };

  const handleSwitchToPlayground = () => {
    setDeploymentMode('playground');
    setIsOpen(false);
  };

  const handleSwitchToWallet = () => {
    setDeploymentMode('wallet');
    setNetwork('mainnet'); // External wallets are mainnet-only
    setIsOpen(false);
  };

  const handleConnectWallet = () => {
    setIsOpen(false);
    connectWallet();
  };

  // Loading state
  if (isInitializing) {
    return (
      <Button variant="outline" size="sm" className="h-9 gap-2" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }

  // Compute button content
  const isPlayground = deploymentMode === 'playground';
  const isWalletConnected = !isPlayground && isConnected && accountId;
  const isWalletDisconnected = !isPlayground && !isConnected;

  const buttonLabel = isPlayground
    ? 'Playground'
    : isWalletConnected
      ? truncateAddress(accountId!)
      : 'Connect';

  const ButtonIcon = isPlayground ? Zap : Wallet;
  const currentNetwork: Network = isPlayground ? 'testnet' : 'mainnet'; // Wallet mode is always mainnet
  const formattedBalance = accountBalance ? formatNearAmount(accountBalance.available) : null;

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={cn(
            "gap-2 px-3",
            isWalletConnected ? "h-auto py-1.5" : "h-9"
          )}>
            <ButtonIcon className="h-4 w-4" />
            {isWalletConnected ? (
              <div className="flex flex-col items-start">
                <span className="text-xs font-mono leading-tight">{buttonLabel}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {isLoadingBalance ? 'Loading...' : formattedBalance ? `${formattedBalance} NEAR` : '0 NEAR'}
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium">{buttonLabel}</span>
            )}
            <NetworkDot network={currentNetwork} />
            <ChevronDown className={cn(
              'h-3 w-3 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )} />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72 p-0">
          {/* ===== PLAYGROUND MODE ===== */}
          {isPlayground && (
            <>
              <div className="p-4 bg-muted/30 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted border">
                    <Zap className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Playground Mode</p>
                    <p className="text-xs text-muted-foreground">Free testnet deployment</p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <DropdownMenuItem onClick={handleSwitchToWallet} className="gap-3 p-3 cursor-pointer">
                  <Wallet className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Use External Wallet</p>
                    <p className="text-xs text-muted-foreground">Connect Meteor or HOT wallet</p>
                  </div>
                </DropdownMenuItem>
              </div>
            </>
          )}

          {/* ===== WALLET CONNECTED ===== */}
          {isWalletConnected && (
            <>
              {/* Account Header */}
              <div className="p-4 bg-muted/30 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted border">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">Mainnet</p>
                      <NetworkDot network="mainnet" />
                    </div>
                    <p className="text-sm font-mono truncate">{accountId}</p>
                  </div>
                </div>

                {/* Balance */}
                <div className="mt-3 p-3 rounded-lg bg-background border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Balance</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        refreshBalance();
                      }}
                      disabled={isLoadingBalance}
                    >
                      <RefreshCw className={cn('h-3 w-3', isLoadingBalance && 'animate-spin')} />
                    </Button>
                  </div>
                  <p className="text-lg font-semibold mt-1">
                    {isLoadingBalance ? (
                      <span className="text-muted-foreground text-sm">Loading...</span>
                    ) : (
                      <>
                        {formattedBalance || '0'} <span className="text-sm font-normal text-muted-foreground">NEAR</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-2">
                <DropdownMenuItem onClick={handleCopyAddress} className="gap-2 cursor-pointer">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Address'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleViewOnExplorer} className="gap-2 cursor-pointer">
                  <ExternalLink className="h-4 w-4" />
                  View on Explorer
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator className="m-0" />

              <div className="p-2">
                <DropdownMenuItem onClick={handleSwitchToPlayground} className="gap-3 p-3 cursor-pointer">
                  <Zap className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Switch to Playground</p>
                    <p className="text-xs text-muted-foreground">Free testnet deployment</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  {isDisconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Disconnect
                </DropdownMenuItem>
              </div>
            </>
          )}

          {/* ===== WALLET DISCONNECTED ===== */}
          {isWalletDisconnected && (
            <>
              <div className="p-4 bg-muted/30 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted border">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Mainnet Only</p>
                      <NetworkDot network="mainnet" />
                    </div>
                    <p className="text-xs text-muted-foreground">Connect your wallet</p>
                  </div>
                </div>
              </div>

              {/* Wallet Options */}
              <div className="p-2 border-b">
                <DropdownMenuItem onClick={() => handleConnectWallet()} className="gap-3 p-3 cursor-pointer">
                  <Globe className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Connect Wallet</p>
                    <p className="text-xs text-muted-foreground">Meteor, HOT and more</p>
                  </div>
                </DropdownMenuItem>
              </div>

              {/* Testnet info */}
              <div className="p-2">
                <DropdownMenuItem onClick={handleSwitchToPlayground} className="gap-3 p-3 cursor-pointer">
                  <Zap className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Need Testnet?</p>
                    <p className="text-xs text-muted-foreground">Use Playground - free & unlimited</p>
                  </div>
                </DropdownMenuItem>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
