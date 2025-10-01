import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ABIMethod, Deployment } from '@/lib/types';
import { ABIMethodCard } from '@/components/abi/ABIMethodCard';
import { ABIEmptyState } from '@/components/abi/ABIEmptyState';
import { ABIContractSelector } from '@/components/abi/ABIContractSelector';
import { ABIExecuteDialog } from '@/components/abi/ABIExecuteDialog';
import { ABIExecutionHistory } from '@/components/abi/ABIExecutionHistory';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { History, PlayCircle, Rocket } from 'lucide-react';

interface ABIViewProps {
  projectId: string;
  isSharedView?: boolean;
  onDeploy?: () => void;
  onRequestDeploy?: () => void;
  refreshTrigger?: number;
}

export function ABIView({ projectId, isSharedView = false, onDeploy, onRequestDeploy, refreshTrigger }: ABIViewProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [isContractVerified, setIsContractVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<ABIMethod | null>(null);
  const [activeView, setActiveView] = useState<'interface' | 'history'>('interface');
  const [isLoading, setIsLoading] = useState(true);
  const [currentInterfacePage, setCurrentInterfacePage] = useState(1);
  const interfaceItemsPerPage = 7;
  const { toast } = useToast();

  const verifyContract = async (address: string) => {
    try {
      // For NEAR, we'll implement contract verification differently
      // For now, assume contracts are valid if they have an address
      return address && address.length > 0;
    } catch (error) {
      console.error('Error verifying contract:', error);
      // Don't throw error, just return false
      return false;
    }
  };


  const fetchDeployments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('deployments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDeployments(data || []);
      
      // Select the most recent deployment by default
      if (data && data.length > 0) {
        const mostRecent = data[0];
        setSelectedDeployment(mostRecent);
        setCurrentInterfacePage(1); // Reset pagination
        // Verify the contract
        const isValid = await verifyContract(mostRecent.contract_address);
        setIsContractVerified(isValid);
      } else {
        // No deployments, try to get ABI from compilation history
        const { data: compilationData, error: compilationError } = await supabase
          .from('compilation_history')
          .select('abi')
          .eq('project_id', projectId)
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!compilationError && compilationData && compilationData.length > 0 && compilationData[0].abi) {
          // Create a mock deployment with ABI from compilation
          const mockDeployment = {
            id: 'compilation-only',
            project_id: projectId,
            contract_address: '',
            abi: compilationData[0].abi,
            deployment_time: new Date().toISOString(),
            transaction_hash: '',
            block_height: 0,
            chain_id: 1,
            created_at: new Date().toISOString(),
          };
          setSelectedDeployment(mockDeployment as any);
          setIsContractVerified(false);
        }
      }
    } catch (error) {
      console.error('Error fetching deployments:', error);
      toast({
        title: "Error",
        description: "Failed to load deployments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch deployments when component mounts or when refreshTrigger changes
  useEffect(() => {
    fetchDeployments();
  }, [projectId, refreshTrigger]);

  const handleAddressChange = async (address: string) => {
    setError(null);
    setIsContractVerified(false);

    const deployment = deployments.find(d => d.contract_address === address);
    if (!deployment) {
      setError('Deployment not found');
      return;
    }

    setSelectedDeployment(deployment);

    try {
      const isValid = await verifyContract(address);
      setIsContractVerified(isValid);
      if (!isValid) {
        setError('Contract not found on NEAR testnet');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to verify contract');
    }
  };

  const handleExecute = (method: ABIMethod) => {
    if (isSharedView) {
      toast({
        title: "Read-only View",
        description: "Contract execution is disabled in shared view",
      });
      return;
    }
    setSelectedMethod(method);
  };

  return (
    <div className="h-full flex flex-col bg-background border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md">
            <PlayCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Contract Interface</h3>
            <p className="text-xs text-muted-foreground">
              {isSharedView 
                ? "View deployed contract methods and execution history"
                : "Make calls to your deployed contract on NEAR testnet"
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeView === 'interface' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-2"
            onClick={() => setActiveView('interface')}
          >
            <PlayCircle className="h-4 w-4" />
            Interface
          </Button>
          <Button
            variant={activeView === 'history' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-2"
            onClick={() => setActiveView('history')}
          >
            <History className="h-4 w-4" />
            History
          </Button>
        </div>
      </div>

      {/* Show contract selector for both tabs */}
      <ABIContractSelector
        contractAddress={selectedDeployment?.contract_address || ''}
        onAddressChange={handleAddressChange}
        error={error}
        deployments={deployments}
        isLoading={isLoading}
      />

      {activeView === 'interface' ? (
        <>
          {selectedDeployment ? (
            <div className="flex-1 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* Show banner for compilation-only ABI */}
                  {selectedDeployment && !selectedDeployment.contract_address && (
                    <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-md flex-shrink-0">
                            <Rocket className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium mb-1">Contract Methods Preview</h4>
                            <p className="text-xs text-muted-foreground">
                              These methods are available in your compiled contract. Deploy to NEAR testnet to interact with them.
                            </p>
                          </div>
                        </div>
                        {!isSharedView && onRequestDeploy && (
                          <Button
                            onClick={onRequestDeploy}
                            size="sm"
                            className="gap-2"
                          >
                            <Rocket className="h-3.5 w-3.5" />
                            Deploy
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className={`space-y-2 ${selectedDeployment && !selectedDeployment.contract_address ? 'opacity-60' : ''}`}>
                  {(() => {
                    // Handle both array format and NEAR ABI object format
                    let methods = [];

                    if (Array.isArray(selectedDeployment.abi)) {
                      methods = selectedDeployment.abi;
                    } else if (selectedDeployment.abi?.body?.functions) {
                      methods = selectedDeployment.abi.body.functions;
                    } else if (selectedDeployment.abi) {
                      // Try to extract from any object structure
                      methods = Object.values(selectedDeployment.abi).flat();
                    }

                    // Filter out private and init methods (not callable externally)
                    methods = methods.filter((method: any) => {
                      const modifiers = method.modifiers || [];
                      return !modifiers.includes('private') && !modifiers.includes('init');
                    });

                    // Ensure each method has required fields and convert NEAR ABI format
                    methods = methods.map((method: any) => {
                      // Convert NEAR ABI format to standard format
                      let inputs = method.inputs || [];
                      let outputs = method.outputs || [];

                      // Handle NEAR ABI params format
                      if (method.params && method.params.args) {
                        inputs = method.params.args.map((arg: any) => {
                          // Convert type_schema to simple type string
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
                            type: type,
                            internalType: type
                          };
                        });
                      }

                      // Handle NEAR ABI result format
                      if (method.result && method.result.type_schema) {
                        const resultSchema = method.result.type_schema;
                        let type = 'string'; // default
                        if (resultSchema.format) {
                          type = resultSchema.format;
                        } else if (resultSchema.type === 'integer') {
                          type = resultSchema.format || 'i32';
                        } else if (resultSchema.type === 'string') {
                          type = 'string';
                        } else if (resultSchema.type === 'boolean') {
                          type = 'bool';
                        }

                        outputs = [{
                          name: '',
                          type: type,
                          internalType: type
                        }];
                      }

                      // Determine stateMutability based on NEAR ABI kind and modifiers
                      let stateMutability = 'nonpayable';
                      const modifiers = method.modifiers || [];

                      if (method.kind === 'view') {
                        stateMutability = 'view';
                      } else if (modifiers.includes('payable')) {
                        stateMutability = 'payable';
                      } else if (method.kind === 'call') {
                        stateMutability = 'nonpayable';
                      }

                      return {
                        ...method,
                        type: method.type || 'function',
                        stateMutability: method.stateMutability || stateMutability,
                        inputs: inputs,
                        outputs: outputs
                      };
                    });

                    // Calculate pagination for interface
                    const totalInterfacePages = Math.ceil(methods.length / interfaceItemsPerPage);
                    const startIndex = (currentInterfacePage - 1) * interfaceItemsPerPage;
                    const endIndex = startIndex + interfaceItemsPerPage;
                    const currentMethods = methods.slice(startIndex, endIndex);

                    // Store methods count for pagination display
                    const methodsCount = methods.length;

                    return (
                      <>
                        {/* Methods count info */}
                        {methodsCount > 0 && (
                          <div className="text-sm text-muted-foreground mb-2">
                            {methodsCount} {methodsCount === 1 ? 'method' : 'methods'} available
                            {methodsCount > interfaceItemsPerPage && ` • Page ${currentInterfacePage} of ${totalInterfacePages}`}
                          </div>
                        )}

                        {/* Method cards */}
                        {currentMethods.map((method, index) => (
                          <ABIMethodCard
                            key={startIndex + index}
                            method={method}
                            onExecute={handleExecute}
                            isContractVerified={isContractVerified}
                            isSharedView={isSharedView}
                          />
                        ))}
                      </>
                    );
                  })()}
                  </div>
                </div>
              </ScrollArea>

              {/* Pagination for Interface */}
              {(() => {
                // Recalculate methods for pagination controls
                let methods = [];
                if (selectedDeployment) {
                  if (Array.isArray(selectedDeployment.abi)) {
                    methods = selectedDeployment.abi;
                  } else if (selectedDeployment.abi?.body?.functions) {
                    methods = selectedDeployment.abi.body.functions;
                  } else if (selectedDeployment.abi) {
                    methods = Object.values(selectedDeployment.abi).flat();
                  }
                }

                const totalInterfacePages = Math.ceil(methods.length / interfaceItemsPerPage);

                // Generate page numbers
                const getPageNumbers = () => {
                  const pages = [];
                  const maxVisible = 5;

                  if (totalInterfacePages <= maxVisible) {
                    for (let i = 1; i <= totalInterfacePages; i++) {
                      pages.push(i);
                    }
                  } else {
                    if (currentInterfacePage <= 3) {
                      for (let i = 1; i <= 4; i++) pages.push(i);
                      pages.push('ellipsis');
                      pages.push(totalInterfacePages);
                    } else if (currentInterfacePage >= totalInterfacePages - 2) {
                      pages.push(1);
                      pages.push('ellipsis');
                      for (let i = totalInterfacePages - 3; i <= totalInterfacePages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      pages.push('ellipsis');
                      pages.push(currentInterfacePage - 1);
                      pages.push(currentInterfacePage);
                      pages.push(currentInterfacePage + 1);
                      pages.push('ellipsis');
                      pages.push(totalInterfacePages);
                    }
                  }
                  return pages;
                };

                return methods.length > interfaceItemsPerPage ? (
                  <div className="flex-none border-t bg-muted/10 px-4 py-3">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentInterfacePage(prev => Math.max(1, prev - 1))}
                            className={currentInterfacePage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>

                        {getPageNumbers().map((page, index) => (
                          <PaginationItem key={index}>
                            {page === 'ellipsis' ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                onClick={() => setCurrentInterfacePage(page as number)}
                                isActive={currentInterfacePage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentInterfacePage(prev => Math.min(totalInterfacePages, prev + 1))}
                            className={currentInterfacePage === totalInterfacePages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <div className="flex-1">
              <ABIEmptyState />
            </div>
          )}
        </>
      ) : (
        <ABIExecutionHistory
          projectId={projectId}
          contractAddress={selectedDeployment?.contract_address || ''}
        />
      )}

      {selectedMethod && selectedDeployment && !isSharedView && (
        <ABIExecuteDialog
          open={true}
          onOpenChange={(open) => !open && setSelectedMethod(null)}
          method={selectedMethod}
          contractAddress={selectedDeployment.contract_address}
          projectId={projectId}
          onExecute={(result) => {
            toast({
              title: "Success",
              description: "Method executed successfully",
            });
          }}
        />
      )}
    </div>
  );
}