import { supabase } from './supabase';
import type { Like } from './types';

export type LikeTargetType = 'template' | 'project' | 'embed';

// ============================================
// Like Operations
// ============================================

/**
 * Check if current user has liked a target
 */
export async function hasUserLiked(
  targetType: LikeTargetType,
  targetId: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .single();

  return !!data;
}

/**
 * Like a target
 */
export async function like(targetType: LikeTargetType, targetId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be logged in to like');
  }

  const { error } = await supabase
    .from('likes')
    .insert({
      user_id: user.id,
      target_type: targetType,
      target_id: targetId,
    });

  // Ignore duplicate key errors (already liked)
  if (error && error.code !== '23505') {
    console.error('Error liking:', error);
    throw error;
  }
}

/**
 * Unlike a target
 */
export async function unlike(targetType: LikeTargetType, targetId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be logged in to unlike');
  }

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  if (error) {
    console.error('Error unliking:', error);
    throw error;
  }
}

/**
 * Toggle like status
 */
export async function toggleLike(
  targetType: LikeTargetType,
  targetId: string
): Promise<boolean> {
  const isLiked = await hasUserLiked(targetType, targetId);

  if (isLiked) {
    await unlike(targetType, targetId);
    return false;
  } else {
    await like(targetType, targetId);
    return true;
  }
}

/**
 * Get all likes for a target
 */
export async function getLikes(
  targetType: LikeTargetType,
  targetId: string
): Promise<Like[]> {
  const { data, error } = await supabase
    .from('likes')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching likes:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get like count for a target
 */
export async function getLikeCount(
  targetType: LikeTargetType,
  targetId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  if (error) {
    console.error('Error fetching like count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get all items liked by current user of a specific type
 */
export async function getUserLikedItems(targetType: LikeTargetType): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('likes')
    .select('target_id')
    .eq('user_id', user.id)
    .eq('target_type', targetType);

  if (error) {
    console.error('Error fetching user liked items:', error);
    return [];
  }

  return (data || []).map(item => item.target_id);
}

// ============================================
// Convenience functions for specific types
// ============================================

// Templates
export const hasUserLikedTemplate = (templateId: string) => hasUserLiked('template', templateId);
export const likeTemplate = (templateId: string) => like('template', templateId);
export const unlikeTemplate = (templateId: string) => unlike('template', templateId);
export const toggleLikeTemplate = (templateId: string) => toggleLike('template', templateId);

// Projects
export const hasUserLikedProject = (projectId: string) => hasUserLiked('project', projectId);
export const likeProject = (projectId: string) => like('project', projectId);
export const unlikeProject = (projectId: string) => unlike('project', projectId);
export const toggleLikeProject = (projectId: string) => toggleLike('project', projectId);

// Embeds
export const hasUserLikedEmbed = (embedId: string) => hasUserLiked('embed', embedId);
export const likeEmbed = (embedId: string) => like('embed', embedId);
export const unlikeEmbed = (embedId: string) => unlike('embed', embedId);
export const toggleLikeEmbed = (embedId: string) => toggleLike('embed', embedId);
