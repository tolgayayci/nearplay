import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  XCircle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  verifyContract,
  VerifyContractResult,
} from '@/lib/verification';

interface VerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  projectId: string;
  contractId?: string;
  wasmHash?: string; // Stored hash from deployment
  isVerified?: boolean; // Already verified
  verifiedAt?: string; // When it was verified
  network?: 'testnet' | 'mainnet';
  onVerificationComplete?: (result: VerifyContractResult) => void;
}

type VerificationStep = 'idle' | 'already_verified' | 'verifying' | 'verified' | 'failed' | 'error';

export function VerificationModal({
  open,
  onOpenChange,
  userId,
  projectId,
  contractId: initialContractId,
  wasmHash,
  isVerified = false,
  verifiedAt,
  network = 'testnet',
  onVerificationComplete,
}: VerificationModalProps) {
  const contractId = initialContractId || '';
  const [step, setStep] = useState<VerificationStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyContractResult | null>(null);

  // Set initial state when modal opens
  useEffect(() => {
    if (open) {
      console.log('VerificationModal opened with:', { isVerified, wasmHash, verifiedAt });
      setError(null);
      if (isVerified && wasmHash) {
        setStep('already_verified');
        setResult({
          verified: true,
          compiled_hash: wasmHash,
          onchain_hash: wasmHash,
          verified_at: verifiedAt,
        });
      } else {
        setStep('idle');
        setResult(null);
      }
    }
  }, [open, isVerified, wasmHash, verifiedAt]);

  const handleVerify = async () => {
    if (!contractId) return;

    if (!wasmHash) {
      setError('No compiled hash found. This contract may have been deployed before verification was enabled.');
      setStep('error');
      return;
    }

    setError(null);
    setStep('verifying');

    try {
      const verifyResult = await verifyContract(contractId, wasmHash, network);
      setResult(verifyResult);

      if (verifyResult.verified) {
        setStep('verified');
        onVerificationComplete?.(verifyResult);
      } else {
        setStep('failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {step === 'already_verified' ? 'Contract Verified' : 'Verify Contract'}
          </DialogTitle>
          <DialogDescription>
            {step === 'already_verified'
              ? 'This contract has already been verified'
              : 'Verify your contract bytecode matches the deployed code'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Contract Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Contract</div>
            <div className="font-mono text-sm break-all">{contractId}</div>
          </div>

          {/* Already Verified State */}
          {step === 'already_verified' && result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex gap-3">
                  <ShieldCheck className="h-6 w-6 text-green-500 shrink-0" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      Already Verified
                    </p>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                      This contract has been verified through NEAR Playground.
                    </p>
                  </div>
                </div>
              </div>

              {result.verified_at && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Verified at</div>
                  <div className="text-sm">
                    {new Date(result.verified_at).toLocaleString()}
                  </div>
                </div>
              )}

              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Bytecode Hash</div>
                <div className="font-mono text-xs break-all">{result.compiled_hash}</div>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-medium text-sm">How verification works:</h4>
                <p className="text-sm text-muted-foreground">
                  When you deploy a contract through NEAR Playground, we store the SHA256 hash
                  of the compiled WASM bytecode. During verification, we fetch the deployed
                  bytecode from the blockchain and compare the hashes. If they match, the
                  contract is verified.
                </p>
              </div>
            </div>
          )}

          {/* Idle State */}
          {step === 'idle' && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium text-sm">How verification works:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal ml-4">
                  <li>We fetch the deployed bytecode from the NEAR blockchain</li>
                  <li>Calculate the SHA256 hash of the on-chain bytecode</li>
                  <li>Compare it with the hash stored when you deployed</li>
                  <li>If they match, your contract is verified</li>
                </ol>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Only contracts deployed through NEAR Playground can be verified.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Verifying State */}
          {step === 'verifying' && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Verifying contract...</p>
                <p className="text-sm text-muted-foreground">
                  Fetching on-chain bytecode and comparing hashes
                </p>
              </div>
            </div>
          )}

          {/* Verified State */}
          {step === 'verified' && result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex gap-3">
                  <ShieldCheck className="h-6 w-6 text-green-500 shrink-0" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      Contract Verified!
                    </p>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                      Your contract bytecode matches the deployed code on-chain.
                    </p>
                  </div>
                </div>
              </div>

              {result.verified_at && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Verified at</div>
                  <div className="text-sm">
                    {new Date(result.verified_at).toLocaleString()}
                  </div>
                </div>
              )}

              {result.compiled_hash && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Bytecode Hash</div>
                    <div className="font-mono text-xs break-all">{result.compiled_hash}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Failed State - Hashes don't match */}
          {step === 'failed' && result && (
            <div className="space-y-4">
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="flex gap-3">
                  <ShieldAlert className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-600 dark:text-orange-400">
                      Bytecode Mismatch
                    </p>
                    <p className="text-sm text-orange-600/80 dark:text-orange-400/80 mt-1">
                      The on-chain bytecode does not match your compiled code. This can happen if:
                    </p>
                    <ul className="text-sm text-orange-600/80 dark:text-orange-400/80 mt-2 list-disc ml-4">
                      <li>The contract was modified after compilation</li>
                      <li>A different version was deployed</li>
                      <li>The contract was deployed outside NEAR Playground</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Expected (Compiled)</div>
                  <div className="font-mono text-xs break-all">{result.compiled_hash}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Actual (On-chain)</div>
                  <div className="font-mono text-xs break-all">{result.onchain_hash}</div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex gap-3">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-600 dark:text-red-400">
                      Verification Error
                    </p>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === 'idle' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleVerify} disabled={!contractId}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Verify Contract
              </Button>
            </>
          )}

          {step === 'already_verified' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}

          {step === 'verifying' && (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}

          {step === 'verified' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}

          {step === 'failed' && (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}

          {step === 'error' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleVerify}>
                Try Again
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
