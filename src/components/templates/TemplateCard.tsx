import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Template } from '@/lib/types';
import {
  Code2,
  MessageCircle,
  Coins,
  Image,
  Dices,
  Target,
  Heart,
  Eye,
  Download,
  Github,
  Star,
  FileCode,
  LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Map string icon names to Lucide icons
const iconMap: Record<string, LucideIcon> = {
  Code2,
  MessageCircle,
  Coins,
  Image,
  Dices,
  Target,
  FileCode,
};

// Difficulty colors
const difficultyColors: Record<string, string> = {
  Beginner: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  Intermediate: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  Advanced: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

interface TemplateCardProps {
  template: Template;
  onUse?: (template: Template) => void;
  onClick?: (template: Template) => void;
  onLike?: (template: Template) => void;
  isLiked?: boolean;
  isLikeLoading?: boolean;
  showUseButton?: boolean;
}

export function TemplateCard({
  template,
  onUse,
  onClick,
  onLike,
  isLiked = false,
  isLikeLoading = false,
  showUseButton = true,
}: TemplateCardProps) {
  const Icon = iconMap[template.icon] || Code2;

  const handleCardClick = () => {
    onClick?.(template);
  };

  const handleUseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUse?.(template);
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike?.(template);
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'group relative bg-card rounded-lg border transition-all h-full flex flex-col',
        'hover:border-primary/50 hover:shadow-lg cursor-pointer',
        'dark:hover:shadow-primary/5'
      )}
    >
      {/* Featured Badge */}
      {template.is_featured && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg">
            <Star className="h-3 w-3 mr-1" />
            Featured
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b bg-muted/10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'p-2 rounded-md transition-colors flex-shrink-0',
              'bg-primary/5 group-hover:bg-primary/10'
            )}
          >
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={cn(
                  'font-semibold text-lg transition-colors truncate',
                  'group-hover:text-primary'
                )}
              >
                {template.name}
              </h3>
              {template.is_official && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  Official
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 min-h-[2.5rem]">
              {template.description}
            </p>
          </div>
        </div>

        {/* Like Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLikeClick}
          disabled={isLikeLoading}
          className={cn(
            'h-8 w-8 flex-shrink-0 ml-2',
            isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
          )}
        >
          <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {/* Tags & Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline" className={difficultyColors[template.difficulty] || ''}>
            {template.difficulty}
          </Badge>
          <Badge variant="outline" className="bg-muted/50">
            {template.category}
          </Badge>
          {template.source_type === 'github' && (
            <Badge variant="outline" className="bg-muted/50">
              <Github className="h-3 w-3 mr-1" />
              GitHub
            </Badge>
          )}
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {template.tags.slice(0, 4).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs font-normal bg-secondary/50"
              >
                {tag}
              </Badge>
            ))}
            {template.tags.length > 4 && (
              <Badge variant="secondary" className="text-xs font-normal bg-secondary/50">
                +{template.tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className={cn(
              'flex flex-col items-center p-2 rounded-lg',
              'bg-muted/20 hover:bg-muted/30 transition-colors'
            )}
          >
            <Heart className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-sm font-medium">{template.likes_count || 0}</span>
            <span className="text-xs text-muted-foreground">Likes</span>
          </div>
          <div
            className={cn(
              'flex flex-col items-center p-2 rounded-lg',
              'bg-muted/20 hover:bg-muted/30 transition-colors'
            )}
          >
            <Download className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-sm font-medium">{template.uses_count || 0}</span>
            <span className="text-xs text-muted-foreground">Uses</span>
          </div>
          <div
            className={cn(
              'flex flex-col items-center p-2 rounded-lg',
              'bg-muted/20 hover:bg-muted/30 transition-colors'
            )}
          >
            <Eye className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-sm font-medium">{template.view_count || 0}</span>
            <span className="text-xs text-muted-foreground">Views</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className={cn(
          'p-4 border-t mt-auto',
          'bg-muted/10 group-hover:bg-muted/20 transition-colors'
        )}
      >
        <div className="flex items-center justify-between">
          {/* Author/Date */}
          <div className="text-xs text-muted-foreground">
            {template.author ? (
              <span>by {template.author.name || template.author.email}</span>
            ) : template.published_at ? (
              <span>
                Published {formatDistanceToNow(new Date(template.published_at), { addSuffix: true })}
              </span>
            ) : null}
          </div>

          {/* Use Button */}
          {showUseButton && (
            <Button
              size="sm"
              onClick={handleUseClick}
              className={cn(
                'gap-2 font-medium',
                'bg-primary/10 hover:bg-primary/20 text-primary',
                'dark:bg-primary/20 dark:hover:bg-primary/30'
              )}
              variant="ghost"
            >
              Use Template
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton for loading state
export function TemplateCardSkeleton() {
  return (
    <div className="bg-card rounded-lg border h-full flex flex-col animate-pulse">
      <div className="flex items-start justify-between p-4 border-b bg-muted/10">
        <div className="flex items-center gap-3 flex-1">
          <div className="h-9 w-9 rounded-md bg-muted" />
          <div className="flex-1">
            <div className="h-5 w-32 bg-muted rounded mb-2" />
            <div className="h-4 w-full bg-muted rounded" />
          </div>
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="flex gap-2 mb-4">
          <div className="h-5 w-20 bg-muted rounded" />
          <div className="h-5 w-16 bg-muted rounded" />
        </div>
        <div className="flex gap-1 mb-4">
          <div className="h-5 w-12 bg-muted rounded" />
          <div className="h-5 w-14 bg-muted rounded" />
          <div className="h-5 w-10 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </div>
      <div className="p-4 border-t bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-8 w-24 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
