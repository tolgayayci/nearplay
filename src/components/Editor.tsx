import { useState, useRef, useEffect } from 'react';
import MonacoEditor from "@monaco-editor/react";
import { EditorHeader } from './editor/EditorHeader';
import { FileTabs } from './editor/FileTabs';
import { DeployDialog } from './editor/DeployDialog';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { FileCode2 } from 'lucide-react';
import {
  initializeMonaco,
  defineEditorTheme,
  defaultEditorOptions
} from '@/lib/editor';
import { CompilationResult, OpenFile } from '@/lib/types';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onCompile?: () => Promise<void>;
  isCompiling?: boolean;
  readOnly?: boolean;
  projectId?: string;
  lastCompilation?: CompilationResult | null;
  onDeploySuccess?: () => void;
  onSave?: () => void;
  isSharedView?: boolean;
  onRequestDeploy?: () => void;
  onOpenTests?: () => void;
  language?: string;
  filePath?: string;
  showHeader?: boolean;
  // Multi-file tab props
  openFiles?: OpenFile[];
  activeFilePath?: string | null;
  onSelectFile?: (path: string) => void;
  onCloseFile?: (path: string) => void;
  onCloseAllFiles?: () => void;
  // Jump to line (from search results)
  goToLine?: number | null;
}

export function Editor({
  value,
  onChange,
  onCompile,
  isCompiling,
  readOnly = false,
  projectId,
  lastCompilation,
  onDeploySuccess,
  onSave,
  isSharedView = false,
  onRequestDeploy,
  onOpenTests,
  language = 'rust',
  filePath,
  showHeader = true,
  openFiles,
  activeFilePath,
  onSelectFile,
  onCloseFile,
  onCloseAllFiles,
  goToLine,
}: EditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [showABIError, setShowABIError] = useState(false);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const { theme, systemTheme } = useTheme();
  const { toast } = useToast();

  // Get the effective theme (system or user preference)
  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    initializeMonaco(monaco);
    defineEditorTheme(monaco, effectiveTheme === 'dark');

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSave);
  };

  const handleSave = async () => {
    if (!projectId || !editorRef.current || isSaving || isSharedView) return;
    
    setIsSaving(true);
    try {
      const currentValue = editorRef.current.getValue();
      
      const { error } = await supabase
        .from('projects')
        .update({ 
          code: currentValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Changes saved",
        description: "Your code has been saved successfully",
      });

      // Call onSave callback to update parent component
      onSave?.();
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: "Save failed",
        description: "Failed to save your changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeployClick = () => {
    // If we have a shared deploy handler, use it
    if (onRequestDeploy) {
      onRequestDeploy();
      return;
    }

    // Otherwise use local logic
    // Check if we have a valid ABI from the last compilation
    // Handle both array format and NEAR's body.functions format
    let hasValidABI = false;

    if (lastCompilation?.success && lastCompilation?.abi) {
      // Check for array format (our backend returns this)
      if (Array.isArray(lastCompilation.abi)) {
        hasValidABI = lastCompilation.abi.length > 0;
      }
      // Check for NEAR's official ABI format
      else if (typeof lastCompilation.abi === 'object' &&
               lastCompilation.abi.body?.functions &&
               Array.isArray(lastCompilation.abi.body.functions)) {
        hasValidABI = lastCompilation.abi.body.functions.length > 0;
      }
    }

    if (!hasValidABI) {
      setShowABIError(true);
      setShowDeployDialog(true);
      return;
    }

    setShowABIError(false);
    setShowDeployDialog(true);
  };

  const handleDeploySuccess = () => {
    // Close the deploy dialog
    setShowDeployDialog(false);
    setShowABIError(false);
    
    // Show success message
    toast({
      title: "Success",
      description: "Contract deployed successfully. ABI view will refresh.",
    });

    // Call the onDeploySuccess callback if provided
    if (onDeploySuccess) {
      onDeploySuccess();
    }
  };

  // Update theme when it changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      defineEditorTheme(monacoRef.current, effectiveTheme === 'dark');
    }
  }, [effectiveTheme]);

  // Jump to line when goToLine changes
  useEffect(() => {
    if (goToLine && editorRef.current && monacoRef.current) {
      // Small delay to ensure editor is ready
      setTimeout(() => {
        const editor = editorRef.current;
        // Scroll to line and center it
        editor.revealLineInCenter(goToLine);
        // Set cursor position
        editor.setPosition({ lineNumber: goToLine, column: 1 });
        // Highlight the line briefly
        const decorations = editor.deltaDecorations([], [
          {
            range: new monacoRef.current.Range(goToLine, 1, goToLine, 1),
            options: {
              isWholeLine: true,
              className: 'search-highlight-line',
              glyphMarginClassName: 'search-highlight-glyph',
            },
          },
        ]);
        // Remove highlight after 2 seconds
        setTimeout(() => {
          editor.deltaDecorations(decorations, []);
        }, 2000);
        // Focus the editor
        editor.focus();
      }, 100);
    }
  }, [goToLine, activeFilePath]);

  return (
    <div className="h-full flex flex-col bg-background border rounded-md overflow-hidden">
      {showHeader && (
        <EditorHeader
          onCompile={onCompile || (() => {})}
          onDeploy={handleDeployClick}
          onSave={handleSave}
          onOpenTests={onOpenTests || (() => {})}
          isCompiling={isCompiling || false}
          isSaving={isSaving}
          hasSuccessfulCompilation={lastCompilation?.success}
          isSharedView={isSharedView}
        />
      )}
      {openFiles && openFiles.length > 0 && onSelectFile && onCloseFile && (
        <FileTabs
          openFiles={openFiles}
          activeFilePath={activeFilePath || null}
          onSelectFile={onSelectFile}
          onCloseFile={onCloseFile}
          onCloseAllFiles={onCloseAllFiles}
        />
      )}
      <div className="flex-1 min-h-0 relative">
        <MonacoEditor
          height="100%"
          language={language}
          value={value}
          onChange={(value) => onChange(value || '')}
          path={filePath}
          options={{
            ...defaultEditorOptions,
            readOnly: readOnly || isCompiling || isSharedView,
            theme: effectiveTheme === 'dark' ? 'rust-dark' : 'rust-light',
          }}
          onMount={handleEditorDidMount}
          loading={
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
              <div className="text-center">
                <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-6">
                  <FileCode2 className="h-6 w-6 text-primary animate-pulse" />
                </div>
                <h3 className="font-medium mb-3">Loading Editor</h3>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Initializing development environment
                  </p>
                  <p className="text-sm text-muted-foreground">
                    with {language === 'rust' ? 'Rust' : language} support
                  </p>
                </div>
              </div>
            </div>
          }
        />
      </div>
      {projectId && !isSharedView && !onRequestDeploy && (
        <DeployDialog
          open={showDeployDialog}
          onOpenChange={setShowDeployDialog}
          projectId={projectId}
          lastCompilation={lastCompilation}
          onDeploySuccess={handleDeploySuccess}
          showABIError={showABIError}
        />
      )}
    </div>
  );
}