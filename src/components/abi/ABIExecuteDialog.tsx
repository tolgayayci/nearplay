import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Terminal,
  PlayCircle,
  ExternalLink,
  Loader2,
  Info,
  Copy,
  FileText,
} from 'lucide-react';
import { ABIMethod } from '@/lib/types';
import { ABIMethodSignature } from './ABIMethodSignature';
import { executeNearMethod, getMethodTypeLabel } from '@/lib/nearContract';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getExplorerTxUrl, getExplorerAccountUrl } from '@/lib/config';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ABIExecuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: ABIMethod;
  contractAddress: string;
  projectId: string;
  onExecute: (result: any) => void;
}

interface ExecutionResult {
  status: 'success' | 'error' | 'pending';
  result?: any;
  error?: string;
  txHash?: string;
  gasUsed?: string;
  rawResponse?: any;
}

// No private key needed - NEAR interactions are handled by backend

export function ABIExecuteDialog({
  open,
  onOpenChange,
  method,
  contractAddress,
  projectId,
  onExecute,
}: ABIExecuteDialogProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const { toast } = useToast();

  const handleInputChange = (name: string, value: string) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleExecute = async () => {
    if (!method || !contractAddress) return;

    setIsExecuting(true);
    setResult({ status: 'pending' });

    try {
      // Execute NEAR method through backend
      const response = await executeNearMethod(contractAddress, method, inputs);

      if (response.success) {
        const successResult: ExecutionResult = {
          status: 'success',
          result: response.result, // Store raw result
          txHash: response.transactionHash,
          gasUsed: response.gasUsed,
          rawResponse: response.rawResponse,
        };

        setResult(successResult);
        onExecute(successResult);

        // Record the call in abi_calls table
        const { error } = await supabase
          .from('abi_calls')
          .insert({
            project_id: projectId,
            contract_address: contractAddress,
            method_name: method.name,
            method_type: method.stateMutability || method.type || 'function',
            inputs,
            outputs: {
              result: response.result,
              raw: response.rawResponse,
              transaction_hash: response.transactionHash || null,
              gas_used: response.gasUsed || null
            },
            status: 'success',
          });

        if (error) {
          console.error('Failed to save call history:', error);
        }

        toast({
          title: "Success",
          description: "Method executed successfully",
        });
      } else {
        // Create error result with raw response
        const errorResult: ExecutionResult = {
          status: 'error',
          error: response.error || 'Method execution failed',
          result: response.result, // Include raw result for errors
          txHash: response.transactionHash,
          gasUsed: response.gasUsed,
          rawResponse: response.rawResponse,
        };
        setResult(errorResult);

        // Record the failed call
        await supabase
          .from('abi_calls')
          .insert({
            project_id: projectId,
            contract_address: contractAddress,
            method_name: method.name,
            method_type: method.stateMutability || method.type,
            inputs,
            outputs: {
              result: response.result,
              raw: response.rawResponse,
              transaction_hash: response.transactionHash || null,
              gas_used: response.gasUsed || null
            },
            status: 'error',
            error: errorResult.error,
          });

        toast({
          title: "Error",
          description: "Method execution failed",
          variant: "destructive",
        });
        return; // Don't throw, just set the error result
      }
    } catch (error) {
      console.error('Execution error:', error);
      const errorResult: ExecutionResult = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Transaction failed',
        result: undefined, // No result for network errors
      };
      setResult(errorResult);

      // Record the failed call
      await supabase
        .from('abi_calls')
        .insert({
          project_id: projectId,
          contract_address: contractAddress,
          method_name: method.name,
          method_type: method.stateMutability || method.type,
          inputs,
          outputs: {
            result: null,
            raw: null,
            transaction_hash: null,
            gas_used: null
          },
          status: 'error',
          error: errorResult.error,
        });

      toast({
        title: "Error",
        description: "Failed to execute method",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopy = async (content: any) => {
    await navigator.clipboard.writeText(JSON.stringify(content, null, 2));
    toast({
      title: "Copied",
      description: "Content copied to clipboard",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 mb-2">
            <span>Execute {method.name}</span>
            <Badge variant="outline" className={cn(
              "text-xs",
              method.stateMutability === 'view' && "bg-green-500/10 text-green-500",
              method.stateMutability === 'nonpayable' && "bg-orange-500/10 text-orange-500",
              method.stateMutability === 'payable' && "bg-yellow-500/10 text-yellow-500"
            )}>
              {method.stateMutability}
            </Badge>
          </DialogTitle>
          <DialogDescription className="w-full">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between font-mono text-xs px-3 py-1.5 bg-muted rounded hover:bg-muted/80 transition-colors cursor-default w-full gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">
                        {contractAddress}
                      </span>
                    </div>
                    <a
                      href={getExplorerAccountUrl(contractAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono text-xs">{contractAddress}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 py-4">
            {/* Method Signature */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Method Signature
              </h4>
              <pre className="p-3 bg-muted rounded-lg font-mono text-xs overflow-auto">
                <ABIMethodSignature method={method} />
              </pre>
            </div>

            {/* Input Parameters */}
            {method.inputs && method.inputs.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Input Parameters</h4>
                {method.inputs.map((input, index) => (
                  <div key={index} className="space-y-2">
                    <label className="text-sm font-medium flex items-center justify-between">
                      <div>
                        {input.name}
                        <span className="ml-2 text-xs text-muted-foreground font-mono">
                          {input.type}
                        </span>
                      </div>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </label>
                    <Input
                      value={inputs[input.name] || ''}
                      onChange={(e) => handleInputChange(input.name, e.target.value)}
                      placeholder={`Enter ${input.type}`}
                      className="font-mono text-sm h-10 py-2 focus-visible:ring-offset-2"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Execution Result */}
            {result && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Execution Result
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      result.status === 'success' && "bg-green-500/10 text-green-500",
                      result.status === 'error' && "bg-red-500/10 text-red-500",
                      result.status === 'pending' && "bg-yellow-500/10 text-yellow-500"
                    )}>
                      {result.status}
                    </Badge>
                    {result.status === 'pending' && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {result.status === 'success' && (
                    <>
                      {(result.result !== undefined || result.rawResponse) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Return Values (Raw Output)</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5"
                              onClick={() => handleCopy(result.result)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span className="text-xs">Copy</span>
                            </Button>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto rounded-lg">
                            <pre className="p-3 bg-muted rounded-lg font-mono text-xs whitespace-pre-wrap break-all">
                              {(() => {
                                // For view methods, show just the value
                                // For change methods, show the full transaction details
                                if (result.result && typeof result.result === 'object' && 'status' in result.result) {
                                  // This is a change method with full transaction details
                                  return JSON.stringify(result.result, null, 2);
                                }
                                // This is a view method or simple result
                                return JSON.stringify(result.result, null, 2);
                              })()}
                            </pre>
                          </div>
                        </div>
                      )}

                      {result.txHash && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Transaction Hash:</span>
                          <a
                            href={getExplorerTxUrl(result.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono hover:underline flex items-center gap-1"
                          >
                            {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}

                      {result.gasUsed && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Gas Used:</span>
                          <span className="font-mono">{result.gasUsed}</span>
                        </div>
                      )}
                    </>
                  )}

                  {result.status === 'error' && (
                    <>
                      {(result.result !== undefined || result.rawResponse) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Raw Output (ActionError)</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5"
                              onClick={() => handleCopy(result.result || result.rawResponse)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span className="text-xs">Copy</span>
                            </Button>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto rounded-lg">
                            <pre className="p-3 bg-muted rounded-lg font-mono text-xs whitespace-pre-wrap break-all">
                              {(() => {
                                // Show the actual error result for failed transactions
                                if (result.result) {
                                  return JSON.stringify(result.result, null, 2);
                                }
                                if (result.rawResponse) {
                                  return JSON.stringify(result.rawResponse, null, 2);
                                }
                                return 'No raw output available';
                              })()}
                            </pre>
                          </div>
                        </div>
                      )}

                      {result.txHash && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Transaction Hash:</span>
                          <a
                            href={getExplorerTxUrl(result.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono hover:underline flex items-center gap-1"
                          >
                            {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}

                      {result.gasUsed && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Gas Used:</span>
                          <span className="font-mono">{result.gasUsed}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            disabled={isExecuting} 
            onClick={handleExecute}
            className="gap-2"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Execute
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}