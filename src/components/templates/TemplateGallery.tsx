import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Template, TemplateDifficulty } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  Plus,
  Code2,
  Eye,
  Download,
  Heart,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TemplateGalleryProps {
  templates: Template[];
  categories: string[];
  tags: string[];
  isLoading?: boolean;
  likedTemplateIds?: Set<string>;
  currentUserId?: string;
  onTemplateClick: (template: Template) => void;
  onUseTemplate: (template: Template) => void;
  onLikeTemplate: (template: Template) => void;
  onDeleteTemplate?: (template: Template) => void;
  likingTemplateId?: string | null;
  onPublishTemplate?: () => void;
}

type SortOption = 'newest' | 'popular' | 'most_used' | 'most_liked';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Viewed' },
  { value: 'most_used', label: 'Most Used' },
  { value: 'most_liked', label: 'Most Liked' },
];

const difficultyOptions: { value: TemplateDifficulty | 'all'; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advanced', label: 'Advanced' },
];

const difficultyColors: Record<string, string> = {
  Beginner: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  Intermediate: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  Advanced: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

export function TemplateGallery({
  templates,
  categories,
  tags: availableTags,
  isLoading,
  likedTemplateIds = new Set(),
  currentUserId,
  onTemplateClick,
  onUseTemplate,
  onLikeTemplate,
  onDeleteTemplate,
  likingTemplateId,
  onPublishTemplate,
}: TemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<TemplateDifficulty | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedDifficulty, sortBy, selectedTags]);

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((t) => t.category === selectedCategory);
    }

    // Difficulty filter
    if (selectedDifficulty !== 'all') {
      result = result.filter((t) => t.difficulty === selectedDifficulty);
    }

    // Tags filter
    if (selectedTags.length > 0) {
      result = result.filter((t) =>
        selectedTags.some((tag) => t.tags?.includes(tag))
      );
    }

    // Sort - default to created_at for newest
    switch (sortBy) {
      case 'newest':
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
        break;
      case 'popular':
        result.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        break;
      case 'most_used':
        result.sort((a, b) => (b.uses_count || 0) - (a.uses_count || 0));
        break;
      case 'most_liked':
        result.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
        break;
    }

    return result;
  }, [templates, searchQuery, selectedCategory, selectedDifficulty, selectedTags, sortBy]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTemplates = filteredTemplates.slice(startIndex, startIndex + itemsPerPage);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedDifficulty('all');
    setSelectedTags([]);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== 'all' ||
    selectedDifficulty !== 'all' ||
    selectedTags.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton for filters */}
        <div className="border rounded-lg bg-card/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="h-9 w-64 bg-muted rounded animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-9 w-32 bg-muted rounded animate-pulse" />
              <div className="h-9 w-32 bg-muted rounded animate-pulse" />
              <div className="h-9 w-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
        {/* Loading skeleton for table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="h-12 bg-muted/50 border-b" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b animate-pulse bg-muted/20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters - Bordered Card */}
      <div className="border rounded-lg bg-card/50">
        <div className="flex items-center justify-between p-3 gap-3">
          {/* Left side - Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Right side - Filters */}
          <div className="flex items-center gap-2">
            {/* Category */}
            <Select
              value={selectedCategory}
              onValueChange={(value) => setSelectedCategory(value)}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Difficulty */}
            <Select
              value={selectedDifficulty}
              onValueChange={(value) =>
                setSelectedDifficulty(value as TemplateDifficulty | 'all')
              }
            >
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                {difficultyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortOption)}
            >
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* More Filters Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn('h-9 gap-2', showFilters && 'bg-primary/10 border-primary/50')}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Tags</span>
            </Button>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Tags Filter - Expandable */}
        {showFilters && availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pb-3 pt-0">
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  selectedTags.includes(tag)
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 ? (
        <div className="min-h-[calc(100vh-24rem)] rounded-lg border bg-card flex items-center justify-center p-8">
          <div className="text-center max-w-sm mx-auto">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
              <div className="relative bg-primary/10 w-24 h-24 rounded-full flex items-center justify-center">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold mt-6">No Templates Found</h3>
            <p className="text-muted-foreground mt-2">
              {hasActiveFilters
                ? 'Try adjusting your search terms or clear the filters to see all available templates'
                : 'Be the first to share your smart contract template with the community'}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            ) : onPublishTemplate ? (
              <Button onClick={onPublishTemplate} className="mt-6 gap-2">
                <Plus className="h-4 w-4" />
                Publish Your First Template
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[22%]">
                    Name
                  </th>
                  <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[20%]">
                    Description
                  </th>
                  <th className="h-12 px-4 text-left text-xs font-medium text-muted-foreground w-[8%]">
                    Category
                  </th>
                  <th className="h-12 px-4 text-left text-xs font-medium text-muted-foreground w-[10%]">
                    Difficulty
                  </th>
                  <th className="h-12 px-4 text-left text-xs font-medium text-muted-foreground w-[12%]">
                    Stats
                  </th>
                  <th className="h-12 px-6 text-left text-xs font-medium text-muted-foreground w-[18%]">
                    Publisher
                  </th>
                  <th className="h-12 px-4 text-left text-xs font-medium text-muted-foreground w-[10%]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedTemplates.map((template) => (
                  <tr
                    key={template.id}
                    className={cn(
                      'group hover:bg-muted/50 cursor-pointer',
                      'transition-colors duration-100'
                    )}
                    onClick={() => onTemplateClick(template)}
                  >
                    {/* Name Column */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-primary/10 group-hover:bg-primary/20">
                          <Code2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <span
                            className="font-medium group-hover:text-primary truncate max-w-[180px]"
                            title={template.name}
                          >
                            {template.name}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {template.is_official && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800">
                                NEAR Playground
                              </Badge>
                            )}
                            {template.is_featured && !template.is_official && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
                                Featured
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Description Column */}
                    <td className="py-4 px-6">
                      <span className="text-sm text-muted-foreground truncate block max-w-[220px]">
                        {template.description || 'No description'}
                      </span>
                    </td>

                    {/* Category Column */}
                    <td className="py-4 px-4">
                      <Badge variant="outline" className="bg-muted/50 font-normal text-xs">
                        {template.category}
                      </Badge>
                    </td>

                    {/* Difficulty Column */}
                    <td className="py-4 px-4">
                      <Badge
                        variant="outline"
                        className={cn('font-normal text-xs', difficultyColors[template.difficulty] || '')}
                      >
                        {template.difficulty}
                      </Badge>
                    </td>

                    {/* Stats Column */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1" title="Uses">
                          <Download className="h-3 w-3" />
                          {template.uses_count || 0}
                        </span>
                        <span className="flex items-center gap-1" title="Views">
                          <Eye className="h-3 w-3" />
                          {template.view_count || 0}
                        </span>
                        <span className="flex items-center gap-1" title="Likes">
                          <Heart className={cn('h-3 w-3', likedTemplateIds.has(template.id) && 'fill-red-500 text-red-500')} />
                          {template.likes_count || 0}
                        </span>
                      </div>
                    </td>

                    {/* Author Column */}
                    <td className="py-4 px-6">
                      <span className="text-sm text-muted-foreground" title={template.author?.email}>
                        {template.author?.name || template.author?.email || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground/60 block">
                        {formatDistanceToNow(new Date(template.created_at), { addSuffix: true })}
                      </span>
                    </td>

                    {/* Actions Column */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUseTemplate(template);
                          }}
                          className="gap-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Use
                        </Button>
                        {currentUserId && template.user_id === currentUserId && !template.is_official && onDeleteTemplate && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 w-8 p-0"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTemplate(template);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <div>
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTemplates.length)} of{' '}
                {filteredTemplates.length} templates
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
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
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
