import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
  PlayCircle,
  Globe,
  Wallet,
  Server,
  Eye,
  Play,
  Coins,
  Shield,
  Zap,
  AlertTriangle,
  RefreshCw,
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
  getExplorerAccountUrl as getWalletExplorerAccountUrl,
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
      checkFactoryAvailability(network)
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
  }, [open, deploymentMode, network]);

  const handlePlaygroundDeploy = async () => {
    if (showABIError) return;
    if (!user) {
      setDeploymentError("Authentication required");
      return;
    }

    setIsDeploying(true);
    setDeploymentError(null);

    try {
      const { data: project } = await supabase
        .from('projects')
        .select('code')
        .eq('id', projectId)
        .single();

      if (project && project.code !== lastCompilation?.code_snapshot) {
        throw new Error("Code has changed since last compilation. Please compile again before deploying.");
      }

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

    // Check if project is compiled
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

      // Handle specific error types
      if (error instanceof WalletDeploymentNotSupportedError) {
        setDeploymentError(error.message);
        toast({
          title: "Wallet Deployment Not Available",
          description: "Please use Playground mode for now. Factory deployment coming soon!",
          variant: "destructive",
        });
        return;
      }

      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to deploy contract";

      // Format better error messages
      if (errorMessage.includes('Cannot connect to backend')) {
        setDeploymentError("Cannot connect to the backend server. Please ensure the server is running.");
      } else if (errorMessage.includes('rejected') || errorMessage.includes('cancelled')) {
        setDeploymentError("Transaction was cancelled or rejected by wallet.");
      } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        setDeploymentError("Insufficient balance. Factory deployment requires ~3 NEAR deposit.");
      } else {
        setDeploymentError(errorMessage);
      }

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
    ? (lastCompilation.details.wasm_size / 1024).toFixed(2)
    : null;

  const estimatedCost = wasmSizeKB
    ? formatYoctoNear(estimateDeploymentCost(lastCompilation!.details.wasm_size!))
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

  if (showABIError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              ABI Not Found
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm mb-2">
                No valid ABI found for your contract. This usually happens when:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                <li>The contract hasn't been compiled successfully</li>
                <li>The last compilation failed</li>
                <li>The contract doesn't expose any public methods</li>
              </ul>
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
            >
              <Terminal className="h-4 w-4 mr-2" />
              Compile Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[85vh] overflow-hidden"
        onInteractOutside={(e) => {
          if (!isDeploying) {
            e.preventDefault();
            onOpenChange(false);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RocketIcon className="h-5 w-5" />
            Deploy Contract
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(85vh-160px)]">
          <div className="space-y-4 py-2">
            {/* Deployment Mode Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Deployment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleModeSwitch('playground')}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                    deploymentMode === 'playground'
                      ? 'border-primary bg-muted'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <Zap className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Playground</span>
                      {deploymentMode === 'playground' && (
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Free testnet</span>
                  </div>
                </button>

                <button
                  onClick={() => handleModeSwitch('wallet')}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                    deploymentMode === 'wallet'
                      ? 'border-primary bg-muted'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">External Wallet</span>
                      {deploymentMode === 'wallet' && (
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Your wallet</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Mode-specific Content */}
            {deploymentMode === 'playground' ? (
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-3">
                  <Zap className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Playground Wallet</p>
                    <p className="text-xs text-muted-foreground">
                      Free deployment with 2 NEAR funded. Testnet only.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Factory Availability Check */}
                {isCheckingFactory && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Checking deployment availability...</span>
                  </div>
                )}

                {/* Factory Not Available Warning */}
                {!isCheckingFactory && factoryAvailable === false && (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Factory Contract Not Available</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Wallet deployment requires a factory contract that isn't deployed yet on {network}.
                          For security reasons, NEAR wallets don't allow direct contract deployment.
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 mt-2 text-xs"
                          onClick={() => handleModeSwitch('playground')}
                        >
                          Switch to Playground mode (recommended)
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Factory Available Success */}
                {!isCheckingFactory && factoryAvailable === true && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">Factory Deployment Available</p>
                      <p className="text-xs text-muted-foreground">
                        Your contract will be deployed to a sub-account via our factory. Requires ~3 NEAR deposit.
                      </p>
                    </div>
                  </div>
                )}

                {/* Mainnet Warning */}
                {network === 'mainnet' && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Mainnet Deployment</p>
                      <p className="text-xs text-muted-foreground">
                        This will use real NEAR tokens.
                      </p>
                    </div>
                  </div>
                )}

                {/* Wallet Connection Status */}
                {isConnected && accountId ? (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-xs text-muted-foreground">Connected via</span>
                        <span className="text-xs font-medium">
                          {getWalletDisplayName(walletId)}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                      </Badge>
                    </div>
                    <p className="font-mono text-sm truncate mb-2">{accountId}</p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <span className="text-xs text-muted-foreground">Balance</span>
                        <p className="text-sm font-medium">
                          {isLoadingBalance ? (
                            'Loading...'
                          ) : accountBalance ? (
                            `${formatNearAmount(accountBalance.available)} NEAR`
                          ) : (
                            '--'
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={refreshBalance}
                        disabled={isLoadingBalance}
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", isLoadingBalance && "animate-spin")} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed text-center">
                    <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Connect your wallet to deploy
                    </p>
                    <Button size="sm" onClick={connectWallet}>
                      Connect Wallet
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* RPC Provider Selector */}
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">RPC Provider</span>
                </div>
                <Select
                  value={currentProviderId}
                  onValueChange={(value) => setProvider(currentNetwork, value)}
                >
                  <SelectTrigger className="h-7 w-[160px] text-xs">
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
              <p className="text-xs text-muted-foreground font-mono mt-1.5 truncate">
                {getCurrentRpcUrl(currentNetwork)}
              </p>
            </div>

            {/* Contract Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Network</span>
                </div>
                <p className="text-sm font-medium">
                  NEAR {currentNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </p>
              </div>
              {wasmSizeKB && (
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Size</span>
                  </div>
                  <p className="text-sm font-medium">{wasmSizeKB} KB</p>
                  {estimatedCost && deploymentMode === 'wallet' && (
                    <p className="text-xs text-muted-foreground">~{estimatedCost} NEAR</p>
                  )}
                </div>
              )}
            </div>

            {/* ABI Preview */}
            {(() => {
              let functions: any[] = [];
              if (Array.isArray(lastCompilation?.abi)) {
                functions = lastCompilation.abi;
              } else if (lastCompilation?.abi?.body?.functions) {
                functions = lastCompilation.abi.body.functions;
              } else if (lastCompilation?.abi) {
                functions = Object.values(lastCompilation.abi).flat();
              }

              if (functions.length > 0) {
                return (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Contract Methods ({functions.length})
                    </label>
                    <div className="space-y-1.5">
                      {functions.slice(0, 4).map((func: any, index: number) => {
                        const isView = func.stateMutability === 'view' || func.kind === 'view';
                        const isPayable = func.stateMutability === 'payable' || func.payable;

                        return (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                            {isView ? (
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : isPayable ? (
                              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <Play className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="font-mono text-xs flex-1">{func.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {isView ? 'view' : isPayable ? 'payable' : 'call'}
                            </Badge>
                          </div>
                        );
                      })}
                      {functions.length > 4 && (
                        <p className="text-xs text-center text-muted-foreground">
                          +{functions.length - 4} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Deployment Status */}
            {isDeploying && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div>
                  <p className="text-sm font-medium">
                    Deploying to NEAR {currentNetwork}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {deploymentMode === 'wallet'
                      ? 'Please confirm in your wallet'
                      : 'This may take a few seconds'}
                  </p>
                </div>
              </div>
            )}

            {/* Deployment Success */}
            {deploymentResult?.success && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Deployment Successful</p>
                    <p className="text-xs text-muted-foreground">
                      Contract deployed to NEAR {currentNetwork}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 p-3 border rounded-lg">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Contract Address</label>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 font-mono text-xs bg-muted px-2 py-1.5 rounded border truncate">
                        {getContractId()}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleCopy(getContractId(), 'address')}
                      >
                        {copiedField === 'address' ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          const url = deploymentMode === 'wallet'
                            ? getWalletExplorerAccountUrl(getContractId(), network)
                            : getExplorerAccountUrl(getContractId());
                          window.open(url, '_blank');
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Transaction Hash</label>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 font-mono text-xs bg-muted px-2 py-1.5 rounded border truncate">
                        {getTransactionHash()}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleCopy(getTransactionHash(), 'tx')}
                      >
                        {copiedField === 'tx' ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(getExplorerUrl(), '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Deployment Error */}
            {deploymentError && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Deployment Failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{deploymentError}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          {deploymentResult?.success ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowVerificationModal(true)}
              >
                <Shield className="h-4 w-4 mr-2" />
                Verify Source
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                <PlayCircle className="h-4 w-4 mr-2" />
                View Contract
              </Button>
            </>
          ) : deploymentError ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleDeploy}>
                <RocketIcon className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDeploy}
                disabled={
                  isDeploying ||
                  showABIError ||
                  (deploymentMode === 'wallet' && !isConnected) ||
                  (deploymentMode === 'wallet' && factoryAvailable === false) ||
                  (deploymentMode === 'wallet' && isCheckingFactory)
                }
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {deploymentMode === 'wallet' ? 'Confirm in Wallet...' : 'Deploying...'}
                  </>
                ) : (
                  <>
                    <RocketIcon className="h-4 w-4 mr-2" />
                    Deploy
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

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
    </Dialog>
  );
}
