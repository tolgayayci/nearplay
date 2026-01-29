import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RocketIcon,
  CheckCircle,
  Terminal,
  Loader2,
  ExternalLink,
  Copy,
  AlertCircle,
  Globe,
  Wallet,
  Server,
  Coins,
  Shield,
  Zap,
  AlertTriangle,
  ChevronRight,
  HardDrive,
  Info,
} from 'lucide-react';
import { CompilationResult, DeploymentResult } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { deployContract } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/App';
import { getExplorerAccountUrl } from '@/lib/config';
import { VerificationModal } from '@/components/verification/VerificationModal';
import { useWallet, formatNearAmount, DeploymentMode, getWalletDisplayName } from '@/contexts/WalletContext';
import { useRPC } from '@/contexts/RPCContext';
import {
  deployWithWallet,
  WalletDeploymentResult,
  estimateDeploymentCost,
  formatYoctoNear,
  checkFactoryAvailability,
  WalletDeploymentNotSupportedError,
} from '@/lib/walletDeployment';

interface DeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  lastCompilation: CompilationResult | null;
  onDeploySuccess?: () => void;
  onCompile?: () => void;
  showABIError?: boolean;
}

export function DeployDialog({
  open,
  onOpenChange,
  projectId,
  lastCompilation,
  onDeploySuccess,
  onCompile,
  showABIError = false,
}: DeployDialogProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | WalletDeploymentResult | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [factoryAvailable, setFactoryAvailable] = useState<boolean | null>(null);
  const [isCheckingFactory, setIsCheckingFactory] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const {
    deploymentMode,
    setDeploymentMode,
    network,
    isConnected,
    accountId,
    accountBalance,
    selector,
    connectWallet,
    refreshBalance,
    isLoadingBalance,
    walletId,
  } = useWallet();

  const {
    providers,
    selectedTestnetProvider,
    selectedMainnetProvider,
    setProvider,
    getCurrentRpcUrl,
    getProviderById,
  } = useRPC();

  // Get current provider based on network
  const currentNetwork = deploymentMode === 'playground' ? 'testnet' : network;
  const currentProviderId = currentNetwork === 'mainnet'
    ? selectedMainnetProvider
    : selectedTestnetProvider;
  const currentProvider = getProviderById(currentProviderId);

  // Reset deployment result when dialog is opened
  useEffect(() => {
    if (open) {
      setDeploymentResult(null);
      setDeploymentError(null);
      setIsDeploying(false);
    }
  }, [open]);

  // Refresh balance when dialog opens in wallet mode
  useEffect(() => {
    if (open && deploymentMode === 'wallet' && isConnected) {
      refreshBalance();
    }
  }, [open, deploymentMode, isConnected, refreshBalance]);

  // Check factory availability when wallet mode is selected
  useEffect(() => {
    if (open && deploymentMode === 'wallet') {
      setIsCheckingFactory(true);
      // Use user's selected RPC for checking factory availability
      checkFactoryAvailability(network, getCurrentRpcUrl(network))
        .then(available => {
          setFactoryAvailable(available);
        })
        .catch(() => {
          setFactoryAvailable(false);
        })
        .finally(() => {
          setIsCheckingFactory(false);
        });
    }
  }, [open, deploymentMode, network, getCurrentRpcUrl]);

  const handlePlaygroundDeploy = async () => {
    if (showABIError) return;
    if (!user) {
      setDeploymentError("Authentication required");
      return;
    }

    setIsDeploying(true);
    setDeploymentError(null);

    try {
      // Note: We don't compare project.code with code_snapshot anymore because:
      // - Multi-file editor saves to backend filesystem, not to projects.code column
      // - The comparison was always failing even after successful compilation
      // - Deployment uses WASM from the last compilation anyway

      // Pass the selected RPC URL for playground deployment
      const rpcUrl = getCurrentRpcUrl('testnet');
      const result = await deployContract(user.id, projectId, rpcUrl);
      setDeploymentResult(result);

      const { error: dbError } = await supabase
        .from('deployments')
        .insert({
          project_id: projectId,
          contract_address: result.contract_id,
          chain_id: 1,
          chain_name: 'NEAR Testnet',
          deployed_code: lastCompilation?.code_snapshot || '',
          abi: lastCompilation?.abi || {},
          metadata: {
            deployment_time: result.details.timestamp,
            tx_hash: result.transaction_hash,
            gas_used: result.gas_used,
            block_height: result.details.block_height,
            deployer_account: result.details.deployer_account,
            explorer_url: result.explorer_url,
            network: result.details.network,
            wallet_type: 'playground',
            wallet_address: result.details.deployer_account,
            wasm_hash: result.wasm_hash,
          }
        });

      if (dbError) throw dbError;

      onDeploySuccess?.();

      toast({
        title: "Success",
        description: "Contract deployed successfully to NEAR testnet",
      });
    } catch (error) {
      console.error('Deployment error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to deploy contract";
      setDeploymentError(errorMessage);
      toast({
        title: "Deployment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleWalletDeploy = async () => {
    if (showABIError) return;
    if (!user || !selector || !accountId) {
      setDeploymentError("Wallet not connected");
      return;
    }

    if (!lastCompilation?.success) {
      setDeploymentError("Please compile your project before deploying.");
      return;
    }

    setIsDeploying(true);
    setDeploymentError(null);

    try {
      const result = await deployWithWallet({
        selector,
        userId: user.id,
        projectId,
        targetAccountId: accountId,
        network,
      });

      setDeploymentResult(result);

      const { error: dbError } = await supabase
        .from('deployments')
        .insert({
          project_id: projectId,
          contract_address: result.contractId,
          chain_id: network === 'mainnet' ? 0 : 1,
          chain_name: network === 'mainnet' ? 'NEAR Mainnet' : 'NEAR Testnet',
          deployed_code: lastCompilation?.code_snapshot || '',
          abi: lastCompilation?.abi || {},
          metadata: {
            tx_hash: result.transactionHash,
            explorer_url: result.explorerUrl,
            network,
            block_height: result.blockHeight,
            wallet_type: 'external',
            wallet_address: accountId,
            wallet_name: walletId || 'Unknown Wallet',
            wasm_hash: result.wasm_hash,
          }
        });

      if (dbError) console.error('Failed to save deployment:', dbError);

      onDeploySuccess?.();

      toast({
        title: "Success",
        description: `Contract deployed successfully to NEAR ${network}`,
      });
    } catch (error) {
      console.error('Wallet deployment error:', error);

      if (error instanceof WalletDeploymentNotSupportedError) {
        setDeploymentError(error.message);
        toast({
          title: "Wallet Deployment Not Available",
          description: "Please use Playground mode for now. Factory deployment coming soon!",
          variant: "destructive",
        });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Failed to deploy contract";
      setDeploymentError(errorMessage);
      toast({
        title: "Deployment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDeploy = () => {
    if (deploymentMode === 'wallet') {
      handleWalletDeploy();
    } else {
      handlePlaygroundDeploy();
    }
  };

  const handleModeSwitch = (mode: DeploymentMode) => {
    setDeploymentMode(mode);
    if (mode === 'wallet' && !isConnected) {
      connectWallet();
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: "Copied",
      description: `${field === 'address' ? 'Contract address' : 'Transaction hash'} copied to clipboard`,
    });
  };

  const wasmSizeKB = lastCompilation?.details?.wasm_size
    ? (lastCompilation.details.wasm_size / 1024).toFixed(1)
    : null;

  const estimatedCost = deploymentMode === 'playground'
    ? 'Free'
    : wasmSizeKB
      ? `~${formatYoctoNear(estimateDeploymentCost(lastCompilation!.details.wasm_size!))}`
      : null;

  const getContractId = () => {
    if (!deploymentResult) return '';
    return 'contract_id' in deploymentResult
      ? deploymentResult.contract_id
      : deploymentResult.contractId;
  };

  const getTransactionHash = () => {
    if (!deploymentResult) return '';
    return 'transaction_hash' in deploymentResult
      ? deploymentResult.transaction_hash
      : deploymentResult.transactionHash;
  };

  const getExplorerUrl = () => {
    if (!deploymentResult) return '';
    return 'explorer_url' in deploymentResult
      ? deploymentResult.explorer_url
      : deploymentResult.explorerUrl;
  };

  // Get the account explorer URL - uses stored URL for wallet deployments to preserve correct network
  const getAccountExplorerUrl = () => {
    if (!deploymentResult) return '';
    // For wallet deployments, use the stored explorerAccountUrl (captures correct network at deployment time)
    if ('explorerAccountUrl' in deploymentResult && deploymentResult.explorerAccountUrl) {
      return deploymentResult.explorerAccountUrl;
    }
    // For playground deployments (always testnet), generate the URL
    const contractId = getContractId();
    return getExplorerAccountUrl(contractId); // defaults to testnet
  };

  // ABI Error State
  if (showABIError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              ABI Not Found
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-none mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm">
                    No valid ABI found for your contract. This usually happens when:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                    <li>The contract hasn't been compiled successfully</li>
                    <li>The last compilation failed</li>
                    <li>The contract doesn't expose any public methods</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                onCompile?.();
              }}
              className="gap-2"
            >
              <Terminal className="h-4 w-4" />
              Compile Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RocketIcon className="h-5 w-5" />
              Deploy Contract
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Wallet/Mode Section */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {deploymentMode === 'playground' ? (
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-md">
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  ) : (
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-md">
                      <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">
                      {deploymentMode === 'playground' ? 'Playground Wallet' : 'External Wallet'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {deploymentMode === 'playground' ? (
                        'Free testnet deployment • We fund the account for you'
                      ) : isConnected ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getWalletDisplayName(walletId)}</span>
                          <span>•</span>
                          <span className="font-mono">{accountId?.slice(0, 12)}...{accountId?.slice(-6)}</span>
                          {accountBalance && (
                            <>
                              <span>•</span>
                              <span>{formatNearAmount(accountBalance.available)} NEAR</span>
                            </>
                          )}
                        </div>
                      ) : (
                        'Not connected'
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModeSwitch(deploymentMode === 'playground' ? 'wallet' : 'playground')}
                  className="gap-1"
                >
                  <ChevronRight className="h-4 w-4" />
                  Switch
                </Button>
              </div>

              <Separator className="my-3" />

              {/* Network & RPC Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">NEAR {currentNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'}</span>
                  <Badge variant="secondary" className="text-xs">
                    {currentNetwork}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select
                    value={currentProviderId}
                    onValueChange={(value) => setProvider(currentNetwork, value)}
                  >
                    <SelectTrigger className="h-7 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Factory not available warning for wallet mode */}
              {deploymentMode === 'wallet' && !isCheckingFactory && factoryAvailable === false && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <p className="text-amber-800 dark:text-amber-200 font-medium">
                        Factory not available on {network}
                      </p>
                      <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                        Use Playground mode for free testnet deployment
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Factory available info for wallet mode */}
              {deploymentMode === 'wallet' && !isCheckingFactory && factoryAvailable === true && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 text-sm space-y-2">
                      <p className="text-blue-800 dark:text-blue-200">
                        This deployment uses{' '}
                        <a
                          href={getExplorerAccountUrl(network === 'mainnet' ? 'factory.nearplay-app.near' : 'factory.nearplay.testnet', network)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline hover:no-underline"
                        >
                          {network === 'mainnet' ? 'factory.nearplay-app.near' : 'factory.nearplay.testnet'}
                        </a>
                        {' '}to create your contract account.
                      </p>
                      <p className="text-blue-700 dark:text-blue-300 text-xs">
                        The factory allows deploying contracts from your browser wallet without exposing private keys.
                        Your contract will be created as a sub-account of the factory.
                      </p>
                      {network === 'mainnet' && (
                        <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded border border-amber-300 dark:border-amber-800">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <p className="text-amber-800 dark:text-amber-200 text-xs">
                              <strong>Caution:</strong> Never deploy financially critical applications via Playground.
                              For production contracts handling real funds, use{' '}
                              <a
                                href="https://github.com/near/cargo-near"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:no-underline"
                              >
                                cargo-near CLI
                              </a>
                              {' '}with proper key management.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Contract Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Contract Size</span>
                </div>
                <div className="font-semibold">
                  {wasmSizeKB ? (
                    <>{wasmSizeKB} KB</>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">{deploymentMode === 'playground' ? 'Cost' : 'Est. Gas'}</span>
                </div>
                <div className="font-semibold">
                  {estimatedCost ? (
                    <>{estimatedCost}{deploymentMode !== 'playground' && ' NEAR'}</>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </div>
              </div>
            </div>

            {/* Warning Banner */}
            {!deploymentResult && !deploymentError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div className="text-sm space-y-1">
                  <div className="text-yellow-800 dark:text-yellow-200 font-medium">
                    This will deploy your last compiled contract
                  </div>
                  <div className="text-yellow-700 dark:text-yellow-300 text-xs">
                    Make sure to compile again if you've made changes
                  </div>
                </div>
              </div>
            )}

            {/* Deployment Error */}
            {deploymentError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-destructive">Deployment Failed</div>
                  <div className="text-muted-foreground mt-1">{deploymentError}</div>
                </div>
              </div>
            )}

            {/* Deployment Success */}
            {deploymentResult?.success && (
              <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">Deployment Successful</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Contract:</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                        {getContractId().slice(0, 20)}...
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopy(getContractId(), 'address')}
                      >
                        {copiedField === 'address' ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(getAccountExplorerUrl(), '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {getTransactionHash() && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Transaction:</span>
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {getTransactionHash().slice(0, 12)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopy(getTransactionHash(), 'tx')}
                        >
                          {copiedField === 'tx' ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => window.open(getExplorerUrl(), '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {deploymentResult?.success ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowVerificationModal(true)}
                  className="gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Verify Source
                </Button>
                <Button onClick={() => onOpenChange(false)} className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Done
                </Button>
              </>
            ) : deploymentError ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleDeploy} className="gap-2">
                  <RocketIcon className="h-4 w-4" />
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isDeploying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeploy}
                  disabled={
                    isDeploying ||
                    (deploymentMode === 'wallet' && !isConnected) ||
                    (deploymentMode === 'wallet' && factoryAvailable === false) ||
                    (deploymentMode === 'wallet' && isCheckingFactory)
                  }
                  className="gap-2"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deploying...
                    </>
                  ) : deploymentMode === 'wallet' && !isConnected ? (
                    <>
                      <Wallet className="h-4 w-4" />
                      Connect Wallet
                    </>
                  ) : (
                    <>
                      <RocketIcon className="h-4 w-4" />
                      Deploy Contract
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification Modal */}
      {user && deploymentResult?.success && (
        <VerificationModal
          open={showVerificationModal}
          onOpenChange={setShowVerificationModal}
          userId={user.id}
          projectId={projectId}
          contractId={getContractId()}
          wasmHash={'wasm_hash' in deploymentResult ? deploymentResult.wasm_hash : undefined}
          network={deploymentMode === 'wallet' ? network : 'testnet'}
        />
      )}
    </>
  );
}
