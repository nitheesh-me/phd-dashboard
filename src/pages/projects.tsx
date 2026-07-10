import { FormEvent, useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { consumeNavSelect, setNavSelect } from "@/lib/nav-intent";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Folder, GitBranch, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";

import { api } from "@/lib/api/tauri-client";
import type { CreateProjectInput, GitStatus, EnvironmentType, Project } from "@/lib/api/types";
import { useCoreData, emptyProjectForm } from "@/lib/core-data";
import { queryKeys } from "@/lib/api/query-keys";
import { parseProjectQuickLine } from "@/lib/parsers";
import { QueryState } from "@/components/shared/query-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

function gitBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Clean") return "secondary";
  if (status === "Dirty") return "destructive";
  return "outline";
}

export function ProjectsPage() {
  const qc = useQueryClient();
  const { projectsQuery, referencesQuery } = useCoreData();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GitStatus | "All">("All");

  // Deep-link from dashboard: open the item that was navigated to
  useEffect(() => {
    const id = consumeNavSelect("projects");
    if (id) setSelectedId(id);
  }, []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [addMode, setAddMode] = useState<"form" | "quick" | "bulk" | "clone">("form");
  const [quickLine, setQuickLine] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [form, setForm] = useState<CreateProjectInput>(emptyProjectForm());
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneTarget, setCloneTarget] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  const projects = projectsQuery.data ?? [];
  const references = referencesQuery.data ?? [];
  const filtered = projects.filter((p) => {
    const kw = search.trim().toLowerCase();
    return (kw === "" || p.name.toLowerCase().includes(kw) || p.local_path.toLowerCase().includes(kw))
      && (statusFilter === "All" || p.git_status === statusFilter);
  });
  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const openCreate = () => {
    setEditingProject(null);
    setForm(emptyProjectForm());
    setAddMode("form");
    setCloneUrl(""); setCloneTarget(""); setCloneName("");
    setSheetOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setForm({ name: p.name, local_path: p.local_path, git_status: p.git_status, env_type: p.env_type, env_status: p.env_status, associated_paper_id: p.associated_paper_id });
    setSheetOpen(true);
  };

  const refreshGitStatus = async (project: Project) => {
    setIsRefreshingStatus(true);
    try {
      const status = await invoke<string>("check_git_status", { path: project.local_path });
      const mapped: GitStatus = (status === "Clean" || status === "Dirty" || status === "Unpushed") ? status : "Clean";
      await api.updateProject({ ...project, git_status: mapped });
      qc.setQueryData<Project[]>(queryKeys.projects, (old = []) =>
        old.map((p) => p.id === project.id ? { ...p, git_status: mapped } : p)
      );
      toast.success(`Git status: ${status === "None" ? "Not a git repo" : status}`);
    } catch (e) {
      toast.error(`Failed to check git status: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const cloneRepo = async () => {
    if (!cloneUrl.trim() || !cloneTarget.trim()) {
      toast.error("Repository URL and target directory are required");
      return;
    }
    setIsCloning(true);
    try {
      const clonedPath = await invoke<string>("clone_git_repo", { url: cloneUrl.trim(), targetDir: cloneTarget.trim() });
      // Create the project record
      const projectName = cloneName.trim() || cloneUrl.split("/").pop()?.replace(/\.git$/, "") || "cloned-repo";
      await createMutation.mutateAsync({
        name: projectName,
        local_path: clonedPath,
        git_status: "Clean" as GitStatus,
        env_type: "Conda" as EnvironmentType,
        env_status: "",
        associated_paper_id: null,
      });
      toast.success("Repository cloned successfully");
      setSheetOpen(false);
    } catch (e) {
      toast.error(`Clone failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsCloning(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: api.createProject,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.projects });
      const prev = qc.getQueryData<Project[]>(queryKeys.projects);
      const tempId = `__temp_${Date.now()}`;
      qc.setQueryData<Project[]>(queryKeys.projects, (old = []) => [...old, { ...input, id: tempId, last_opened: null }]);
      setSheetOpen(false);
      setSelectedId(tempId);
      return { prev, tempId };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.projects, ctx.prev);
      toast.error("Failed to add project");
    },
    onSuccess: (created, _v, ctx) => {
      qc.setQueryData<Project[]>(queryKeys.projects, (old = []) => old.map((p) => p.id === ctx?.tempId ? created : p));
      setSelectedId(created.id);
      toast.success("Project added");
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });

  const updateMutation = useMutation({
    mutationFn: api.updateProject,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.projects });
      const prev = qc.getQueryData<Project[]>(queryKeys.projects);
      qc.setQueryData<Project[]>(queryKeys.projects, (old = []) => old.map((p) => p.id === input.id ? { ...p, ...input } : p));
      setSheetOpen(false);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.projects, ctx.prev);
      toast.error("Failed to update project");
    },
    onSuccess: (updated) => {
      qc.setQueryData<Project[]>(queryKeys.projects, (old = []) => old.map((p) => p.id === updated.id ? updated : p));
      toast.success("Project updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteProject,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.projects });
      const prev = qc.getQueryData<Project[]>(queryKeys.projects);
      qc.setQueryData<Project[]>(queryKeys.projects, (old = []) => old.filter((p) => p.id !== id));
      setSelectedId(null);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.projects, ctx.prev);
      toast.error("Failed to delete project");
    },
    onSuccess: () => {
      toast.success("Project deleted");
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });

  const addQuick = async () => {
    const parsed = parseProjectQuickLine(quickLine);
    if (!parsed) { toast.error("Invalid format"); return; }
    await createMutation.mutateAsync(parsed);
    setQuickLine("");
  };

  const addBulk = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    for (const line of lines) {
      const parsed = parseProjectQuickLine(line);
      if (parsed) await createMutation.mutateAsync(parsed);
    }
    setBulkText("");
    toast.success(`Imported ${lines.length} projects`);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingProject) updateMutation.mutate({ ...form, id: editingProject.id });
    else createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Folder size={18} className="text-primary" /> Projects</h1>
          <p className="text-xs text-muted-foreground">Research repositories &amp; experiments</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={openCreate}>
          <Plus size={14} /> New Project
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col w-80 border-r shrink-0">
          <div className="flex gap-2 px-3 py-2.5 border-b">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 text-xs pl-8 bg-muted/40" placeholder="Filter…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { if (v != null) setStatusFilter(v as typeof statusFilter); }}>
              <SelectTrigger className="h-8 w-24 text-xs bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Clean">Clean</SelectItem>
                <SelectItem value="Dirty">Dirty</SelectItem>
                <SelectItem value="Unpushed">Unpushed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <QueryState isLoading={projectsQuery.isLoading} error={projectsQuery.error} empty={filtered.length === 0} emptyText="No projects yet.">
                {filtered.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`list-stagger w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 border ${
                      p.id === selectedId ? "bg-primary/10 border-primary/30 shadow-sm" : "border-transparent hover:bg-accent/70"
                    }`}
                    style={{ animationDelay: `${idx * 35}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      <Badge variant={gitBadgeVariant(p.git_status)} className="text-[10px] h-4 px-1.5 shrink-0">{p.git_status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{p.local_path}</p>
                  </button>
                ))}
              </QueryState>
            </div>
          </ScrollArea>
          <div className="px-3 py-2 border-t">
            <p className="text-[11px] text-muted-foreground">{filtered.length} project{filtered.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div key={selected.id} className="p-6 flex flex-col gap-5 animate-slide-in-right">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5 font-mono">{selected.local_path}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Button
                    size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                    onClick={() => void refreshGitStatus(selected)}
                    disabled={isRefreshingStatus}
                    title="Refresh git status"
                  >
                    {isRefreshingStatus ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {isRefreshingStatus ? "Checking…" : "Refresh"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openEdit(selected)}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <ConfirmDeleteDialog
                    label="Delete Project"
                    description={`"${selected.name}" will be permanently removed.`}
                    onConfirm={() => deleteMutation.mutate(selected.id)}
                    disabled={deleteMutation.isPending}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Git status</p>
                  <Badge variant={gitBadgeVariant(selected.git_status)} className="gap-1.5"><GitBranch size={11} /> {selected.git_status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Environment</p>
                  <Badge variant="outline">{selected.env_type}</Badge>
                </div>
                {selected.env_status && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Env status</p>
                    <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded-md">{selected.env_status}</p>
                  </div>
                )}
                {selected.associated_paper_id && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Associated paper</p>
                    <button
                      type="button"
                      onClick={() => { setNavSelect("references", selected.associated_paper_id!); void navigate({ to: "/references" }); }}
                      className="text-sm text-left hover:underline text-primary cursor-pointer"
                    >
                      {references.find((r) => r.id === selected.associated_paper_id)?.title ?? selected.associated_paper_id}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Folder size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Select a project</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">Choose a project to view details, or create a new one</p>
              <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs" onClick={openCreate}><Plus size={13} /> New Project</Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle>{editingProject ? "Edit Project" : "New Project"}</SheetTitle>
            <SheetDescription>{editingProject ? `Editing "${editingProject.name}"` : "Add a research code repository."}</SheetDescription>
          </SheetHeader>

          {!editingProject && (
            <div className="px-6 pt-4">
              <Tabs value={addMode} onValueChange={(v) => setAddMode(v as typeof addMode)}>
                <TabsList className="h-7 w-full">
                  <TabsTrigger value="form" className="flex-1 text-xs h-6">Form</TabsTrigger>
                  <TabsTrigger value="quick" className="flex-1 text-xs h-6">Quick</TabsTrigger>
                  <TabsTrigger value="bulk" className="flex-1 text-xs h-6">Bulk</TabsTrigger>
                  <TabsTrigger value="clone" className="flex-1 text-xs h-6">Clone</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          <ScrollArea className="flex-1 px-6 py-4">
            {(addMode === "form" || editingProject) && (
              <form id="project-form" onSubmit={onSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Name *</Label>
                  <Input required className="h-9" placeholder="my-research-project" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Local path *</Label>
                  <Input required className="h-9 font-mono text-sm" placeholder="/home/user/projects/…" value={form.local_path} onChange={(e) => setForm((f) => ({ ...f, local_path: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Git status</Label>
                    <Select value={form.git_status} onValueChange={(v) => { if (v != null) setForm((f) => ({ ...f, git_status: v as GitStatus })); }}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Clean">Clean</SelectItem>
                        <SelectItem value="Dirty">Dirty</SelectItem>
                        <SelectItem value="Unpushed">Unpushed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Env type</Label>
                    <Select value={form.env_type} onValueChange={(v) => { if (v != null) setForm((f) => ({ ...f, env_type: v as EnvironmentType })); }}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Conda">Conda</SelectItem>
                        <SelectItem value="Venv">Venv</SelectItem>
                        <SelectItem value="Docker">Docker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Env status</Label>
                  <Input className="h-9" placeholder="e.g. env_name or image:tag" value={form.env_status} onChange={(e) => setForm((f) => ({ ...f, env_status: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Associated paper</Label>
                  <Select value={form.associated_paper_id ?? "__none__"} onValueChange={(v) => { if (v != null) setForm((f) => ({ ...f, associated_paper_id: v === "__none__" ? null : v })); }}>
                    <SelectTrigger className="h-9">
                      <span className="truncate">
                        {form.associated_paper_id
                          ? (references.find((r) => r.id === form.associated_paper_id)?.title ?? form.associated_paper_id)
                          : "None"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {references.map((r) => <SelectItem key={r.id} value={r.id} className="text-xs">{r.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </form>
            )}
            {!editingProject && addMode === "quick" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">Format: <code className="bg-muted px-1 rounded">name | /path | Git | Env | env_name</code></p>
                <Input className="h-9 font-mono text-sm" placeholder="my-proj | /home/… | Clean | Conda | base" value={quickLine} onChange={(e) => setQuickLine(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addQuick(); }} />
                <Button className="gap-1.5" onClick={() => void addQuick()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
                </Button>
              </div>
            )}
            {!editingProject && addMode === "bulk" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">One project per line, same format as Quick.</p>
                <Textarea className="font-mono text-xs min-h-[160px]" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
                <Button className="gap-1.5" onClick={() => void addBulk()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Import
                </Button>
              </div>
            )}
            {!editingProject && addMode === "clone" && (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">Clone a remote repository. Git must be installed on your system.</p>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Repository URL *</Label>
                  <Input
                    className="h-9 font-mono text-sm"
                    placeholder="https://github.com/user/repo.git"
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Target directory *</Label>
                  <Input
                    className="h-9 font-mono text-sm"
                    placeholder="/home/user/projects/repo-name"
                    value={cloneTarget}
                    onChange={(e) => setCloneTarget(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">Full path where the repo will be cloned into.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Project name (optional)</Label>
                  <Input
                    className="h-9"
                    placeholder="Auto-detected from URL"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                  />
                </div>
                <Button className="gap-1.5" onClick={() => void cloneRepo()} disabled={isCloning || !cloneUrl.trim() || !cloneTarget.trim()}>
                  {isCloning ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
                  {isCloning ? "Cloning…" : "Clone Repository"}
                </Button>
              </div>
            )}
          </ScrollArea>

          {(addMode === "form" || editingProject) && (
            <SheetFooter className="border-t px-6 py-4 flex-row gap-2">
              <Button form="project-form" type="submit" className="flex-1 gap-1.5" disabled={isPending}>
                {isPending ? <Loader2 size={14} className="animate-spin" /> : editingProject ? null : <Plus size={14} />}
                {editingProject ? "Save changes" : "Add project"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
