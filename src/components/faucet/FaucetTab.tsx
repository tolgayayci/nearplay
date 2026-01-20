import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { formatDistanceToNow } from 'date-fns';
import {
  Droplets,
  Wallet,
  Clock,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  History,
  AlertCircle,
  Zap,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { getFaucetStatus, requestFaucet } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { FaucetRequest, FaucetStatusResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  recipientAccount: z
    .string()
    .min(1, 'Account is required')
    .regex(/^[a-z0-9_-]+\.testnet$/, 'Must be a valid testnet account (e.g., myaccount.testnet)'),
});

interface FaucetTabProps {
  userId: string;
}

const StatusBadge = ({ status }: { status: FaucetRequest['status'] }) => {
  switch (status) {
    case 'success':
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 gap-1">
          <CheckCircle className="h-3 w-3" />
          Sent
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Pending
        </Badge>
      );
    default:
      return null;
  }
};

export function FaucetTab({ userId }: FaucetTabProps) {
  const [status, setStatus] = useState<FaucetStatusResponse | null>(null);
  const [history, setHistory] = useState<FaucetRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    explorerUrl?: string;
  } | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientAccount: '',
    },
  });

  const fetchStatus = async () => {
    try {
      const faucetStatus = await getFaucetStatus(userId);
      setStatus(faucetStatus);
    } catch (error) {
      console.error('Failed to fetch faucet status:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('faucet_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory(data || []);

      const latestSuccess = data?.find(r => r.status === 'success');
      if (latestSuccess) {
        const requestTime = new Date(latestSuccess.created_at).getTime();
        const nextAvailable = requestTime + 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (now < nextAvailable) {
          setStatus(prev => prev ? {
            ...prev,
            can_request: false,
            last_request_at: latestSuccess.created_at,
            next_available_at: new Date(nextAvailable).toISOString(),
          } : {
            can_request: false,
            last_request_at: latestSuccess.created_at,
            next_available_at: new Date(nextAvailable).toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch faucet history:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchStatus(), fetchHistory()]);
      setIsLoading(false);
    };
    loadData();
  }, [userId]);

  useEffect(() => {
    if (!status?.next_available_at || status.can_request) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const nextAvailable = new Date(status.next_available_at!).getTime();
      const now = Date.now();
      const diff = nextAvailable - now;

      if (diff <= 0) {
        setCountdown(null);
        setStatus(prev => prev ? { ...prev, can_request: true } : null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [status?.next_available_at, status?.can_request]);

  const canRequest = status?.can_request ?? true;

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    setResult(null);

    try {
      const { data: faucetRequest, error: dbError } = await supabase
        .from('faucet_requests')
        .insert({
          user_id: userId,
          recipient_account: data.recipientAccount,
          amount: 1.0,
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      const response = await requestFaucet(userId, data.recipientAccount);

      if (response.success) {
        await supabase
          .from('faucet_requests')
          .update({
            status: 'success',
            transaction_hash: response.transaction_hash,
          })
          .eq('id', faucetRequest.id);

        setResult({
          success: true,
          message: `Successfully sent 1 NEAR to ${data.recipientAccount}`,
          explorerUrl: response.explorer_url,
        });

        toast({
          title: 'Tokens Sent!',
          description: '1 NEAR has been sent to your account',
        });

        form.reset();
        await Promise.all([fetchStatus(), fetchHistory()]);
      } else {
        await supabase
          .from('faucet_requests')
          .update({
            status: 'failed',
            error_message: response.error,
          })
          .eq('id', faucetRequest.id);

        setResult({
          success: false,
          message: response.error || 'Request failed',
        });
        await fetchHistory();
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Request failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Side - Info */}
        <div className="rounded-lg border bg-card">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Droplets className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Testnet Faucet</h2>
                <p className="text-sm text-muted-foreground">
                  Get free NEAR tokens for testing
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-md bg-primary/10">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Amount per request</p>
                <p className="font-semibold">1 NEAR</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-md bg-blue-500/10">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Rate limit</p>
                <p className="font-semibold">1 request per 24 hours</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-md bg-green-500/10">
                <Globe className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Network</p>
                <p className="font-semibold">Testnet only</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-md bg-amber-500/10">
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Faucet balance</p>
                <p className="font-semibold">{status?.faucet_balance?.toFixed(2) || '—'} NEAR</p>
              </div>
            </div>

            {countdown && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Clock className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm text-amber-600">Next request available in</p>
                  <p className="font-semibold text-amber-700">{countdown}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Request Form */}
        <div className="rounded-lg border bg-card">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Request Tokens</h3>
                <p className="text-sm text-muted-foreground">
                  Enter recipient account
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="recipientAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Account</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="myaccount.testnet"
                          {...field}
                          disabled={!canRequest || isSubmitting}
                          className="font-mono h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={!canRequest || isSubmitting}
                  className="w-full gap-2 h-11"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Droplets className="h-4 w-4" />
                      Request 1 NEAR
                    </>
                  )}
                </Button>

                {!canRequest && !countdown && (
                  <p className="text-sm text-muted-foreground text-center">
                    You've already requested tokens today.
                  </p>
                )}

                {result && (
                  <Alert variant={result.success ? 'default' : 'destructive'} className={cn(
                    result.success && "border-green-500/20 bg-green-500/5"
                  )}>
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription className="flex flex-col gap-1">
                      <span>{result.message}</span>
                      {result.explorerUrl && (
                        <a
                          href={result.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm flex items-center gap-1"
                        >
                          View on Explorer
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </form>
            </Form>
          </div>
        </div>
      </div>

      {/* Request History */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Request History</h3>
              <p className="text-sm text-muted-foreground">
                Your recent faucet requests
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No requests yet</p>
              <p className="text-sm">Your faucet request history will appear here</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">Account</TableHead>
                    <TableHead className="text-center font-semibold">Amount</TableHead>
                    <TableHead className="text-center font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{request.recipient_account}</span>
                          {request.transaction_hash && (
                            <a
                              href={`https://testnet.nearblocks.io/txns/${request.transaction_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="View on Explorer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        {request.error_message && request.status === 'failed' && (
                          <p className="text-xs text-destructive mt-1 truncate max-w-[200px]" title={request.error_message}>
                            {request.error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold">{request.amount}</span>
                        <span className="text-muted-foreground ml-1">NEAR</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
