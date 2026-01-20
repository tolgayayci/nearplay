import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FileCode2,
  PlayCircle,
  PlayIcon,
  Wand2,
  Clock,
  Calendar,
  Pencil,
  Check,
  X,
  Bug,
  RocketIcon,
  Loader2,
  FolderTree,
  Terminal as TerminalIcon,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Editor } from "@/components/Editor";
import { useToast } from "@/hooks/use-toast";
import { Project, CompilationResult, FileNode } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { compileContract, exportProject } from "@/lib/api";
import { useAuth } from "@/App";
import { UserNav } from "@/components/UserNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ABIView } from "@/components/views/ABIView";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/seo/SEO";
import { DeployDialog } from "@/components/editor/DeployDialog";
import { Badge } from "@/components/ui/badge";
import { WalletButton } from "@/components/wallet/WalletButton";
import { RPCSettingsPanel } from "@/components/settings/RPCSettingsPanel";
import { RPCDropdown } from "@/components/settings/RPCDropdown";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { FileExplorer, FileExplorerRef } from "@/components/explorer/FileExplorer";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { Terminal } from "@/components/terminal/Terminal";
import { PackageManagerModal } from "@/components/packages/PackageManagerModal";
import { TestsModal } from "@/components/testing/TestsModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const VIEWS = [
  { id: "files", title: "Files", icon: FolderTree, position: "left" },
  { id: "editor", title: "Editor", icon: FileCode2, position: "center" },
  { id: "abi", title: "Contract Interface", icon: PlayCircle, position: "center" },
  { id: "terminal", title: "Terminal", icon: TerminalIcon, position: "right" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

export function EditorPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [activeViews, setActiveViews] = useState<ViewId[]>([
    "files",
    "editor",
    "abi",
    "terminal",
  ]);
  const [lastCompilationResult, setLastCompilationResult] =
    useState<CompilationResult | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [refreshABITrigger, setRefreshABITrigger] = useState(0);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [showABIError, setShowABIError] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showTestsModal, setShowTestsModal] = useState(false);
  const [showRPCSettings, setShowRPCSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [goToLine, setGoToLine] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileExplorerRef = useRef<FileExplorerRef>(null);
  const hasAutoOpenedRef = useRef(false);
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Multi-file management hook
  const {
    fileTree,
    openFiles,
    activeFilePath,
    openFile,
    reloadFile,
    closeFile,
    closeAllFiles,
    setActiveFile,
    updateFileContent,
    saveFile,
    saveAllFiles,
    getActiveFile,
    hasUnsavedChanges,
    loadFileTree,
  } = useProjectFiles({
    userId: user?.id || "",
    projectId: id || "",
    initialCode: project?.code, // Pass database code for old project migration
  });

  // Get active file for editor
  const activeFile = getActiveFile();

  // Subscribe to project changes
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel("project_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setProject((prev) => (prev ? { ...prev, ...payload.new } : null));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;

      try {
        const { data: project, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        if (!project) throw new Error("Project not found");

        setProject(project);
        setEditedName(project.name);

        // Fetch last compilation regardless of status
        const { data: compilations, error: compilationError } = await supabase
          .from("compilation_history")
          .select("*")
          .eq("project_id", id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!compilationError && compilations && compilations.length > 0) {
          const lastCompilation = compilations[0];
          setLastCompilationResult({
            success: lastCompilation.status === "success",
            exit_code: lastCompilation.exit_code,
            stdout: lastCompilation.stdout || "",
            stderr: lastCompilation.stderr || "",
            details: lastCompilation.details || {
              compilation_time: Date.now() / 1000,
            },
            abi: lastCompilation.abi,
            code_snapshot: lastCompilation.code_snapshot,
          });
        }
      } catch (error) {
        console.error("Error fetching project:", error);
        toast({
          title: "Error",
          description: "Failed to load project",
          variant: "destructive",
        });
        navigate("/projects");
      }
    };

    fetchProject();
  }, [id, navigate, toast]);

  // Load file tree when project loads
  useEffect(() => {
    if (project && user) {
      loadFileTree();
    }
  }, [project, user, loadFileTree]);

  // Auto-open src/lib.rs or first .rs file when file tree loads (only on initial load)
  useEffect(() => {
    // Only auto-open once on initial load
    if (fileTree && openFiles.length === 0 && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;

      // Helper to find src/lib.rs or first .rs file in src
      const findDefaultFile = (node: FileNode): string | null => {
        if (!node.children) return null;

        // First pass: look for src/lib.rs specifically
        for (const child of node.children) {
          if (child.path === 'src/lib.rs' && !child.is_directory) {
            return child.path;
          }
          // Look in src folder
          if (child.name === 'src' && child.is_directory && child.children) {
            const libRs = child.children.find(f => f.name === 'lib.rs' && !f.is_directory);
            if (libRs) return libRs.path;
          }
        }

        // Second pass: look for any .rs file in src
        for (const child of node.children) {
          if (child.name === 'src' && child.is_directory && child.children) {
            const rsFile = child.children.find(f => f.name.endsWith('.rs') && !f.is_directory);
            if (rsFile) return rsFile.path;
          }
        }

        return null;
      };

      const defaultFile = findDefaultFile(fileTree);
      if (defaultFile) {
        openFile(defaultFile);
      }
    }
  }, [fileTree, openFiles.length, openFile]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleStartEditing = () => {
    if (project) {
      setEditedName(project.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = async () => {
    if (!project || !editedName.trim() || editedName === project.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name: editedName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id);

      if (error) throw error;

      setProject((prev) =>
        prev ? { ...prev, name: editedName.trim() } : null
      );
      toast({
        title: "Success",
        description: "Project name updated successfully",
      });
    } catch (error) {
      console.error("Error updating project name:", error);
      toast({
        title: "Error",
        description: "Failed to update project name",
        variant: "destructive",
      });
      setEditedName(project.name);
    } finally {
      setIsSavingName(false);
      setIsEditingName(false);
    }
  };

  const handleCancelEditing = () => {
    if (project) {
      setEditedName(project.name);
      setIsEditingName(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelEditing();
    }
  };

  const handleSave = useCallback(async () => {
    if (!activeFilePath) return;

    try {
      await saveFile(activeFilePath);
      toast({
        title: "Saved",
        description: "File saved successfully",
      });
    } catch (error) {
      console.error("Error saving file:", error);
      toast({
        title: "Error",
        description: "Failed to save file",
        variant: "destructive",
      });
    }
  }, [activeFilePath, saveFile, toast]);

  const handleCompile = async () => {
    if (!project || isCompiling || !user) return;

    // Save all open files before compiling
    try {
      if (hasUnsavedChanges()) {
        await saveAllFiles();
      }
    } catch (error) {
      console.error("Error saving files before compilation:", error);
      toast({
        title: "Error",
        description: "Failed to save files before compilation",
        variant: "destructive",
      });
      return;
    }

    setIsCompiling(true);
    // Add compilation start message to terminal
    const startTime = new Date().toLocaleTimeString();
    setTerminalOutput(prev => prev + `\n$ cargo near build non-reproducible-wasm\n[${startTime}] Starting compilation...\n`);

    try {
      // Get the main lib.rs content for compilation
      const mainFile = openFiles.find(f => f.path === "src/lib.rs");
      const codeToCompile = mainFile?.content || project.code;

      const result = await compileContract(codeToCompile, user.id, project.id);
      setLastCompilationResult(result);

      // Append compilation output to terminal
      const endTime = new Date().toLocaleTimeString();
      const output = result.success
        ? `[${endTime}] Compilation successful!\n${result.stdout || ''}\n`
        : `[${endTime}] Compilation failed.\n${result.stderr || result.stdout || ''}\n`;
      setTerminalOutput(prev => prev + output);

      // Save compilation result to history
      const { error: historyError } = await supabase
        .from("compilation_history")
        .insert({
          project_id: project.id,
          user_id: user.id,
          code_snapshot: codeToCompile,
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            details: result.details,
          },
          status: result.success ? "success" : "error",
          exit_code: result.exit_code,
          stdout: result.stdout,
          stderr: result.stderr,
          abi: result.abi,
          error_type: "compilation",
          metadata: {
            compilation_time: result.details.compilation_time,
            project_path: result.details.project_path,
          },
        });

      if (historyError) throw historyError;

      // Update project activity
      await supabase
        .from("projects")
        .update({
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id);

      toast({
        title: result.success ? "Compilation Successful" : "Compilation Failed",
        description: result.success
          ? "Your code compiled successfully"
          : "Failed to compile your code",
        variant: result.success ? "default" : "destructive",
      });

      // Refresh ABI view after successful compilation
      if (result.success && result.abi) {
        setRefreshABITrigger((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Compilation error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to compile project",
        variant: "destructive",
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const toggleView = (viewId: ViewId) => {
    setActiveViews((prev) => {
      const isActive = prev.includes(viewId);
      if (isActive) {
        // Don't allow removing the last view
        const newViews = prev.filter((v) => v !== viewId);
        return newViews.length > 0 ? newViews : [viewId];
      } else {
        return [...prev, viewId];
      }
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(date);
  };

  const handleDeploySuccess = () => {
    setShowDeployDialog(false);
    setShowABIError(false);
    // Trigger ABI view refresh
    setRefreshABITrigger((prev) => prev + 1);
  };

  const handleRequestDeploy = () => {
    // Check if we have a valid ABI from the last compilation
    let hasValidABI = false;

    if (lastCompilationResult?.success && lastCompilationResult?.abi) {
      // Check for array format (our backend returns this)
      if (Array.isArray(lastCompilationResult.abi)) {
        hasValidABI = lastCompilationResult.abi.length > 0;
      }
      // Check for NEAR's official ABI format
      else if (
        typeof lastCompilationResult.abi === "object" &&
        lastCompilationResult.abi.body?.functions &&
        Array.isArray(lastCompilationResult.abi.body.functions)
      ) {
        hasValidABI = lastCompilationResult.abi.body.functions.length > 0;
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


  const handleReportIssue = () => {
    window.open(
      "https://github.com/tolgayayci/nearplay/issues/new?labels=bug&template=bug_report.md",
      "_blank"
    );
  };

  const handleExportProject = async () => {
    if (!user || !project) return;

    setIsExporting(true);
    try {
      await exportProject(user.id, project.id, project.name);
      toast({
        title: "Export Successful",
        description: "Project exported! Run 'cargo near build' locally to compile.",
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export project",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = useCallback(async (path: string, lineNumber?: number) => {
    await openFile(path);
    // Set line number for editor to jump to (will be cleared after use)
    if (lineNumber) {
      setGoToLine(lineNumber);
    } else {
      setGoToLine(null);
    }
  }, [openFile]);

  const handleEditorChange = useCallback((value: string) => {
    if (activeFilePath) {
      updateFileContent(activeFilePath, value);
    }
  }, [activeFilePath, updateFileContent]);

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Loading project...</span>
        </div>
      </div>
    );
  }

  const hasFiles = activeViews.includes("files");
  const hasEditor = activeViews.includes("editor");
  const hasABI = activeViews.includes("abi");
  const hasTerminal = activeViews.includes("terminal");

  const getMainPanelWidth = () => {
    const activeMainViews = [hasEditor, hasABI].filter(Boolean).length;
    if (activeMainViews === 0) return "100%";
    return `${100 / activeMainViews}%`;
  };

  return (
    <TooltipProvider>
    <div className="h-screen flex flex-col bg-background">
      <SEO
        title={project?.name || "Editor"}
        description={
          project?.description || "Smart contract development environment"
        }
        type="app"
      />

      <header className="h-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="h-full flex flex-col justify-center px-4">
          <div className="flex items-center">
            {/* Left side - Project info */}
            <div className="flex-1 flex items-center gap-4">
              <Link
                to="/projects"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Wand2 className="h-5 w-5 text-primary" />
                </div>
              </Link>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        ref={nameInputRef}
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-8 text-xl font-semibold bg-background max-w-[300px]"
                        disabled={isSavingName}
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleSaveName}
                          disabled={isSavingName}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleCancelEditing}
                          disabled={isSavingName}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1
                        className="text-xl font-semibold max-w-[300px] truncate"
                        title={project.name}
                      >
                        {project.name}
                      </h1>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleStartEditing}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Badge
                        variant="outline"
                        className="px-1 h-4 text-[10px] bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        BETA
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5"
                        onClick={handleReportIssue}
                      >
                        <Bug className="h-3.5 w-3.5" />
                        <span className="text-xs">Report Issue</span>
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Created {formatDate(project.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Updated {formatDate(project.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Center - View controls */}
            <div className="flex items-center">
              <div className="flex items-center gap-px bg-muted rounded-md border overflow-hidden">
                {VIEWS.map((view) => (
                  <Button
                    key={view.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-3 gap-2 rounded-none transition-all relative",
                      activeViews.includes(view.id)
                        ? [
                            "bg-background text-foreground font-medium",
                            "before:absolute before:inset-x-0 before:bottom-0 before:h-0.5 before:bg-primary",
                          ]
                        : [
                            "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                            "hover:before:absolute hover:before:inset-x-0 hover:before:bottom-0 hover:before:h-0.5 hover:before:bg-muted-foreground/30",
                          ]
                    )}
                    onClick={() => toggleView(view.id)}
                  >
                    <view.icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        activeViews.includes(view.id)
                          ? "text-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="text-xs">{view.title}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex-1 flex items-center justify-end gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 px-3"
                      onClick={handleExportProject}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="h-[1.2rem] w-[1.2rem] animate-spin" />
                      ) : (
                        <Download className="h-[1.2rem] w-[1.2rem]" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export as ZIP</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <RPCDropdown onOpenSettings={() => setShowRPCSettings(true)} />
              <WalletButton />
              <ThemeToggle />
              <UserNav />
            </div>
          </div>
        </div>
      </header>

      {project && (
        <>
          {lastCompilationResult && (
            <DeployDialog
              open={showDeployDialog}
              onOpenChange={setShowDeployDialog}
              projectId={project.id}
              lastCompilation={lastCompilationResult}
              onDeploySuccess={handleDeploySuccess}
              showABIError={showABIError}
            />
          )}

          {user && (
            <PackageManagerModal
              open={showPackageModal}
              onOpenChange={setShowPackageModal}
              userId={user.id}
              projectId={project.id}
              onDependenciesChanged={() => {
                fileExplorerRef.current?.refresh();
                // Reload Cargo.toml if it's open in the editor
                reloadFile('Cargo.toml');
              }}
            />
          )}

          <RPCSettingsPanel
            open={showRPCSettings}
            onOpenChange={setShowRPCSettings}
          />
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <ResizablePanelGroup direction="vertical">
          {/* Main content area */}
          <ResizablePanel defaultSize={hasTerminal ? 75 : 100} minSize={30}>
            <div className="h-full flex">
              {/* File Explorer - fixed width, toggleable */}
              {hasFiles && user && id && (
                <div className="w-[280px] h-full p-2 shrink-0">
                  <FileExplorer
                    ref={fileExplorerRef}
                    userId={user.id}
                    projectId={id}
                    projectName={project.name}
                    onFileSelect={handleFileSelect}
                    selectedFile={activeFilePath}
                    onOpenPackageManager={() => setShowPackageModal(true)}
                    className="h-full"
                  />
                </div>
              )}

              {/* Editor and ABI panels */}
              <div className="flex-1 min-w-0">
                <div className="h-full flex">
                  {hasEditor && (
                    <div
                      style={{ width: getMainPanelWidth() }}
                      className="h-full overflow-hidden p-2"
                    >
                      {activeFile ? (
                        <Editor
                          value={activeFile.content}
                          onChange={handleEditorChange}
                          onCompile={handleCompile}
                          isCompiling={isCompiling}
                          projectId={project.id}
                          lastCompilation={lastCompilationResult}
                          onDeploySuccess={handleDeploySuccess}
                          onSave={handleSave}
                          onRequestDeploy={handleRequestDeploy}
                          onOpenTests={() => setShowTestsModal(true)}
                          language={activeFile.language}
                          filePath={activeFile.path}
                          openFiles={openFiles}
                          activeFilePath={activeFilePath}
                          onSelectFile={setActiveFile}
                          onCloseFile={closeFile}
                          onCloseAllFiles={closeAllFiles}
                          goToLine={goToLine}
                        />
                      ) : (
                        <div className="h-full flex flex-col bg-background border rounded-md overflow-hidden">
                          {/* Header - matches Editor with file selected */}
                          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-md">
                                <FileCode2 className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-medium">Editor</h3>
                                <p className="text-xs text-muted-foreground">
                                  Write and manage your project files
                                </p>
                              </div>
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={handleCompile}
                                disabled={isCompiling}
                                variant="default"
                                size="sm"
                                className="gap-2 min-w-[90px]"
                              >
                                {isCompiling ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <PlayIcon className="h-4 w-4" />
                                )}
                                {isCompiling ? "Compiling..." : "Compile"}
                              </Button>
                              <Button
                                onClick={handleRequestDeploy}
                                variant="outline"
                                size="sm"
                                className={`gap-2 min-w-[90px] ${lastCompilationResult?.success ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}`}
                                disabled={!lastCompilationResult?.success}
                                title={!lastCompilationResult?.success ? "Compile your contract successfully before deploying" : undefined}
                              >
                                <RocketIcon className="h-4 w-4" />
                                Deploy
                              </Button>
                            </div>
                          </div>
                          {/* Empty state content */}
                          <div className="flex-1 flex items-center justify-center bg-muted/40">
                            <div className="text-center">
                              <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-6">
                                <FileCode2 className="h-6 w-6 text-primary" />
                              </div>
                              <h3 className="font-medium mb-3">No File Selected</h3>
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">
                                  Select a file from the explorer
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  to start editing your smart contract
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {hasABI && (
                    <div
                      style={{ width: getMainPanelWidth() }}
                      className="h-full overflow-hidden p-2"
                    >
                      <ABIView
                        projectId={project.id}
                        userId={user?.id}
                        refreshTrigger={refreshABITrigger}
                        onRequestDeploy={handleRequestDeploy}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>

          {/* Terminal panel - toggleable */}
          {hasTerminal && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={25} minSize={10} maxSize={50}>
                <div className="h-full flex flex-col overflow-hidden p-2">
                  {user && id && (
                    <Terminal
                      userId={user.id}
                      projectId={id}
                      compilationOutput={terminalOutput}
                    />
                  )}
                </div>
              </ResizablePanel>
            </>
          )}

        </ResizablePanelGroup>
      </div>

      {/* Tests Modal */}
      {user && id && (
        <TestsModal
          open={showTestsModal}
          onOpenChange={setShowTestsModal}
          userId={user.id}
          projectId={id}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
