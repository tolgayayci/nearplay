import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Server, Check, ChevronDown, Settings } from 'lucide-react';
import { useRPC } from '@/contexts/RPCContext';
import { useWallet } from '@/contexts/WalletContext';
import { cn } from '@/lib/utils';

interface RPCDropdownProps {
  onOpenSettings?: () => void;
}

export function RPCDropdown({ onOpenSettings }: RPCDropdownProps) {
  const {
    providers,
    selectedTestnetProvider,
    selectedMainnetProvider,
    connectionStatus,
    setProvider,
  } = useRPC();

  const { network } = useWallet();

  const currentProviderId = network === 'testnet' ? selectedTestnetProvider : selectedMainnetProvider;
  const currentProvider = providers.find(p => p.id === currentProviderId);
  const statusKey = `${currentProviderId}-${network}`;
  const status = connectionStatus[statusKey];

  // Determine status: green = connected, red = failed, gray = not tested
  const getStatusColor = () => {
    if (!status?.lastChecked) return 'bg-gray-400'; // Not tested yet
    return status.connected ? 'bg-green-500' : 'bg-red-500';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
        >
          <Server className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">
            {currentProvider?.name || 'RPC'}
          </span>
          <div className={cn("h-2 w-2 rounded-full", getStatusColor())} />
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">
            RPC Provider ({network})
          </p>
        </div>
        <DropdownMenuSeparator />

        {providers.map((provider) => {
          const isSelected = provider.id === currentProviderId;
          const providerStatusKey = `${provider.id}-${network}`;
          const providerStatus = connectionStatus[providerStatusKey];

          // Status indicator for this provider
          const getProviderStatusColor = () => {
            if (!providerStatus?.lastChecked) return 'bg-gray-400';
            return providerStatus.connected ? 'bg-green-500' : 'bg-red-500';
          };

          return (
            <DropdownMenuItem
              key={provider.id}
              onClick={() => setProvider(network, provider.id)}
              className="gap-2"
            >
              <div className="flex items-center gap-2 flex-1">
                {isSelected ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <div className="h-4 w-4" />
                )}
                <span className={cn(isSelected && "font-medium")}>
                  {provider.name}
                </span>
                {provider.isCustom && (
                  <span className="text-[10px] text-muted-foreground">(Custom)</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {providerStatus?.connected && providerStatus.latency && (
                  <span className="text-[10px] text-muted-foreground">{providerStatus.latency}ms</span>
                )}
                <div className={cn("h-2 w-2 rounded-full", getProviderStatusColor())} />
              </div>
            </DropdownMenuItem>
          );
        })}

        {onOpenSettings && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenSettings} className="gap-2">
              <Settings className="h-4 w-4" />
              <span>RPC Settings</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
