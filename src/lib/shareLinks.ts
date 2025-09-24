import { supabase } from './supabase';

export interface ShareLink {
  id: string;
  project_id: string;
  token: string;
  created_at: string;
  expires_at?: string;
  view_count: number;
  last_viewed_at?: string;
  is_active: boolean;
}

/**
 * Generate or retrieve a share link for a project
 */
export async function getOrCreateShareLink(projectId: string): Promise<ShareLink | null> {
  try {
    // First, check if an active share link already exists
    const { data: existingLink, error: fetchError } = await supabase
      .from('share_links')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingLink && !fetchError) {
      return existingLink;
    }

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Generate a new share link using the database function
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_share_token');

    if (tokenError || !tokenData) {
      throw new Error('Failed to generate share token');
    }

    // Create the share link
    const { data: newLink, error: createError } = await supabase
      .from('share_links')
      .insert({
        project_id: projectId,
        token: tokenData,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) throw createError;

    return newLink;
  } catch (error) {
    console.error('Error creating share link:', error);
    return null;
  }
}

/**
 * Get project by share token
 */
export async function getProjectByShareToken(token: string) {
  try {
    // First get the share link
    const { data: shareLink, error: linkError } = await supabase
      .from('share_links')
      .select('project_id, is_active')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (linkError || !shareLink) {
      throw new Error('Invalid or expired share link');
    }

    // Then get the project with user info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        user:user_id (
          id,
          email
        )
      `)
      .eq('id', shareLink.project_id)
      .eq('is_public', true)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found or not public');
    }

    return { project, shareToken: token };
  } catch (error) {
    console.error('Error fetching project by share token:', error);
    throw error;
  }
}

/**
 * Record a view for a shared project
 */
export async function recordShareView(projectId: string, shareToken?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Insert view record
    await supabase
      .from('project_views')
      .insert({
        project_id: projectId,
        viewer_id: user?.id,
        viewer_ip: 'anonymous',
        share_token: shareToken,
      });

    // The database trigger will automatically increment view counts
  } catch (error) {
    console.warn('Failed to record view:', error);
  }
}

/**
 * Deactivate a share link
 */
export async function deactivateShareLink(token: string) {
  try {
    const { error } = await supabase
      .from('share_links')
      .update({ is_active: false })
      .eq('token', token);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deactivating share link:', error);
    return false;
  }
}

/**
 * Get share link statistics
 */
export async function getShareLinkStats(projectId: string) {
  try {
    const { data, error } = await supabase
      .from('share_links')
      .select('token, view_count, created_at, last_viewed_at')
      .eq('project_id', projectId)
      .eq('is_active', true);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching share link stats:', error);
    return [];
  }
}