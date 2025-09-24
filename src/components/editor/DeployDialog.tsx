import { useState, useEffect, useRef } from 'react';
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
  RocketIcon,
  CheckCircle,
  Terminal,
  Loader2,
  ExternalLink,
  Copy,
  AlertCircle,
  PlayCircle,
  X,
  FileCode2,
  Globe,
  Wallet,
  Server,
  Eye,
  Play,
  Coins,
} from 'lucide-react';
import { CompilationResult, DeploymentResult } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { deployContract } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/App';
import { getExplorerAccountUrl } from '@/lib/config';

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
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Reset deployment result when dialog is opened
  useEffect(() => {
    if (open) {
      setDeploymentResult(null);
      setDeploymentError(null);
      setIsDeploying(false);
      setCountdown(null);
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    }
  }, [open]);


  const handleDeploy = async () => {
    if (showABIError) return;

    setIsDeploying(true);
    setDeploymentError(null);
    try {
      if (!user) throw new Error("Authentication required");

      // Check if code has changed since last compilation
      const { data: project } = await supabase
        .from('projects')
        .select('code')
        .eq('id', projectId)
        .single();

      if (project && project.code !== lastCompilation?.code_snapshot) {
        throw new Error("Code has changed since last compilation. Please compile again before deploying.");
      }

      // Deploy the contract
      const result = await deployContract(user.id, projectId);
      setDeploymentResult(result);

      // Save deployment to database
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
          }
        });

      if (dbError) throw dbError;

      // Trigger ABI refresh immediately after successful deployment
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

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: "Copied",
      description: `${field === 'address' ? 'Contract address' : 'Transaction hash'} copied to clipboard`,
    });
  };

  // Extract metrics from compilation
  const wasmSizeKB = lastCompilation?.details?.wasm_size
    ? (lastCompilation.details.wasm_size / 1024).toFixed(2)
    : null;


  if (showABIError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              ABI Not Found
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-none mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm">
                    No valid ABI found for your contract. This usually happens when:
                  </p>
                  <ul className="text-sm space-y-1 list-disc pl-4">
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[720px] max-h-[85vh] overflow-hidden"
        onInteractOutside={(e) => {
          if (!isDeploying) {
            e.preventDefault();
            onOpenChange(false);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RocketIcon className="h-4 w-4" />
            Deploy Contract
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(85vh-140px)]">
          <div className="space-y-4 py-4">
            {/* Network Information */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/10 rounded-md">
                  <Globe className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">NEAR Testnet</div>
                  <div className="text-xs text-muted-foreground">rpc.testnet.near.org</div>
                </div>
              </div>

              <div className="border-t" />

              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-500/10 rounded-md">
                  <Wallet className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">New Account for Every Development</div>
                  <div className="text-xs text-muted-foreground">Each deployment creates a new sub-account funded with 2 NEAR</div>
                </div>
              </div>

              {wasmSizeKB && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/10 rounded-md">
                    <Server className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Contract Size</div>
                    <div className="text-xs text-muted-foreground">{wasmSizeKB} KB optimized WASM</div>
                  </div>
                </div>
              )}
            </div>

            {/* ABI Interface */}
            {(() => {
              // Extract functions from ABI
              let functions = [];
              if (Array.isArray(lastCompilation?.abi)) {
                functions = lastCompilation.abi;
              } else if (lastCompilation?.abi?.body?.functions) {
                functions = lastCompilation.abi.body.functions;
              } else if (lastCompilation?.abi) {
                functions = Object.values(lastCompilation.abi).flat();
              }

              if (functions.length > 0) {
                return (
                  <>
                    <div className="border-t" />
                    <div className="space-y-3">
                      <div className="text-sm font-medium">Contract Interface</div>
                      <div className="space-y-2">
                        {functions.map((func, index) => {
                          const isView = func.stateMutability === 'view' || func.kind === 'view';
                          const isPayable = func.stateMutability === 'payable' || func.payable;

                          // Format parameters - Handle NEAR ABI format
                          let params = [];
                          if (func.params && func.params.args) {
                            params = func.params.args.map((arg: any) => {
                              // Convert type_schema to simple type string (same logic as ABIView)
                              let type = 'string'; // default
                              if (arg.type_schema) {
                                // Handle format-based types FIRST (prefer format over type analysis)
                                if (arg.type_schema.format) {
                                  type = arg.type_schema.format; // e.g., "int8", "uint64"
                                }
                                // Handle $ref types (like AccountId, NFTContractMetadata)
                                else if (arg.type_schema.$ref) {
                                  // Extract type name from reference
                                  const refName = arg.type_schema.$ref.split('/').pop();
                                  if (refName === 'AccountId') {
                                    type = 'AccountId';
                                  } else {
                                    type = refName || 'object';
                                  }
                                }
                                // Handle anyOf types (Optional types like Option<AccountId>)
                                else if (arg.type_schema.anyOf) {
                                  // Look for the non-null type in the anyOf array
                                  const nonNullType = arg.type_schema.anyOf.find((t: any) => t.type !== 'null');
                                  if (nonNullType) {
                                    if (nonNullType.$ref) {
                                      const refName = nonNullType.$ref.split('/').pop();
                                      type = refName === 'AccountId' ? 'AccountId' : (refName || 'object');
                                    } else if (nonNullType.type) {
                                      type = nonNullType.type;
                                    } else if (nonNullType.format) {
                                      type = nonNullType.format;
                                    }
                                  } else {
                                    type = 'object'; // fallback for complex anyOf
                                  }
                                }
                                // Handle direct type specification
                                else if (arg.type_schema.type) {
                                  if (Array.isArray(arg.type_schema.type)) {
                                    // Handle union types like ["integer", "null"] or ["string", "null"] or ["boolean", "null"]
                                    // Check if format exists at the same level (outside the type array)
                                    if (arg.type_schema.format) {
                                      type = arg.type_schema.format;
                                    } else if (arg.type_schema.type.includes('integer')) {
                                      type = 'integer';
                                    } else if (arg.type_schema.type.includes('string')) {
                                      type = 'string';
                                    } else if (arg.type_schema.type.includes('boolean')) {
                                      type = 'boolean';
                                    } else if (arg.type_schema.type.includes('object')) {
                                      type = 'object';
                                    } else if (arg.type_schema.type.includes('array')) {
                                      type = 'array';
                                    }
                                  } else {
                                    // Single type
                                    if (arg.type_schema.type === 'integer') {
                                      type = 'integer';
                                    } else if (arg.type_schema.type === 'string') {
                                      type = 'string';
                                    } else if (arg.type_schema.type === 'boolean') {
                                      type = 'boolean';
                                    } else if (arg.type_schema.type === 'object') {
                                      type = 'object';
                                    } else if (arg.type_schema.type === 'array') {
                                      type = 'array';
                                    }
                                  }
                                }
                              }

                              return {
                                name: arg.name,
                                type: type
                              };
                            });
                          } else if (func.inputs) {
                            // Fallback for non-NEAR ABI format
                            params = func.inputs;
                          }

                          const paramString = params.map(param => {
                            return `${param.name}: ${param.type}`;
                          }).join(', ');

                          let iconBg = 'bg-blue-500/10';
                          let icon = <Play className="h-4 w-4 text-blue-500" />;
                          let typeColor = 'text-blue-600';
                          let typeText = 'call';

                          if (isView) {
                            iconBg = 'bg-green-500/10';
                            icon = <Eye className="h-4 w-4 text-green-500" />;
                            typeColor = 'text-green-600';
                            typeText = 'view';
                          } else if (isPayable) {
                            iconBg = 'bg-yellow-500/10';
                            icon = <Coins className="h-4 w-4 text-yellow-500" />;
                            typeColor = 'text-yellow-600';
                            typeText = 'payable';
                          }

                          return (
                            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                              <div className={`p-2 ${iconBg} rounded-md`}>
                                {icon}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-medium">{func.name}</span>
                                  <Badge variant="outline" className={`text-xs ${typeColor} border-current`}>
                                    {typeText}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {paramString || 'no parameters'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              }
              return null;
            })()}


            {/* Deployment Status */}
            {isDeploying && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div className="flex-1">
                  <p className="text-sm">Deploying contract to NEAR Testnet...</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This may take a few seconds</p>
                </div>
              </div>
            )}

            {/* Deployment Success */}
            {deploymentResult?.success && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/50 bg-green-500/5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Deployment Successful</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Contract deployed to NEAR Testnet
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border rounded-lg p-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Contract Address</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm bg-muted/50 px-3 py-2 rounded border">
                        {deploymentResult.contract_id}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopy(deploymentResult.contract_id, 'address')}
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
                        className="h-8 w-8"
                        onClick={() => window.open(getExplorerAccountUrl(deploymentResult.contract_id), '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Transaction Hash</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm bg-muted/50 px-3 py-2 rounded border truncate">
                        {deploymentResult.transaction_hash}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopy(deploymentResult.transaction_hash, 'tx')}
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
                        className="h-8 w-8"
                        onClick={() => window.open(deploymentResult.explorer_url, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Additional Details - Clean grid */}
                  {(deploymentResult.gas_used || deploymentResult.details?.block_height) && (
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                      {deploymentResult.gas_used && (
                        <div>
                          <span className="text-xs text-muted-foreground">Gas Used</span>
                          <div className="font-mono text-sm mt-1">{deploymentResult.gas_used}</div>
                        </div>
                      )}
                      {deploymentResult.details?.block_height && (
                        <div>
                          <span className="text-xs text-muted-foreground">Block Height</span>
                          <div className="font-mono text-sm mt-1">{deploymentResult.details.block_height}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Deployment Error */}
            {deploymentError && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/50 bg-red-500/5">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                <div className="flex-1">
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
                onClick={() => {
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                View Contract Interface
              </Button>
            </>
          ) : deploymentError ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDeploy}
                className="gap-2"
              >
                <RocketIcon className="h-4 w-4" />
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
                disabled={isDeploying || showABIError}
                className="gap-2"
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <RocketIcon className="h-4 w-4" />
                    Deploy
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}