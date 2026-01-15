import { SearchIcon, ArrowUpDown, Globe, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Section {
  id: 'projects' | 'templates' | 'deployments' | 'faucet';
  label: string;
  icon: any;
  count?: number;
}

export type SortOption = {
  label: string;
  value: 'created_desc' | 'created_asc' | 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' | 'network_asc' | 'network_desc';
};

const PROJECT_SORT_OPTIONS: SortOption[] = [
  { label: 'Recently Created', value: 'created_desc' },
  { label: 'Oldest Created', value: 'created_asc' },
  { label: 'Recently Updated', value: 'updated_desc' },
  { label: 'Oldest Updated', value: 'updated_asc' },
  { label: 'Name (A-Z)', value: 'name_asc' },
  { label: 'Name (Z-A)', value: 'name_desc' },
];

const TEMPLATE_SORT_OPTIONS: SortOption[] = [
  { label: 'Name (A-Z)', value: 'name_asc' },
  { label: 'Name (Z-A)', value: 'name_desc' },
];

const DEPLOYMENT_SORT_OPTIONS: SortOption[] = [
  { label: 'Recently Deployed', value: 'created_desc' },
  { label: 'Oldest First', value: 'created_asc' },
  { label: 'Project Name (A-Z)', value: 'name_asc' },
  { label: 'Project Name (Z-A)', value: 'name_desc' },
  { label: 'Network (A-Z)', value: 'network_asc' },
  { label: 'Network (Z-A)', value: 'network_desc' },
];

export type NetworkFilter = 'all' | 'testnet' | 'mainnet';
export type WalletFilter = 'all' | 'playground' | 'external';

interface ProjectTabsProps {
  sections: Section[];
  activeSection: Section['id'];
  searchQuery: string;
  sortBy: SortOption['value'];
  onSectionChange: (section: Section['id']) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: SortOption['value']) => void;
  // Deployment-specific filters
  networkFilter?: NetworkFilter;
  walletFilter?: WalletFilter;
  onNetworkFilterChange?: (filter: NetworkFilter) => void;
  onWalletFilterChange?: (filter: WalletFilter) => void;
}

export function ProjectTabs({
  sections,
  activeSection,
  searchQuery,
  sortBy,
  onSectionChange,
  onSearchChange,
  onSortChange,
  networkFilter = 'all',
  walletFilter = 'all',
  onNetworkFilterChange,
  onWalletFilterChange,
}: ProjectTabsProps) {
  const getSortOptions = () => {
    switch (activeSection) {
      case 'deployments':
        return DEPLOYMENT_SORT_OPTIONS;
      case 'templates':
        return TEMPLATE_SORT_OPTIONS;
      default:
        return PROJECT_SORT_OPTIONS;
    }
  };

  const sortOptions = getSortOptions();
  const currentSort = sortOptions.find(option => option.value === sortBy) || sortOptions[0];

  const getSearchPlaceholder = () => {
    switch (activeSection) {
      case 'deployments':
        return 'Search by contract, project, or wallet...';
      case 'templates':
        return 'Search templates...';
      default:
        return 'Search projects...';
    }
  };

  return (
    <div className="border rounded-lg bg-card/50">
      <div className="flex items-center justify-between p-3 gap-3">
        {/* Section Tabs */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {sections.map((section) => (
            <Button
              key={section.id}
              variant="ghost"
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                activeSection === section.id && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
              onClick={() => onSectionChange(section.id)}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
              {section.count !== undefined && (
                <span className={cn(
                  "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium",
                  activeSection === section.id
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {section.count}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Deployment-specific filters */}
          {activeSection === 'deployments' && (
            <>
              {/* Network Filter */}
              <Select
                value={networkFilter}
                onValueChange={(value) => onNetworkFilterChange?.(value as NetworkFilter)}
              >
                <SelectTrigger className="w-[130px] h-9">
                  <Globe className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Networks</SelectItem>
                  <SelectItem value="testnet">Testnet</SelectItem>
                  <SelectItem value="mainnet">Mainnet</SelectItem>
                </SelectContent>
              </Select>

              {/* Wallet Filter */}
              <Select
                value={walletFilter}
                onValueChange={(value) => onWalletFilterChange?.(value as WalletFilter)}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <Wallet className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wallets</SelectItem>
                  <SelectItem value="playground">Playground</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          {/* Search */}
          <div className="relative w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={getSearchPlaceholder()}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9">
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">{currentSort?.label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className={cn(
                    "cursor-pointer",
                    option.value === sortBy && "bg-primary/10 text-primary"
                  )}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
