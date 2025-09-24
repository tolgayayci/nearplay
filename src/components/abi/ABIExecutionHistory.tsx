import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  History,
  ArrowUpDown,
  Eye,
  Copy,
  Terminal,
} from 'lucide-react';
import { ABICall } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getExplorerTxUrl } from '@/lib/config';

interface ABIExecutionHistoryProps {
  projectId: string;
  contractAddress?: string;
}

export function ABIExecutionHistory({ projectId, contractAddress }: ABIExecutionHistoryProps) {
  const [calls, setCalls] = useState<ABICall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedCall, setSelectedCall] = useState<ABICall | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const { toast } = useToast();

  useEffect(() => {
    fetchCalls();
    setCurrentPage(1); // Reset to first page when filters change
  }, [projectId, contractAddress, sortOrder]);

  const fetchCalls = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('abi_calls')
        .select('*')
        .eq('project_id', projectId);

      // Filter by contract address if provided
      if (contractAddress) {
        query = query.eq('contract_address', contractAddress);
      }

      const { data, error } = await query
        .order('created_at', { ascending: sortOrder === 'asc' });

      if (error) throw error;
      setCalls(data || []);
    } catch (error) {
      console.error('Error fetching ABI calls:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-500';
      case 'error':
        return 'bg-red-500/10 text-red-500';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Content copied to clipboard",
    });
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="text-sm text-muted-foreground">Loading calls...</div>
          <Button variant="ghost" size="sm" disabled className="gap-2">
            <ArrowUpDown className="h-4 w-4" />
            {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-4">
              <Clock className="h-6 w-6 text-primary animate-spin" />
            </div>
            <h3 className="font-medium mb-1">Loading History</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we fetch the execution history
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="text-sm text-muted-foreground">
            {contractAddress ? `No calls recorded for this contract` : 'No calls recorded'}
          </div>
          <Button variant="ghost" size="sm" disabled className="gap-2">
            <ArrowUpDown className="h-4 w-4" />
            {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center bg-muted/40">
          <div className="text-center">
            <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-6">
              <History className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <h3 className="font-medium mb-3">No Contract Interactions</h3>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {contractAddress
                  ? 'No interactions recorded for this contract'
                  : 'Start interacting with your deployed contract'
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {contractAddress
                  ? 'Execute methods from the Interface tab'
                  : 'to see your execution history here'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil(calls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCalls = calls.slice(startIndex, endIndex);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b bg-muted/20">
        <div className="text-sm text-muted-foreground">
          {calls.length} {calls.length === 1 ? 'call' : 'calls'} recorded
          {contractAddress && ' for this contract'}
          {calls.length > itemsPerPage && ` • Page ${currentPage} of ${totalPages}`}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => setSortOrder(order => order === 'desc' ? 'asc' : 'desc')}
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
        </Button>
      </div>

      <ScrollArea className="flex-1 bg-muted/40">
        <div className="divide-y">
          {currentCalls.map((call) => (
            <div
              key={call.id}
              onClick={() => setSelectedCall(call)}
              className={cn(
                "group relative flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
              )}
            >
              <div className="flex-none">
                {call.status === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : call.status === 'error' ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Clock className="h-4 w-4 text-yellow-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{call.method_name}</span>
                  <Badge variant="outline" className={cn("text-[10px]", getStatusColor(call.status))}>
                    {call.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {call.outputs?.transaction_hash ? (
                    <>
                      <span>TX:</span>
                      <code className="font-mono">
                        {call.outputs.transaction_hash.slice(0, 6)}...{call.outputs.transaction_hash.slice(-4)}
                      </code>
                    </>
                  ) : (
                    <span className="text-muted-foreground/60">View call</span>
                  )}
                  <span>•</span>
                  <span>{formatDate(call.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCall(call);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (call.outputs?.transaction_hash) {
                      window.open(
                        getExplorerTxUrl(call.outputs.transaction_hash),
                        '_blank'
                      );
                    }
                  }}
                  disabled={!call.outputs?.transaction_hash}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Pagination Footer */}
      {calls.length > itemsPerPage && (
        <div className="flex-none border-t bg-muted/10 px-4 py-3">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>

              {getPageNumbers().map((page, index) => (
                <PaginationItem key={index}>
                  {page === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => setCurrentPage(page as number)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <Dialog open={selectedCall !== null} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          {selectedCall && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>{selectedCall.method_name}</span>
                  <Badge variant="outline" className={cn(getStatusColor(selectedCall.status))}>
                    {selectedCall.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4">
                  {/* Transaction Info */}
                  {selectedCall.outputs?.transaction_hash && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 pt-4">Transaction Hash</h4>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-muted-foreground" />
                          <code className="font-mono text-sm">
                            {selectedCall.outputs.transaction_hash.slice(0, 12)}...{selectedCall.outputs.transaction_hash.slice(-8)}
                          </code>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopy(selectedCall.outputs.transaction_hash)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              window.open(
                                getExplorerTxUrl(selectedCall.outputs.transaction_hash),
                                '_blank'
                              );
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contract Address */}
                  {selectedCall.contract_address && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Contract Address</h4>
                      <div className="p-3 bg-muted rounded-lg">
                        <code className="font-mono text-sm">{selectedCall.contract_address}</code>
                      </div>
                    </div>
                  )}

                  {/* Input Parameters */}
                  {Object.keys(selectedCall.inputs).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Input Parameters</h4>
                      <div className="space-y-2">
                        {Object.entries(selectedCall.inputs).map(([key, value]) => (
                          <div key={key} className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-sm text-muted-foreground">{key}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleCopy(String(value))}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                              {String(value)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Output */}
                  {selectedCall.outputs && Object.keys(selectedCall.outputs).length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Raw Output</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5"
                          onClick={() => {
                            // Try to show the most complete data - raw, result, or full outputs
                            const dataToUse = selectedCall.outputs.raw ||
                                             selectedCall.outputs.result ||
                                             selectedCall.outputs;
                            handleCopy(JSON.stringify(dataToUse, null, 2));
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="text-xs">Copy</span>
                        </Button>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="max-h-64 overflow-y-auto">
                          <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                            {(() => {
                              // Try to show the most complete raw data
                              if (selectedCall.outputs.raw) {
                                return JSON.stringify(selectedCall.outputs.raw, null, 2);
                              }
                              if (selectedCall.outputs.result) {
                                return JSON.stringify(selectedCall.outputs.result, null, 2);
                              }
                              return JSON.stringify(selectedCall.outputs, null, 2);
                            })()}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error and Raw Output for Failed Calls */}
                  {selectedCall.status === 'error' && (
                    <>
                      {/* Show raw output if available for error cases */}
                      {selectedCall.outputs && Object.keys(selectedCall.outputs).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">Raw Output (ActionError)</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5"
                              onClick={() => {
                                const dataToUse = selectedCall.outputs.raw ||
                                                 selectedCall.outputs.result ||
                                                 selectedCall.outputs;
                                handleCopy(JSON.stringify(dataToUse, null, 2));
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span className="text-xs">Copy</span>
                            </Button>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="max-h-64 overflow-y-auto">
                              <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                                {(() => {
                                  if (selectedCall.outputs.raw) {
                                    return JSON.stringify(selectedCall.outputs.raw, null, 2);
                                  }
                                  if (selectedCall.outputs.result) {
                                    return JSON.stringify(selectedCall.outputs.result, null, 2);
                                  }
                                  return JSON.stringify(selectedCall.outputs, null, 2);
                                })()}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Error message */}
                      {selectedCall.error && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">Error Message</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5"
                              onClick={() => handleCopy(selectedCall.error || '')}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span className="text-xs">Copy</span>
                            </Button>
                          </div>
                          <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
                            <pre className="text-sm whitespace-pre-wrap break-all">
                              {selectedCall.error}
                            </pre>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Executed {formatDate(selectedCall.created_at)}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}