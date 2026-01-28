import { Rocket, Globe, ExternalLink, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Deployment } from '@/lib/types';
import { getExplorerUrl } from '@/lib/verification';

interface DeploymentInfoBarProps {
  deployment: Deployment;
  onVerifyClick?: () => void;
}

export function DeploymentInfoBar({
  deployment,
  onVerifyClick,
}: DeploymentInfoBarProps) {
  // Determine network from chain_name or chain_id
  const network: 'testnet' | 'mainnet' =
    deployment.chain_name?.toLowerCase().includes('mainnet') ? 'mainnet' : 'testnet';

  // Read verification status from deployment metadata (stored in Supabase)
  const isVerified = deployment.metadata?.verified === true;
  const verifiedAt = deployment.metadata?.verified_at as string | undefined;

  // Get deployer account from metadata
  const deployerAccount = deployment.metadata?.wallet_address || deployment.metadata?.deployer_account;

  const explorerUrl = getExplorerUrl(deployment.contract_address, network);
  const deployerExplorerUrl = deployerAccount ? getExplorerUrl(deployerAccount, network) : null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Deployed by:</span>

      {/* Deployer Account Badge */}
      {deployerAccount ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={deployerExplorerUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Badge
                  variant="secondary"
                  className="gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/15 border-green-500/20 cursor-pointer font-mono text-xs"
                >
                  <Rocket className="h-3 w-3" />
                  {deployerAccount}
                  <ExternalLink className="h-3 w-3" />
                </Badge>
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <p>View deployer account on NEARBlocks</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
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
      )}

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
      {isVerified ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/15 border-green-500/20 cursor-pointer"
                onClick={onVerifyClick}
              >
                <ShieldCheck className="h-3 w-3" />
                Verified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Verified by NEAR Playground</p>
                {verifiedAt && (
                  <p className="text-xs text-muted-foreground">
                    Verified on {new Date(verifiedAt).toLocaleDateString()}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Click for details</p>
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
