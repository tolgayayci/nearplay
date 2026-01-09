import { useState, useCallback, useRef } from 'react';
import {
  FileNode,
  OpenFile,
  getLanguageFromPath,
  isFileDirty,
} from '@/lib/types';
import {
  getFileTree,
  readFile,
  writeFile,
  createFile as apiCreateFile,
  createDirectory as apiCreateDirectory,
  deleteFile as apiDeleteFile,
  renameFile as apiRenameFile,
  initializeProject,
} from '@/lib/api';

interface UseProjectFilesOptions {
  userId: string;
  projectId: string;
  initialCode?: string; // For migrating old projects from database
}

interface UseProjectFilesReturn {
  // State
  fileTree: FileNode | null;
  openFiles: OpenFile[];
  activeFilePath: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFileTree: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  reloadFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  closeAllFiles: () => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;
  createFile: (path: string) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;

  // Helpers
  getOpenFile: (path: string) => OpenFile | undefined;
  hasUnsavedChanges: () => boolean;
  getActiveFile: () => OpenFile | undefined;
}

export function useProjectFiles({
  userId,
  projectId,
  initialCode,
}: UseProjectFilesOptions): UseProjectFilesReturn {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep track of initialization
  const initialized = useRef(false);

  // Load file tree from backend
  const loadFileTree = useCallback(async () => {
    if (!userId || !projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Initialize project if needed (creates from template or migrates from database)
      if (!initialized.current) {
        await initializeProject(userId, projectId, initialCode);
        initialized.current = true;
      }

      const tree = await getFileTree(userId, projectId);
      setFileTree(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file tree');
      console.error('Failed to load file tree:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId, initialCode]);

  // Open a file (reads content from backend)
  const openFile = useCallback(async (path: string) => {
    // Check if file is already open
    const existing = openFiles.find(f => f.path === path);
    if (existing) {
      setActiveFilePath(path);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fileContent = await readFile(userId, projectId, path);
      const fileName = path.split('/').pop() || path;

      const newFile: OpenFile = {
        path,
        name: fileName,
        content: fileContent.content,
        originalContent: fileContent.content,
        language: getLanguageFromPath(path),
      };

      setOpenFiles(prev => [...prev, newFile]);
      setActiveFilePath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file');
      console.error('Failed to open file:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId, openFiles]);

  // Reload a file from backend (force refresh if already open)
  const reloadFile = useCallback(async (path: string) => {
    const existing = openFiles.find(f => f.path === path);
    if (!existing) {
      // File not open, nothing to reload
      return;
    }

    try {
      const fileContent = await readFile(userId, projectId, path);

      setOpenFiles(prev =>
        prev.map(f =>
          f.path === path
            ? { ...f, content: fileContent.content, originalContent: fileContent.content }
            : f
        )
      );
    } catch (err) {
      console.error('Failed to reload file:', err);
    }
  }, [userId, projectId, openFiles]);

  // Close a file
  const closeFile = useCallback((path: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== path));

    // If closing active file, switch to another
    if (activeFilePath === path) {
      setOpenFiles(prev => {
        const remaining = prev.filter(f => f.path !== path);
        if (remaining.length > 0) {
          setActiveFilePath(remaining[remaining.length - 1].path);
        } else {
          setActiveFilePath(null);
        }
        return remaining;
      });
    }
  }, [activeFilePath]);

  // Close all files
  const closeAllFiles = useCallback(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
  }, []);

  // Set active file
  const setActiveFile = useCallback((path: string) => {
    const file = openFiles.find(f => f.path === path);
    if (file) {
      setActiveFilePath(path);
    }
  }, [openFiles]);

  // Update file content (in memory)
  const updateFileContent = useCallback((path: string, content: string) => {
    setOpenFiles(prev =>
      prev.map(f =>
        f.path === path ? { ...f, content } : f
      )
    );
  }, []);

  // Save a file to backend
  const saveFile = useCallback(async (path: string) => {
    const file = openFiles.find(f => f.path === path);
    if (!file || !isFileDirty(file)) return;

    setIsLoading(true);
    setError(null);

    try {
      await writeFile(userId, projectId, path, file.content);

      // Update original content to match saved content
      setOpenFiles(prev =>
        prev.map(f =>
          f.path === path ? { ...f, originalContent: f.content } : f
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
      console.error('Failed to save file:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId, openFiles]);

  // Save all open files
  const saveAllFiles = useCallback(async () => {
    const dirtyFiles = openFiles.filter(f => isFileDirty(f));

    for (const file of dirtyFiles) {
      await saveFile(file.path);
    }
  }, [openFiles, saveFile]);

  // Create a new file
  const createFile = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiCreateFile(userId, projectId, path);
      await loadFileTree();

      // Open the new file
      await openFile(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file');
      console.error('Failed to create file:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId, loadFileTree, openFile]);

  // Create a new directory
  const createDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiCreateDirectory(userId, projectId, path);
      await loadFileTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create directory');
      console.error('Failed to create directory:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId, loadFileTree]);

  // Delete a file or directory
  const deleteFile = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiDeleteFile(userId, projectId, path);

      // Close the file if it's open
      closeFile(path);

      await loadFileTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
      console.error('Failed to delete file:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId, loadFileTree, closeFile]);

  // Rename a file or directory
  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiRenameFile(userId, projectId, oldPath, newPath);

      // Update open file path if renamed
      setOpenFiles(prev =>
        prev.map(f => {
          if (f.path === oldPath) {
            return {
              ...f,
              path: newPath,
              name: newPath.split('/').pop() || newPath,
              language: getLanguageFromPath(newPath),
            };
          }
          return f;
        })
      );

      // Update active file path if renamed
      if (activeFilePath === oldPath) {
        setActiveFilePath(newPath);
      }

      await loadFileTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename file');
      console.error('Failed to rename file:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId, loadFileTree, activeFilePath]);

  // Helper: get open file by path
  const getOpenFile = useCallback((path: string) => {
    return openFiles.find(f => f.path === path);
  }, [openFiles]);

  // Helper: check if any files have unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return openFiles.some(f => isFileDirty(f));
  }, [openFiles]);

  // Helper: get currently active file
  const getActiveFile = useCallback(() => {
    if (!activeFilePath) return undefined;
    return openFiles.find(f => f.path === activeFilePath);
  }, [activeFilePath, openFiles]);

  return {
    // State
    fileTree,
    openFiles,
    activeFilePath,
    isLoading,
    error,

    // Actions
    loadFileTree,
    openFile,
    reloadFile,
    closeFile,
    closeAllFiles,
    setActiveFile,
    updateFileContent,
    saveFile,
    saveAllFiles,
    createFile,
    createDirectory,
    deleteFile,
    renameFile,

    // Helpers
    getOpenFile,
    hasUnsavedChanges,
    getActiveFile,
  };
}
