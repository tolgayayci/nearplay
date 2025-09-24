import { Info, Clock, Copy, ExternalLink, MoreVertical } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Deployment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { getExplorerAccountUrl } from '@/lib/config';

interface ABIContractSelectorProps {
  contractAddress: string;
  onAddressChange: (address: string) => void;
  error?: string | null;
  deployments: Deployment[];
  isLoading?: boolean;
}

export function ABIContractSelector({ 
  contractAddress, 
  onAddressChange,
  error,
  deployments,
  isLoading
}: ABIContractSelectorProps) {
  const { toast } = useToast();
  const selectedDeployment = deployments.find(d => d.contract_address === contractAddress);

  const formatDeploymentTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Invalid date';
    }
  };


  const handleOpenExplorer = (address: string) => {
    window.open(getExplorerAccountUrl(address), '_blank');
  };

  if (isLoading) {
    return (
      <div className="p-4 border-b bg-muted/20">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Check if this is ABI from compilation only
  const isCompilationOnlyABI = !contractAddress && deployments.length === 0;

  // Don't show selector for compilation-only ABI
  if (isCompilationOnlyABI) {
    return null;
  }

  return (
    <>
      <div className="p-4 border-b bg-muted/20">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Contract Address
            </label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select a deployed contract address on NEAR Testnet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={contractAddress}
              onValueChange={onAddressChange}
              disabled={deployments.length === 0}
            >
              <SelectTrigger className="w-full font-mono text-xs">
                <SelectValue placeholder={
                  deployments.length === 0 
                    ? "No deployments found" 
                    : "Select a deployed contract"
                } />
              </SelectTrigger>
              <SelectContent>
                {deployments.map((deployment) => (
                  <SelectItem 
                    key={deployment.contract_address} 
                    value={deployment.contract_address}
                    className="font-mono text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{deployment.contract_address}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        <span>{formatDeploymentTime(deployment.created_at)}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDeployment && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleOpenExplorer(selectedDeployment.contract_address)}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Show on NearBlocks
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      await navigator.clipboard.writeText(selectedDeployment.contract_address);
                      toast({
                        title: "Copied",
                        description: "Contract address copied to clipboard",
                      });
                    }}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Address
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <Info className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>
      </div>
    </>
  );
}