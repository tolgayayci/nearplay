import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Wallet,
  Zap,
  LogOut,
  RefreshCw,
  ChevronDown,
  Copy,
  ExternalLink,
  Settings,
  Loader2,
  Check,
  ArrowRightLeft,
} from 'lucide-react';
import { useWallet, formatNearAmount } from '@/contexts/WalletContext';
import { WalletModeModal } from './WalletModeModal';
import { NetworkSelector } from './NetworkSelector';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WalletButtonProps {
  onOpenRPCSettings?: () => void;
}

export function WalletButton({ onOpenRPCSettings }: WalletButtonProps) {
  const {
    deploymentMode,
    network,
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
  const [showModeModal, setShowModeModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);

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
    }
  };

  // Loading state
  if (isInitializing) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Playground mode
  if (deploymentMode === 'playground') {
    return (
      <>
        <button
          onClick={() => setShowModeModal(true)}
          className={cn(
            'group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
            'bg-muted/50 border border-border',
            'hover:bg-muted hover:border-border'
          )}
        >
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Playground</span>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted border border-border">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">Testnet</span>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        <WalletModeModal open={showModeModal} onOpenChange={setShowModeModal} />
      </>
    );
  }

  // Wallet mode - connected
  if (isConnected && accountId) {
    const truncatedAddress = accountId.length > 20
      ? `${accountId.slice(0, 8)}...${accountId.slice(-6)}`
      : accountId;
    const formattedBalance = accountBalance
      ? formatNearAmount(accountBalance.available)
      : null;

    return (
      <div className="flex items-center gap-2">
        <NetworkSelector />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'group flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors',
                'bg-muted/50 border border-border',
                'hover:bg-muted'
              )}
            >
              {/* Avatar/Icon */}
              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted border border-border">
                <Wallet className="h-3 w-3 text-muted-foreground" />
              </div>

              {/* Account Info */}
              <div className="flex flex-col items-start">
                <span className="text-xs font-mono font-medium leading-tight">{truncatedAddress}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {isLoadingBalance ? 'Loading...' : formattedBalance ? `${formattedBalance} NEAR` : '--'}
                </span>
              </div>

              <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-72 p-0">
            {/* Account Header */}
            <div className="p-4 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted border border-border">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Connected Account</p>
                  <p className="text-sm font-mono truncate">{accountId}</p>
                </div>
              </div>

              {/* Balance Display */}
              <div className="mt-3 p-3 rounded-lg bg-background border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Available Balance</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={refreshBalance}
                    disabled={isLoadingBalance}
                  >
                    <RefreshCw className={cn("h-3 w-3", isLoadingBalance && "animate-spin")} />
                  </Button>
                </div>
                <p className="text-xl font-semibold mt-1">
                  {isLoadingBalance ? (
                    <span className="text-muted-foreground text-base">Loading...</span>
                  ) : formattedBalance ? (
                    <>
                      {formattedBalance} <span className="text-sm font-normal text-muted-foreground">NEAR</span>
                    </>
                  ) : (
                    '--'
                  )}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-1.5">
              <DropdownMenuItem onClick={handleCopyAddress} className="gap-2 rounded-md">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Copied!' : 'Copy Address'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleViewOnExplorer} className="gap-2 rounded-md">
                <ExternalLink className="h-4 w-4" />
                <span>View on Explorer</span>
              </DropdownMenuItem>
              {onOpenRPCSettings && (
                <DropdownMenuItem onClick={onOpenRPCSettings} className="gap-2 rounded-md">
                  <Settings className="h-4 w-4" />
                  <span>RPC Settings</span>
                </DropdownMenuItem>
              )}
            </div>

            <DropdownMenuSeparator className="my-0" />

            <div className="p-1.5">
              <DropdownMenuItem onClick={() => setShowModeModal(true)} className="gap-2 rounded-md">
                <ArrowRightLeft className="h-4 w-4" />
                <span>Switch Mode</span>
                <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted border border-border">
                  <Zap className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Playground</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="gap-2 rounded-md text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                <span>Disconnect</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <WalletModeModal open={showModeModal} onOpenChange={setShowModeModal} />
      </div>
    );
  }

  // Wallet mode - not connected
  return (
    <div className="flex items-center gap-2">
      <NetworkSelector />

      <Button
        onClick={connectWallet}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        <span>Connect</span>
      </Button>

      <button
        onClick={() => setShowModeModal(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Zap className="h-3.5 w-3.5" />
        <span className="text-xs">Playground</span>
      </button>

      <WalletModeModal open={showModeModal} onOpenChange={setShowModeModal} />
    </div>
  );
}
