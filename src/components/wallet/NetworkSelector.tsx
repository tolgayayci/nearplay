import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronDown, AlertTriangle, Check } from 'lucide-react';
import { useWallet, Network } from '@/contexts/WalletContext';
import { cn } from '@/lib/utils';

export function NetworkSelector() {
  const { network, setNetwork, deploymentMode } = useWallet();
  const [showMainnetWarning, setShowMainnetWarning] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Don't show network selector in playground mode
  if (deploymentMode === 'playground') {
    return null;
  }

  const handleNetworkChange = (newNetwork: Network) => {
    if (newNetwork === 'mainnet' && network === 'testnet') {
      setShowMainnetWarning(true);
    } else {
      setNetwork(newNetwork);
    }
    setIsOpen(false);
  };

  const confirmMainnetSwitch = () => {
    setNetwork('mainnet');
    setShowMainnetWarning(false);
  };

  const isMainnet = network === 'mainnet';

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors',
              'border border-border bg-muted/50 hover:bg-muted'
            )}
          >
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isMainnet ? 'bg-primary' : 'bg-muted-foreground'
              )}
            />
            <span className="text-xs font-medium capitalize">
              {network}
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48 p-1.5">
          {/* Testnet Option */}
          <button
            onClick={() => handleNetworkChange('testnet')}
            className={cn(
              'w-full flex items-center gap-3 p-2.5 rounded-md transition-colors',
              'hover:bg-muted',
              network === 'testnet' && 'bg-muted'
            )}
          >
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted border border-border">
              <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Testnet</span>
                {network === 'testnet' && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">Free test tokens</span>
            </div>
          </button>

          {/* Mainnet Option */}
          <button
            onClick={() => handleNetworkChange('mainnet')}
            className={cn(
              'w-full flex items-center gap-3 p-2.5 rounded-md transition-colors mt-1',
              'hover:bg-muted',
              network === 'mainnet' && 'bg-muted'
            )}
          >
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted border border-border">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Mainnet</span>
                {network === 'mainnet' && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">Real NEAR tokens</span>
            </div>
          </button>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mainnet Warning Dialog */}
      <AlertDialog open={showMainnetWarning} onOpenChange={setShowMainnetWarning}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted border border-border">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <AlertDialogTitle>Switch to Mainnet?</AlertDialogTitle>
                <p className="text-sm text-muted-foreground">This network uses real funds</p>
              </div>
            </div>
          </AlertDialogHeader>

          <AlertDialogDescription asChild>
            <div className="space-y-3 mt-2">
              <p className="text-sm">
                You're about to switch to <span className="font-medium text-foreground">NEAR Mainnet</span>.
                Please understand:
              </p>

              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Real NEAR Tokens</p>
                    <p className="text-xs text-muted-foreground">All transactions use actual cryptocurrency</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Irreversible Actions</p>
                    <p className="text-xs text-muted-foreground">Deployments and calls cannot be undone</p>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>Stay on Testnet</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMainnetSwitch}>
              Switch to Mainnet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
