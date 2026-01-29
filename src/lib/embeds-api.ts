import { supabase } from './supabase';
import type {
  Embed,
  EmbedClick,
  CreateEmbedInput,
  UpdateEmbedInput,
} from './types';

// ============================================
// Embed CRUD Operations
// ============================================

/**
 * Fetch all embeds for the current user
 */
export async function getUserEmbeds(): Promise<Embed[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be logged in to view embeds');
  }

  const { data, error } = await supabase
    .from('embeds')
    .select(`
      *,
      template:template_id (
        id,
        name,
        description,
        icon,
        category
      ),
      project:project_id (
        id,
        name,
        description
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user embeds:', error);
    throw error;
  }

  return (data || []).map(formatEmbedResponse);
}

/**
 * Fetch a single embed by ID (public)
 */
export async function getEmbed(id: string): Promise<Embed | null> {
  // First check if embed exists at all (without joins that might fail due to RLS)
  const { data: embedOnly, error: embedError } = await supabase
    .from('embeds')
    .select('*')
    .eq('id', id)
    .single();

  if (embedError) {
    if (embedError.code === 'PGRST116') {
      console.log('Embed not found in database:', id);
      return null;
    }
    console.error('Error fetching embed:', embedError);
    throw embedError;
  }

  console.log('Embed found:', embedOnly);

  // Now fetch with joins
  const { data, error } = await supabase
    .from('embeds')
    .select(`
      *,
      template:template_id (
        id,
        name,
        description,
        icon,
        category,
        code,
        github_url,
        github_owner,
        github_repo,
        github_branch,
        github_path,
        source_type
      ),
      project:project_id (
        id,
        name,
        description,
        code
      ),
      author:user_id (
        id,
        email,
        name,
        avatar_url
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching embed with joins:', error);
    // Return basic embed data if joins fail
    return formatEmbedResponse(embedOnly);
  }

  console.log('Embed with joins:', data);
  return formatEmbedResponse(data);
}

/**
 * Create a new embed
 */
export async function createEmbed(input: CreateEmbedInput): Promise<Embed> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be logged in to create an embed');
  }

  // Prepare snapshot data for project and template embeds
  let snapshotCode: string | null = null;
  let snapshotName: string | null = null;
  let snapshotDescription: string | null = null;

  if (input.source_type === 'project' && input.project_id) {
    // Fetch project data to create a snapshot
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('code, name, description')
      .eq('id', input.project_id)
      .single();

    if (projectError) {
      console.error('Error fetching project for snapshot:', projectError);
      throw new Error('Failed to fetch project data');
    }

    if (project) {
      snapshotCode = project.code;
      snapshotName = project.name;
      snapshotDescription = project.description;
    }
  } else if (input.source_type === 'template' && input.template_id) {
    // Fetch template data to create a snapshot
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('name, description')
      .eq('id', input.template_id)
      .single();

    if (templateError) {
      console.error('Error fetching template for snapshot:', templateError);
      throw new Error('Failed to fetch template data');
    }

    if (template) {
      snapshotName = template.name;
      snapshotDescription = template.description;
    }
  }

  const { data, error } = await supabase
    .from('embeds')
    .insert({
      user_id: user.id,
      source_type: input.source_type,
      template_id: input.template_id,
      project_id: input.project_id,
      github_url: input.github_url,
      button_text: input.button_text || 'Open in NearPlay',
      button_style: input.button_style || 'primary',
      button_size: input.button_size || 'default',
      theme: input.theme || 'auto',
      name: input.name,
      // Snapshot data for project embeds
      code: snapshotCode,
      snapshot_name: snapshotName,
      snapshot_description: snapshotDescription,
    })
    .select(`
      *,
      template:template_id (
        id,
        name,
        description,
        icon,
        category
      ),
      project:project_id (
        id,
        name,
        description
      )
    `)
    .single();

  if (error) {
    console.error('Error creating embed:', error);
    throw error;
  }

  return formatEmbedResponse(data);
}

/**
 * Update an existing embed
 */
export async function updateEmbed(id: string, input: UpdateEmbedInput): Promise<Embed> {
  const { data, error } = await supabase
    .from('embeds')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      template:template_id (
        id,
        name,
        description,
        icon,
        category
      ),
      project:project_id (
        id,
        name,
        description
      )
    `)
    .single();

  if (error) {
    console.error('Error updating embed:', error);
    throw error;
  }

  return formatEmbedResponse(data);
}

/**
 * Delete an embed
 */
export async function deleteEmbed(id: string): Promise<void> {
  const { error } = await supabase
    .from('embeds')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting embed:', error);
    throw error;
  }
}

// ============================================
// Embed Tracking
// ============================================

/**
 * Record an embed click
 */
export async function recordEmbedClick(
  embedId: string,
  referrer?: string,
  userAgent?: string
): Promise<void> {
  const { error } = await supabase
    .from('embed_clicks')
    .insert({
      embed_id: embedId,
      referrer: referrer,
      user_agent: userAgent,
    });

  if (error) {
    console.error('Error recording embed click:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Increment embed view count
 */
export async function incrementEmbedViews(embedId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_embed_views', {
    embed_id_param: embedId,
  });

  if (error) {
    console.error('Error incrementing embed views:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Get click analytics for an embed
 */
export async function getEmbedClicks(
  embedId: string,
  limit: number = 100
): Promise<EmbedClick[]> {
  const { data, error } = await supabase
    .from('embed_clicks')
    .select('*')
    .eq('embed_id', embedId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching embed clicks:', error);
    throw error;
  }

  return data || [];
}

// ============================================
// Code Generation
// ============================================

/**
 * Generate HTML embed code for an embed
 */
export function generateEmbedCode(embed: Embed, baseUrl: string = 'https://nearplay.app'): {
  html: string;
  markdown: string;
  imageUrl: string;
} {
  const embedUrl = `${baseUrl}/embed/${embed.id}`;
  const imageUrl = generateButtonImageUrl(embed, baseUrl);

  // HTML with image badge
  const html = `<a href="${embedUrl}" target="_blank" rel="noopener noreferrer">
  <img src="${imageUrl}" alt="${embed.button_text}" />
</a>`;

  // Markdown badge
  const markdown = `[![${embed.button_text}](${imageUrl})](${embedUrl})`;

  return { html, markdown, imageUrl };
}

/**
 * Generate button image URL (using shields.io style)
 */
export function generateButtonImageUrl(embed: Embed, baseUrl: string = 'https://nearplay.app'): string {
  const text = encodeURIComponent(embed.button_text);
  const style = embed.button_style === 'ghost' ? 'flat' :
                embed.button_style === 'outline' ? 'flat-square' : 'for-the-badge';

  // Using shields.io for button generation
  const color = embed.button_style === 'primary' ? '14b8a6' : // teal-500
               embed.button_style === 'secondary' ? '64748b' : // slate
               embed.button_style === 'outline' ? '0d9488' : // teal-600
               '0f766e'; // ghost - teal-700

  return `https://img.shields.io/badge/${text}-${color}?style=${style}&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTE4IDcgNCA0LTQgNE00IDEybDQgNC00LTQgNC00Ii8+PC9zdmc+&logoColor=white`;
}

/**
 * Generate inline HTML button code
 */
export function generateInlineButtonCode(embed: Embed, baseUrl: string = 'https://nearplay.app'): string {
  const embedUrl = `${baseUrl}/embed/${embed.id}`;

  const sizeClasses = {
    sm: 'padding: 6px 12px; font-size: 12px;',
    default: 'padding: 8px 16px; font-size: 14px;',
    lg: 'padding: 12px 24px; font-size: 16px;',
  };

  const styleClasses = {
    primary: 'background: #14b8a6; color: white; border: none;',
    secondary: 'background: #64748b; color: white; border: none;',
    outline: 'background: transparent; color: #0d9488; border: 2px solid #0d9488;',
    ghost: 'background: transparent; color: #0d9488; border: none;',
  };

  const styles = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    ${sizeClasses[embed.button_size]}
    ${styleClasses[embed.button_style]}
    border-radius: 6px;
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: opacity 0.2s;
  `.replace(/\s+/g, ' ').trim();

  return `<a href="${embedUrl}" target="_blank" rel="noopener noreferrer" style="${styles}">
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 7 4 4-4 4M4 12l4 4-4-4 4-4"/></svg>
  ${embed.button_text}
</a>`;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format embed response to match Embed interface
 */
function formatEmbedResponse(data: Record<string, unknown>): Embed {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    source_type: data.source_type as Embed['source_type'],
    template_id: data.template_id as string | undefined,
    project_id: data.project_id as string | undefined,
    github_url: data.github_url as string | undefined,
    button_text: data.button_text as string,
    button_style: data.button_style as Embed['button_style'],
    button_size: data.button_size as Embed['button_size'],
    theme: data.theme as Embed['theme'],
    click_count: data.click_count as number,
    view_count: data.view_count as number,
    name: data.name as string | undefined,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    // Snapshot data for project embeds
    code: data.code as string | undefined,
    snapshot_name: data.snapshot_name as string | undefined,
    snapshot_description: data.snapshot_description as string | undefined,
    // Joined data
    template: data.template as Embed['template'],
    project: data.project as Embed['project'],
    author: data.author as Embed['author'],
  };
}
