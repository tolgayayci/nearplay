import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  ExternalLink,
  Copy,
  MoreVerticalIcon,
  Rocket,
  FolderOpen,
  Play,
  CheckCircle,
  Globe,
  Wallet,
  Zap,
  Clock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DeploymentWithProject } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DeploymentListProps {
  deployments: DeploymentWithProject[];
  searchQuery: string;
  isLoading?: boolean;
}

const ITEMS_PER_PAGE = 9;

export function DeploymentList({
  deployments,
  searchQuery,
  isLoading = false,
}: DeploymentListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Filter deployments based on search query
  const filteredDeployments = deployments.filter((deployment) => {
    const query = searchQuery.toLowerCase();
    const contractAddress = deployment.contract_address?.toLowerCase() || '';
    const projectName = deployment.project?.name?.toLowerCase() || '';
    const walletAddress = deployment.metadata?.wallet_address?.toLowerCase() || '';
    const walletName = deployment.metadata?.wallet_name?.toLowerCase() || '';

    return (
      contractAddress.includes(query) ||
      projectName.includes(query) ||
      walletAddress.includes(query) ||
      walletName.includes(query)
    );
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDeployments.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDeployments = filteredDeployments.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    });
  };

  const truncateAddress = (address: string, chars = 12) => {
    if (address.length <= chars * 2) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  };

  const getExplorerUrl = (deployment: DeploymentWithProject) => {
    const network = deployment.metadata?.network || 'testnet';
    const base = network === 'mainnet'
      ? 'https://nearblocks.io'
      : 'https://testnet.nearblocks.io';
    return `${base}/address/${deployment.contract_address}`;
  };

  const getWalletDisplay = (deployment: DeploymentWithProject) => {
    const walletType = deployment.metadata?.wallet_type;
    const walletName = deployment.metadata?.wallet_name;
    const deployerAccount = deployment.metadata?.deployer_account;

    if (walletType === 'playground') {
      return { type: 'playground', label: 'Playground' };
    }

    if (walletType === 'external') {
      const displayName = walletName === 'my-near-wallet' ? 'MyNearWallet'
        : walletName === 'nightly' ? 'Nightly'
        : walletName === 'here-wallet' ? 'HERE'
        : walletName === 'sender' ? 'Sender'
        : walletName || 'External';
      return { type: 'external', label: displayName };
    }

    // Legacy deployments - infer from available data
    if (deployerAccount) {
      // Old playground deployments had deployer_account
      return { type: 'playground', label: 'Playground' };
    }

    return { type: 'playground', label: 'Playground' };
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
            <div className="w-10 h-10 rounded-md bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filteredDeployments.length === 0) {
    return (
      <div className="h-[calc(100vh-20rem)] rounded-lg border bg-card flex items-center justify-center p-8">
        <div className="text-center max-w-sm mx-auto">
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <div className="relative bg-primary/10 w-24 h-24 rounded-full flex items-center justify-center">
              <Rocket className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h3 className="text-2xl font-semibold mb-3">
            {searchQuery ? 'No matching deployments found' : 'No deployments yet'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? 'Try adjusting your search terms or clear the filter to see all deployments'
              : 'Deploy your first contract to see it here'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[35%]">
                Contract
              </th>
              <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[20%]">
                Wallet
              </th>
              <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[15%]">
                Network
              </th>
              <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[20%]">
                Deployed
              </th>
              <th className="w-[10%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedDeployments.map((deployment) => {
              const wallet = getWalletDisplay(deployment);
              const network = deployment.metadata?.network || 'testnet';

              return (
                <tr
                  key={deployment.id}
                  className={cn(
                    'group hover:bg-muted/50 cursor-pointer',
                    'transition-colors duration-100'
                  )}
                  onClick={() => deployment.project && navigate(`/projects/${deployment.project.id}`)}
                >
                  {/* Contract */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10 group-hover:bg-primary/20">
                        <Rocket className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code
                            className="font-medium font-mono text-sm truncate max-w-[180px]"
                            title={deployment.contract_address}
                          >
                            {truncateAddress(deployment.contract_address, 10)}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleCopy(deployment.contract_address, `contract-${deployment.id}`, e)}
                          >
                            {copiedId === `contract-${deployment.id}` ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                          {deployment.project?.name || 'Deleted Project'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Wallet */}
                  <td className="py-4 px-6">
                    {wallet.type === 'playground' ? (
                      <Badge
                        variant="secondary"
                        className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 w-fit"
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        {wallet.label}
                      </Badge>
                    ) : wallet.type === 'external' ? (
                      <Badge
                        variant="secondary"
                        className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 w-fit"
                      >
                        <Wallet className="h-3 w-3 mr-1" />
                        {wallet.label}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 w-fit"
                      >
                        Unknown
                      </Badge>
                    )}
                  </td>

                  {/* Network */}
                  <td className="py-4 px-6">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs px-2 py-0.5 w-fit',
                        network === 'mainnet'
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                          : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                      )}
                    >
                      <Globe className="h-3 w-3 mr-1" />
                      {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                    </Badge>
                  </td>

                  {/* Deployed */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(getExplorerUrl(deployment), '_blank');
                          }}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View in Explorer
                        </DropdownMenuItem>
                        {deployment.project && (
                          <>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/projects/${deployment.project!.id}`);
                              }}
                            >
                              <FolderOpen className="mr-2 h-4 w-4" />
                              Open Project
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/projects/${deployment.project!.id}?tab=abi`);
                              }}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Call Contract
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <div>
            Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredDeployments.length)} of{' '}
            {filteredDeployments.length} deployments
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className="w-8"
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
