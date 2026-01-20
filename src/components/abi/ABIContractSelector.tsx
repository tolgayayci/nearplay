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
import { useState } from 'react';
import { getExplorerAccountUrl } from '@/lib/config';
import { DeploymentInfoBar } from './DeploymentInfoBar';
import { VerificationModal } from '@/components/verification/VerificationModal';
import { VerifyContractResult } from '@/lib/verification';
import { supabase } from '@/lib/supabase';

interface ABIContractSelectorProps {
  contractAddress: string;
  onAddressChange: (address: string) => void;
  error?: string | null;
  deployments: Deployment[];
  isLoading?: boolean;
  userId?: string;
  projectId?: string;
  isSharedView?: boolean;
}

export function ABIContractSelector({
  contractAddress,
  onAddressChange,
  error,
  deployments,
  isLoading,
  userId,
  projectId,
  isSharedView = false,
}: ABIContractSelectorProps) {
  const { toast } = useToast();
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verifiedDeploymentIds, setVerifiedDeploymentIds] = useState<Record<string, { verified: boolean; verified_at?: string; onchain_hash?: string }>>({});

  // Merge verification status with deployments
  const deploymentsWithVerification = deployments.map(d => {
    const verificationUpdate = verifiedDeploymentIds[d.id];
    if (verificationUpdate) {
      return {
        ...d,
        metadata: {
          ...d.metadata,
          ...verificationUpdate,
        },
      };
    }
    return d;
  });

  const selectedDeployment = deploymentsWithVerification.find(d => d.contract_address === contractAddress);

  // Save verification result to Supabase deployment metadata
  const handleVerificationComplete = async (result: VerifyContractResult) => {
    if (!selectedDeployment) return;

    const verificationData = {
      verified: result.verified,
      verified_at: result.verified_at,
      onchain_hash: result.onchain_hash,
    };

    // Update local state immediately for instant UI feedback
    setVerifiedDeploymentIds(prev => ({
      ...prev,
      [selectedDeployment.id]: verificationData,
    }));

    try {
      // Update deployment metadata in Supabase
      const updatedMetadata = {
        ...selectedDeployment.metadata,
        ...verificationData,
      };

      console.log('Updating deployment metadata:', {
        deploymentId: selectedDeployment.id,
        updatedMetadata,
      });

      const { data, error: updateError } = await supabase
        .from('deployments')
        .update({ metadata: updatedMetadata })
        .eq('id', selectedDeployment.id)
        .select();

      console.log('Supabase update result:', { data, error: updateError });

      if (updateError) {
        console.error('Failed to save verification status:', updateError);
        toast({
          title: 'Warning',
          description: 'Verification succeeded but failed to save status: ' + updateError.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Verified',
        description: 'Contract verification status saved',
      });
    } catch (err) {
      console.error('Error saving verification:', err);
      toast({
        title: 'Error',
        description: 'Failed to save verification: ' + (err instanceof Error ? err.message : 'Unknown error'),
        variant: 'destructive',
      });
    }
  };

  // Determine network from deployment
  const network: 'testnet' | 'mainnet' = selectedDeployment?.chain_name?.toLowerCase().includes('mainnet')
    ? 'mainnet'
    : 'testnet';

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

          {/* Deployment Info Bar */}
          {selectedDeployment && (
            <div className="pt-3 mt-3 border-t">
              <DeploymentInfoBar
                deployment={selectedDeployment}
                onVerifyClick={
                  !isSharedView && userId && projectId
                    ? () => setShowVerificationModal(true)
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      {userId && projectId && selectedDeployment && (
        <VerificationModal
          open={showVerificationModal}
          onOpenChange={(open) => {
            if (open) {
              console.log('Opening VerificationModal with:', {
                wasmHash: selectedDeployment.metadata?.wasm_hash,
                isVerified: selectedDeployment.metadata?.verified === true,
                verifiedAt: selectedDeployment.metadata?.verified_at,
                fullMetadata: selectedDeployment.metadata,
              });
            }
            setShowVerificationModal(open);
          }}
          userId={userId}
          projectId={projectId}
          contractId={selectedDeployment.contract_address}
          wasmHash={selectedDeployment.metadata?.wasm_hash}
          isVerified={selectedDeployment.metadata?.verified === true}
          verifiedAt={selectedDeployment.metadata?.verified_at}
          network={network}
          onVerificationComplete={handleVerificationComplete}
        />
      )}
    </>
  );
}