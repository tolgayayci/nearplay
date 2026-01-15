import { useState, useEffect } from 'react';
import { Rocket, Globe, ExternalLink, ShieldCheck, ShieldX, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Deployment } from '@/lib/types';
import { checkVerificationStatus, type VerificationStatus, getExplorerUrl } from '@/lib/verification';

interface DeploymentInfoBarProps {
  deployment: Deployment;
  onVerifyClick?: () => void;
  refreshKey?: number; // Change this to trigger verification status refresh
}

export function DeploymentInfoBar({
  deployment,
  onVerifyClick,
  refreshKey = 0,
}: DeploymentInfoBarProps) {
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [isCheckingVerification, setIsCheckingVerification] = useState(true);

  // Determine network from chain_name or chain_id
  const network: 'testnet' | 'mainnet' =
    deployment.chain_name?.toLowerCase().includes('mainnet') ? 'mainnet' : 'testnet';

  // Check verification status
  useEffect(() => {
    const checkStatus = async () => {
      if (!deployment.contract_address) {
        setIsCheckingVerification(false);
        return;
      }

      try {
        setIsCheckingVerification(true);
        const status = await checkVerificationStatus(deployment.contract_address, network);
        setVerificationStatus(status);
      } catch {
        setVerificationStatus({ verified: false });
      } finally {
        setIsCheckingVerification(false);
      }
    };

    checkStatus();
  }, [deployment.contract_address, network, refreshKey]);

  const explorerUrl = getExplorerUrl(deployment.contract_address, network);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Deployed by:</span>

      {/* NEAR Playground Badge */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className="gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/15 border-green-500/20"
            >
              <Rocket className="h-3 w-3" />
              NEAR Playground
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Contract deployed using NEAR Playground</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Network Badge */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Badge
                variant="secondary"
                className="gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 border-blue-500/20 cursor-pointer"
              >
                <Globe className="h-3 w-3" />
                {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                <ExternalLink className="h-3 w-3" />
              </Badge>
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <p>View contract on NEARBlocks</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Verification Badge */}
      {isCheckingVerification ? (
        <Badge variant="secondary" className="gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking...
        </Badge>
      ) : verificationStatus?.verified ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={verificationStatus.verification_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Badge
                  variant="secondary"
                  className="gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/15 border-green-500/20 cursor-pointer"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </Badge>
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Source Code Verified</p>
                {verificationStatus.verification_date && (
                  <p className="text-xs text-muted-foreground">
                    Verified on {new Date(verificationStatus.verification_date).toLocaleDateString()}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Click to view on SourceScan</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                  onVerifyClick && "cursor-pointer hover:bg-red-500/15"
                )}
                onClick={onVerifyClick}
              >
                <ShieldX className="h-3 w-3" />
                Unverified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Source Code Not Verified</p>
                {onVerifyClick && (
                  <p className="text-xs text-muted-foreground">Click to verify your contract</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
