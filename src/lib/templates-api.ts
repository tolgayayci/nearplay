import { supabase } from './supabase';
import { API_URL } from './config';
import { parseGitHubUrl } from './github';
import type {
  Template,
  TemplateFilters,
  CreateTemplateInput,
  UpdateTemplateInput,
} from './types';

// ============================================
// Template CRUD Operations (Supabase)
// ============================================

/**
 * Fetch templates with optional filters
 */
export async function getTemplates(filters?: TemplateFilters): Promise<Template[]> {
  let query = supabase
    .from('templates')
    .select('*')
    .eq('is_published', true);

  // Apply filters
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.difficulty) {
    query = query.eq('difficulty', filters.difficulty);
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags);
  }

  if (filters?.official !== undefined) {
    query = query.eq('is_official', filters.official);
  }

  if (filters?.featured !== undefined) {
    query = query.eq('is_featured', filters.featured);
  }

  // Apply sorting
  switch (filters?.sortBy) {
    case 'popular':
      query = query.order('view_count', { ascending: false });
      break;
    case 'most_used':
      query = query.order('uses_count', { ascending: false });
      break;
    case 'most_liked':
      query = query.order('likes_count', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('published_at', { ascending: false });
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }

  const templates = (data || []).map(formatTemplateResponse);

  // Fetch author info for all templates (filter out null user_ids for official templates)
  const userIds = templates.map(t => t.user_id).filter((id): id is string => id != null);
  const authorMap = await fetchAuthors(userIds);

  // Attach author info to templates
  for (const template of templates) {
    if (template.is_official) {
      // Official templates show "Near Playground" as publisher
      template.author = {
        id: 'near-playground',
        email: 'hello@nearplay.app',
        name: 'NEAR Playground',
      };
    } else if (template.user_id) {
      template.author = authorMap.get(template.user_id);
    }
  }

  return templates;
}

/**
 * Fetch a single template by ID
 */
export async function getTemplate(id: string): Promise<Template | null> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching template:', error);
    throw error;
  }

  const template = formatTemplateResponse(data);

  // Fetch author info (handle official templates with null user_id)
  if (template.is_official) {
    template.author = {
      id: 'near-playground',
      email: 'hello@nearplay.app',
      name: 'NEAR Playground',
    };
  } else if (template.user_id) {
    template.author = await fetchAuthor(template.user_id);
  }

  return template;
}

/**
 * Fetch templates created by current user
 */
export async function getUserTemplates(): Promise<Template[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be logged in');
  }

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user templates:', error);
    throw error;
  }

  const templates = (data || []).map(formatTemplateResponse);

  // Fetch author info
  const userIds = templates.map(t => t.user_id);
  const authorMap = await fetchAuthors(userIds);

  for (const template of templates) {
    template.author = authorMap.get(template.user_id);
  }

  return templates;
}

/**
 * Create a new template from GitHub
 */
export async function createTemplateFromGitHub(input: CreateTemplateInput): Promise<Template> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be logged in to create a template');
  }

  // Generate a temporary ID for storage
  const templateId = crypto.randomUUID();

  // Parse GitHub URL to get base repo URL (without /tree/branch/path)
  const parsed = parseGitHubUrl(input.github_url || '');
  if (!parsed) {
    throw new Error('Invalid GitHub URL');
  }

  // Clone from GitHub to backend storage
  const response = await fetch(`${API_URL}/api/templates/create/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: templateId,
      github_url: parsed.url,  // Use parsed base URL, not the full URL with /tree/...
      branch: input.github_branch || parsed.branch,  // Prefer explicit, fallback to parsed
      path: input.github_path || parsed.path,  // Prefer explicit, fallback to parsed
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = 'Failed to clone from GitHub';
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) {
    throw new Error('Empty response from server');
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from server: ${text.substring(0, 100)}`);
  }

  if (!result.success || !result.data?.storage_path) {
    throw new Error(result.message || result.error || 'Failed to clone from GitHub');
  }

  // Create template record in Supabase (parsed is already available from earlier)
  const { data, error } = await supabase
    .from('templates')
    .insert({
      id: templateId,
      user_id: user.id,
      name: input.name,
      description: input.description,
      source_type: 'github',
      storage_path: result.data.storage_path,
      github_url: parsed.url,  // Store the base repo URL
      github_owner: parsed.owner,
      github_repo: parsed.repo,
      github_branch: input.github_branch || parsed.branch || 'main',
      github_path: input.github_path || parsed.path,
      category: input.category || 'Basic',
      difficulty: input.difficulty || 'Beginner',
      tags: input.tags || [],
      icon: input.icon || 'Code2',
      is_published: input.is_published ?? true,
      published_at: input.is_published ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    // Clean up storage on failure
    await fetch(`${API_URL}/api/templates/${templateId}`, { method: 'DELETE' });
    throw error;
  }

  const template = formatTemplateResponse(data);

  // Fetch and attach author info
  template.author = await fetchAuthor(user.id);

  return template;
}

/**
 * Create a new template from an existing project
 */
export async function createTemplateFromProject(
  input: CreateTemplateInput,
  projectUserId: string
): Promise<Template> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be logged in to create a template');
  }

  if (!input.source_project_id) {
    throw new Error('source_project_id is required');
  }

  // Generate a temporary ID for storage
  const templateId = crypto.randomUUID();

  // Copy project to backend storage
  const response = await fetch(`${API_URL}/api/templates/create/project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: templateId,
      user_id: projectUserId,
      project_id: input.source_project_id,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = 'Failed to copy project';
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) {
    throw new Error('Empty response from server');
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from server: ${text.substring(0, 100)}`);
  }

  if (!result.success || !result.data?.storage_path) {
    throw new Error(result.message || result.error || 'Failed to copy project');
  }

  // Create template record in Supabase
  const { data, error } = await supabase
    .from('templates')
    .insert({
      id: templateId,
      user_id: user.id,
      name: input.name,
      description: input.description,
      source_type: 'project',
      storage_path: result.data.storage_path,
      source_project_id: input.source_project_id,
      category: input.category || 'Basic',
      difficulty: input.difficulty || 'Beginner',
      tags: input.tags || [],
      icon: input.icon || 'Code2',
      is_published: input.is_published ?? true,
      published_at: input.is_published ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    // Clean up storage on failure
    await fetch(`${API_URL}/api/templates/${templateId}`, { method: 'DELETE' });
    throw error;
  }

  const template = formatTemplateResponse(data);

  // Fetch and attach author info
  template.author = await fetchAuthor(user.id);

  return template;
}

/**
 * Update an existing template
 */
export async function updateTemplate(id: string, input: UpdateTemplateInput): Promise<Template> {
  const updateData: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  // Set published_at if newly published
  if (input.is_published === true) {
    const existing = await getTemplate(id);
    if (existing && !existing.is_published) {
      updateData.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating template:', error);
    throw error;
  }

  return formatTemplateResponse(data);
}

/**
 * Delete a template (also deletes backend storage)
 */
export async function deleteTemplate(id: string): Promise<void> {
  // Delete backend storage first
  await fetch(`${API_URL}/api/templates/${id}`, { method: 'DELETE' });

  // Delete from Supabase (cascades to embeds)
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}

// ============================================
// Template Files (Backend API)
// ============================================

export interface TemplateFileNode {
  name: string;
  path: string;
  is_directory: boolean;
  children?: TemplateFileNode[];
  size?: number;
}

/**
 * Get file tree for a template
 */
export async function getTemplateFiles(templateId: string): Promise<TemplateFileNode> {
  const response = await fetch(`${API_URL}/api/templates/${templateId}/files`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to get template files');
  }

  return result.data;
}

/**
 * Get specific file content from a template
 */
export async function getTemplateFile(templateId: string, filePath: string): Promise<string> {
  const response = await fetch(
    `${API_URL}/api/templates/${templateId}/files/${encodeURIComponent(filePath)}`
  );
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to get file content');
  }

  return result.data.content;
}

/**
 * Get main code (src/lib.rs) for quick preview
 */
export async function getTemplateMainCode(templateId: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/templates/${templateId}/code`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to get template code');
  }

  return result.data.content;
}

// ============================================
// Use Template (Create Project from Template)
// ============================================

/**
 * Create a new project from a template
 */
export async function useTemplate(
  templateId: string,
  userId: string,
  newProjectId: string
): Promise<string> {
  const response = await fetch(`${API_URL}/api/templates/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: templateId,
      user_id: userId,
      new_project_id: newProjectId,
    }),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to create project from template');
  }

  // Note: Uses count is incremented by the caller (UseTemplateDialog)
  return result.data.project_path;
}

// ============================================
// View & Use Tracking
// ============================================

/**
 * Increment template view count
 */
export async function incrementTemplateViews(templateId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_template_views', {
    template_id_param: templateId,
  });

  if (error) {
    console.error('Error incrementing template views:', error);
  }
}

/**
 * Increment template uses count
 */
export async function incrementTemplateUses(templateId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_template_uses', {
    template_id_param: templateId,
  });

  if (error) {
    console.error('Error incrementing template uses:', error);
  }
}

// ============================================
// Categories & Tags
// ============================================

/**
 * Get all unique categories
 */
export async function getTemplateCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('category')
    .eq('is_published', true);

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return [...new Set((data || []).map(t => t.category).filter(Boolean))].sort();
}

/**
 * Get all unique tags
 */
export async function getTemplateTags(): Promise<string[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('tags')
    .eq('is_published', true);

  if (error) {
    console.error('Error fetching tags:', error);
    return [];
  }

  return [...new Set((data || []).flatMap(t => t.tags || []))].sort();
}

// ============================================
// Author Lookup
// ============================================

/**
 * Fetch author info for a single user_id
 */
async function fetchAuthor(userId: string): Promise<Template['author'] | undefined> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching author:', error);
    return undefined;
  }

  if (!data) {
    console.warn('No author data found for userId:', userId);
    return undefined;
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    avatar_url: data.avatar_url,
  };
}

/**
 * Fetch author info for multiple user_ids
 */
async function fetchAuthors(userIds: string[]): Promise<Map<string, Template['author']>> {
  const uniqueIds = [...new Set(userIds)];
  const authorMap = new Map<string, Template['author']>();

  if (uniqueIds.length === 0) {
    return authorMap;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, avatar_url')
    .in('id', uniqueIds);

  if (error) {
    console.error('Error fetching authors:', error);
    return authorMap;
  }

  if (!data || data.length === 0) {
    console.warn('No author data found for userIds:', uniqueIds);
    return authorMap;
  }

  for (const user of data) {
    authorMap.set(user.id, {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    });
  }

  return authorMap;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format template response
 */
function formatTemplateResponse(data: Record<string, unknown>): Template {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    name: data.name as string,
    description: data.description as string | undefined,
    source_type: data.source_type as Template['source_type'],
    storage_path: data.storage_path as string | undefined,
    github_url: data.github_url as string | undefined,
    github_owner: data.github_owner as string | undefined,
    github_repo: data.github_repo as string | undefined,
    github_branch: data.github_branch as string | undefined,
    github_path: data.github_path as string | undefined,
    source_project_id: data.source_project_id as string | undefined,
    category: data.category as string,
    difficulty: data.difficulty as Template['difficulty'],
    tags: (data.tags as string[]) || [],
    icon: data.icon as string,
    likes_count: data.likes_count as number,
    uses_count: data.uses_count as number,
    view_count: data.view_count as number,
    is_official: data.is_official as boolean,
    is_published: data.is_published as boolean,
    is_featured: data.is_featured as boolean,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    published_at: data.published_at as string | undefined,
  };
}
