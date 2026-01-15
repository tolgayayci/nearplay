import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Zap, Wallet, Check, Rocket, Shield, Globe } from 'lucide-react';
import { useWallet, DeploymentMode } from '@/contexts/WalletContext';
import { cn } from '@/lib/utils';

interface WalletModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletModeModal({ open, onOpenChange }: WalletModeModalProps) {
  const {
    deploymentMode,
    setDeploymentMode,
    connectWallet,
    accountId,
  } = useWallet();

  const handleSelectMode = (mode: DeploymentMode) => {
    setDeploymentMode(mode);
    if (mode === 'wallet' && !accountId) {
      connectWallet();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Choose Deployment Mode</DialogTitle>
          <DialogDescription>
            Select how you want to deploy smart contracts to NEAR Protocol
          </DialogDescription>
        </DialogHeader>

        {/* Cards */}
        <div className="p-6 grid gap-3">
          {/* Playground Mode Card */}
          <button
            onClick={() => handleSelectMode('playground')}
            className={cn(
              'group relative flex items-start gap-4 p-4 rounded-lg text-left transition-colors',
              'border bg-background hover:bg-muted/50',
              deploymentMode === 'playground'
                ? 'border-primary bg-muted/30'
                : 'border-border'
            )}
          >
            {/* Icon */}
            <div className={cn(
              'shrink-0 p-2.5 rounded-lg',
              'bg-muted border border-border'
            )}>
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">Playground Wallet</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted border border-border text-muted-foreground">
                  Testnet
                </span>
                {deploymentMode === 'playground' && (
                  <div className="ml-auto flex items-center gap-1 text-xs font-medium text-primary">
                    <Check className="h-3.5 w-3.5" />
                    Active
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                Quick deployments with zero setup. Perfect for learning.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Rocket className="h-3.5 w-3.5" />
                  <span>Instant deploy</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  <span>No wallet needed</span>
                </div>
              </div>
            </div>
          </button>

          {/* External Wallet Card */}
          <button
            onClick={() => handleSelectMode('wallet')}
            className={cn(
              'group relative flex items-start gap-4 p-4 rounded-lg text-left transition-colors',
              'border bg-background hover:bg-muted/50',
              deploymentMode === 'wallet'
                ? 'border-primary bg-muted/30'
                : 'border-border'
            )}
          >
            {/* Icon */}
            <div className={cn(
              'shrink-0 p-2.5 rounded-lg',
              'bg-muted border border-border'
            )}>
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">External Wallet</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted border border-border text-muted-foreground">
                  Testnet
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted border border-border text-muted-foreground">
                  Mainnet
                </span>
                {deploymentMode === 'wallet' && (
                  <div className="ml-auto flex items-center gap-1 text-xs font-medium text-primary">
                    <Check className="h-3.5 w-3.5" />
                    Active
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                Connect your wallet for full control. Deploy anywhere.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Multi-network</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Your keys</span>
                </div>
              </div>

              {accountId && deploymentMode !== 'wallet' && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Already connected:</span>
                    <span className="font-mono">{accountId.length > 20 ? `${accountId.slice(0, 10)}...${accountId.slice(-8)}` : accountId}</span>
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/30">
          <p className="text-xs text-center text-muted-foreground">
            You can switch deployment modes anytime from the wallet menu
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
