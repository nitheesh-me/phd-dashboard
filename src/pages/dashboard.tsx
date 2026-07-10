import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { setNavSelect } from "@/lib/nav-intent";
import {
  CheckCircle2, Circle, Copy, Download, Info, Plus, Printer, Timer, X,
} from "lucide-react";
import { toast } from "sonner";

import { useCoreData, defaultSnapshot } from "@/lib/core-data";
import { api } from "@/lib/api/tauri-client";
import { daysUntil, formatDate, formatDaysLeft, formatHours, clampHoursTarget } from "@/lib/format";
import {
  loadFocusPlanner, persistFocusPlanner,
  loadWeeklyTargetHours, persistWeeklyTargetHours,
  loadWeeklyBoard, persistWeeklyBoard,
  loadPaperMilestonePlans, persistPaperMilestonePlans,
  createPaperMilestonePlan, loadSavedReports, persistSavedReports,
} from "@/lib/persistence";
import { buildAdvisorWeeklyReport, downloadText, markdownToHtml, openPrintWindow } from "@/lib/report";
import { usePrefsStore } from "@/store/prefs-store";
import type {
  FocusItem, WeeklyBoardItem, WeeklyBoardLane,
  PaperMilestonePlan, ReadinessItem, SavedReport,
} from "@/lib/types/local";
import { WEEKLY_BOARD_LANES } from "@/lib/types/local";
import { QueryState, SectionEmpty } from "@/components/shared/query-state";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ── Metric card ──────────────────────────────────────────────────
function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="card-interactive">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="metric-value">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{detail}</p>
      </CardContent>
    </Card>
  );
}

// ── Status badge helpers ─────────────────────────────────────────
function gitBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Clean") return "secondary";
  if (status === "Dirty") return "destructive";
  return "outline";
}

function readBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Read") return "default";
  if (status === "Reading") return "secondary";
  return "outline";
}

function submissionBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Accepted") return "default";
  if (status === "Rejected") return "destructive";
  return "secondary";
}

// ── Dashboard page ───────────────────────────────────────────────
export function DashboardPage() {
  const { snapshotQuery, projectsQuery, referencesQuery, submissionsQuery, venuesQuery, invalidateCore } = useCoreData();
  const { prefs } = usePrefsStore();
  const navigate = useNavigate();
  const snapshot = snapshotQuery.data ?? defaultSnapshot();
  const projects = projectsQuery.data ?? [];
  const references = referencesQuery.data ?? [];
  const submissions = submissionsQuery.data ?? [];
  const venues = venuesQuery.data ?? [];

  const [focusInput, setFocusInput] = useState("");
  const [focusItems, setFocusItems] = useState<FocusItem[]>(() => loadFocusPlanner());
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [focusModalInput, setFocusModalInput] = useState("");
  const [weeklyTargetHours, setWeeklyTargetHours] = useState<number>(() => loadWeeklyTargetHours());
  const [weeklyTaskInput, setWeeklyTaskInput] = useState("");
  const [weeklyTaskLane, setWeeklyTaskLane] = useState<WeeklyBoardLane>("backlog");
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [weeklyModalInput, setWeeklyModalInput] = useState("");
  const [weeklyModalLane, setWeeklyModalLane] = useState<WeeklyBoardLane>("backlog");
  const [weeklyBoardItems, setWeeklyBoardItems] = useState<WeeklyBoardItem[]>(() => loadWeeklyBoard());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // ── Log deep work dialog ─────────────────────────────────────
  const [logWorkOpen, setLogWorkOpen] = useState(false);
  const [logWorkTitle, setLogWorkTitle] = useState("");
  const [logWorkMinutes, setLogWorkMinutes] = useState("60");
  const [logWorkType, setLogWorkType] = useState("Coding");
  const logWorkMutation = useMutation({
    mutationFn: () =>
      api.logDeepWork(
        logWorkTitle.trim() || logWorkType + " session",
        Math.max(1, parseInt(logWorkMinutes, 10) || 60),
        logWorkType,
      ),
    onSuccess: async () => {
      await invalidateCore();
      setLogWorkOpen(false);
      setLogWorkTitle("");
      setLogWorkMinutes("60");
      setLogWorkType("Coding");
      toast.success("Deep work session logged");
    },
    onError: () => toast.error("Failed to log session"),
  });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [paperPlans, setPaperPlans] = useState<PaperMilestonePlan[]>(() => loadPaperMilestonePlans());
  const [selectedPlanPaperId, setSelectedPlanPaperId] = useState<string>("");
  const researcherName = prefs.name;

  useEffect(() => { persistFocusPlanner(focusItems); }, [focusItems]);
  useEffect(() => { persistWeeklyTargetHours(weeklyTargetHours); }, [weeklyTargetHours]);
  useEffect(() => { persistWeeklyBoard(weeklyBoardItems); }, [weeklyBoardItems]);
  useEffect(() => { persistPaperMilestonePlans(paperPlans); }, [paperPlans]);
  useEffect(() => {
    if (!selectedPlanPaperId && references.length > 0) setSelectedPlanPaperId(references[0].id);
  }, [selectedPlanPaperId, references]);

  // ── Derived values ─────────────────────────────────────────────
  const upcoming = venues
    .filter((v) => v.submission_deadline)
    .sort((a, b) => new Date(a.submission_deadline!).getTime() - new Date(b.submission_deadline!).getTime())
    .slice(0, 5);

  const dirtyProjects = projects.filter((p) => p.git_status !== "Clean").slice(0, 5);
  const unreadReferences = references.filter((r) => r.read_status !== "Read").slice(0, 5);
  const weeklyHours = snapshot.deep_work_minutes / 60;
  const weeklyProgress = weeklyTargetHours > 0 ? Math.min(100, Math.round((weeklyHours / weeklyTargetHours) * 100)) : 0;
  const pendingFocusCount = focusItems.filter((i) => !i.done).length;
  const completedFocusCount = focusItems.length - pendingFocusCount;

  const venueById = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues]);
  const paperById = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);

  const submissionWatchlist = useMemo(() => submissions
    .filter((s) => s.status === "Drafting" || s.status === "Submitted" || s.status === "Rebuttal")
    .map((s) => {
      const venue = venueById.get(s.venue_id);
      const paper = paperById.get(s.paper_id);
      return {
        id: s.id,
        venue: venue?.acronym ?? "Unknown venue",
        paper: paper?.title ?? "Unknown paper",
        status: s.status,
        daysLeft: daysUntil(venue?.submission_deadline ?? null),
      };
    })
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity))
    .slice(0, 5), [submissions, venueById, paperById]);

  const readinessChecklist: ReadinessItem[] = [
    { label: "≥ 2 active projects", done: projects.length >= 2, detail: `${projects.length} projects`, route: "/projects", actionLabel: "Open Projects" },
    { label: "Reading pipeline seeded", done: references.length >= 10, detail: `${references.length} references`, route: "/references", actionLabel: "Add References" },
    { label: "Venue targets defined", done: venues.length >= 3, detail: `${venues.length} venues`, route: "/venues", actionLabel: "Plan Venues" },
    { label: "Submission tracker initialized", done: submissions.length >= 1, detail: `${submissions.length} submissions`, route: "/submissions", actionLabel: "Open Submissions" },
  ];

  const referenceById = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);
  const selectedPaper = selectedPlanPaperId ? referenceById.get(selectedPlanPaperId) ?? null : null;
  const selectedPlan = selectedPlanPaperId ? paperPlans.find((p) => p.referenceId === selectedPlanPaperId) ?? null : null;

  const reportPreview = buildAdvisorWeeklyReport({
    generatedAt: new Date().toISOString(),
    researcherName, snapshot, weeklyTargetHours,
    projects, references, submissions, venues,
    focusItems, weeklyBoardItems, paperPlans, submissionWatchlist,
  });

  // ── Handlers ──────────────────────────────────────────────────
  const addFocusItem = (text?: string) => {
    const value = (text ?? focusInput).trim();
    if (!value) return;
    setFocusItems((old) => [{ id: crypto.randomUUID(), text: value, done: false, createdAt: new Date().toISOString() }, ...old]);
    setFocusInput("");
  };

  const submitFocusModal = () => {
    const value = focusModalInput.trim();
    if (!value) return;
    addFocusItem(value);
    setFocusModalInput("");
    setShowFocusModal(false);
  };

  const addWeeklyTask = (text?: string, lane?: WeeklyBoardLane) => {
    const value = (text ?? weeklyTaskInput).trim();
    if (!value) return;
    setWeeklyBoardItems((old) => [{ id: crypto.randomUUID(), text: value, lane: lane ?? weeklyTaskLane, createdAt: new Date().toISOString() }, ...old]);
    setWeeklyTaskInput("");
  };

  const submitWeeklyModal = () => {
    const value = weeklyModalInput.trim();
    if (!value) return;
    addWeeklyTask(value, weeklyModalLane);
    setWeeklyModalInput("");
    setWeeklyModalLane("backlog");
    setShowWeeklyModal(false);
  };

  const moveWeeklyTask = (id: string, lane: WeeklyBoardLane) => {
    setWeeklyBoardItems((old) => old.map((item) => item.id === id ? { ...item, lane } : item));
  };

  const ensurePaperPlan = () => {
    if (!selectedPaper) return;
    setPaperPlans((old) => old.some((p) => p.referenceId === selectedPaper.id) ? old : [createPaperMilestonePlan(selectedPaper), ...old]);
  };

  const togglePaperMilestone = (referenceId: string, milestoneId: string) => {
    setPaperPlans((old) => old.map((plan) => plan.referenceId !== referenceId ? plan : {
      ...plan,
      updatedAt: new Date().toISOString(),
      milestones: plan.milestones.map((m) => m.id === milestoneId ? { ...m, done: !m.done } : m),
    }));
  };

  const copyAdvisorReport = async () => {
    try {
      await navigator.clipboard.writeText(reportPreview);
      toast.success("Report copied to clipboard");
    } catch {
      toast.error("Clipboard copy failed — use Download instead");
    }
  };

  const downloadAdvisorReport = async () => {
    await downloadText(`scholaros-weekly-report-${new Date().toISOString().slice(0, 10)}.md`, reportPreview);
  };

  const printAdvisorReport = () => {
    openPrintWindow(reportPreview, `ScholarOS Weekly Report — ${new Date().toLocaleDateString()}`).catch(console.error);
  };

  const saveAdvisorReport = () => {
    const reports = loadSavedReports();
    const newReport: SavedReport = {
      id: crypto.randomUUID(),
      title: `Weekly Report — ${new Date().toLocaleDateString()}`,
      content: reportPreview,
      createdAt: new Date().toISOString(),
    };
    persistSavedReports([newReport, ...reports]);
    toast.success("Report saved to Reports page");
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-up">
      {/* Hero */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">ScholarOS · Research Command Center</p>
          <h1 className="text-2xl font-bold tracking-tight">{researcherName}, good to have you back.</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingFocusCount} focus item{pendingFocusCount !== 1 ? "s" : ""} pending · run your research week end-to-end from here.
          </p>
        </div>

        {/* Weekly target */}
        <Card className="max-w-md">
          <CardContent className="pt-4 pb-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                Weekly deep-work target
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-flex items-center" />}>
                      <Info size={12} className="text-muted-foreground cursor-default" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      <p className="font-medium mb-1">How hours are tracked</p>
                      <p>Hours are logged by completing Pomodoro tasks (Coding / Writing / Reading). Each completed task adds its duration to this week's total. Log sessions via the "Deep Work" metric or from within any Project.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <span className="text-muted-foreground">{weeklyHours.toFixed(1)}h / {weeklyTargetHours}h</span>
            </div>
            <Progress value={weeklyProgress} className="h-2" />
            <div className="flex items-center gap-2 mt-1">
              <Label htmlFor="weekly-target" className="text-xs text-muted-foreground whitespace-nowrap">Target hours</Label>
              <div className="flex items-center gap-1">
                <Button
                  size="sm" variant="outline"
                  className="h-7 w-7 p-0 text-base leading-none"
                  onClick={() => setWeeklyTargetHours((v) => clampHoursTarget(String(v - 1)))}
                  aria-label="Decrease"
                >−</Button>
                <Input
                  id="weekly-target"
                  inputMode="numeric"
                  className="h-7 w-14 text-xs text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  value={weeklyTargetHours}
                  onChange={(e) => setWeeklyTargetHours(clampHoursTarget(e.target.value))}
                />
                <Button
                  size="sm" variant="outline"
                  className="h-7 w-7 p-0 text-base leading-none"
                  onClick={() => setWeeklyTargetHours((v) => clampHoursTarget(String(v + 1)))}
                  aria-label="Increase"
                >+</Button>
              </div>
            </div>
            <Button
              size="sm" variant="outline" className="h-7 text-xs mt-1 self-start"
              onClick={() => setLogWorkOpen(true)}
            >
              <Timer size={12} className="mr-1" /> Log session
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Urgent Deadlines" value={String(snapshot.urgent_deadlines)} detail="Submission deadlines ≤ 14 days" />
        <MetricCard label="Active Projects" value={String(snapshot.active_projects)} detail="Touched in last 48 hours" />
        <MetricCard label="Unread Papers" value={String(snapshot.unread_papers)} detail="Added this week, still unread" />
        <MetricCard label="Deep Work" value={formatHours(snapshot.deep_work_minutes)} detail="Tracked reading/writing/coding" />
      </div>

      <Separator />

      {/* Three overview columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Next deadlines */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Next Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryState isLoading={venuesQuery.isLoading} error={venuesQuery.error} empty={upcoming.length === 0} emptyText="No upcoming venue deadlines.">
              <div className="space-y-2">
                {upcoming.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => { setNavSelect("venues", v.id); void navigate({ to: "/venues" }); }}
                    className="flex items-start justify-between gap-2 rounded-md px-2 py-1 -mx-2 hover:bg-accent/60 transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium leading-tight">{v.acronym}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(v.submission_deadline)}</p>
                    </div>
                    <Badge variant={v.type === "Conference" ? "secondary" : "outline"} className="text-xs shrink-0">{v.type}</Badge>
                  </div>
                ))}
              </div>
            </QueryState>
          </CardContent>
        </Card>

        {/* Projects needing attention */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Projects Needing Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryState isLoading={projectsQuery.isLoading} error={projectsQuery.error} empty={dirtyProjects.length === 0} emptyText="All projects look clean.">
              <div className="space-y-2">
                {dirtyProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => { setNavSelect("projects", p.id); void navigate({ to: "/projects" }); }}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1 -mx-2 hover:bg-accent/60 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <Badge variant={gitBadgeVariant(p.git_status)} className="text-xs shrink-0">{p.git_status}</Badge>
                  </div>
                ))}
              </div>
            </QueryState>
          </CardContent>
        </Card>

        {/* Reading queue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Reading Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryState isLoading={referencesQuery.isLoading} error={referencesQuery.error} empty={unreadReferences.length === 0} emptyText="No pending reading.">
              <div className="space-y-1">
                {unreadReferences.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => { setNavSelect("references", r.id); void navigate({ to: "/references" }); }}
                    className="group block rounded-md px-2 py-1.5 -mx-2 hover:bg-accent/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight line-clamp-2 group-hover:line-clamp-none">{r.title}</p>
                      <Badge variant={readBadgeVariant(r.read_status)} className="text-xs shrink-0">{r.read_status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {r.authors.slice(0, 2).join(", ")}{r.authors.length > 2 ? " et al." : ""}
                    </p>
                  </div>
                ))}
              </div>
            </QueryState>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Planner row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Focus planner */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Today Focus Planner</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{pendingFocusCount} open</Badge>
                <Button size="sm" variant="outline" onClick={() => { setFocusModalInput(""); setShowFocusModal(true); }} className="h-6 w-6 p-0">
                  <Plus size={13} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 flex-1">
            <div className="flex gap-2">
              <Input
                placeholder="Quick add (Enter)…"
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFocusItem(); } }}
                className="h-8 text-sm"
              />
            </div>
            {focusItems.length === 0
              ? <SectionEmpty text="Add the top 1-3 things that move your thesis forward today." />
              : (
                <div className="space-y-1 mt-1">
                  {focusItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setFocusItems((old) => old.map((f) => f.id === item.id ? { ...f, done: !f.done } : f))}
                      className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm cursor-pointer hover:bg-accent/50 transition-colors select-none"
                    >
                      <div className="text-primary shrink-0 pointer-events-none">
                        {item.done ? <CheckCircle2 size={15} /> : <Circle size={15} className="text-muted-foreground" />}
                      </div>
                      <span className={item.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>{item.text}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFocusItems((old) => old.filter((f) => f.id !== item.id)); }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remove"
                      ><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )
            }
          </CardContent>
        </Card>

        {/* Readiness checklist */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Research Readiness</CardTitle>
              <Badge variant="outline" className="text-xs">
                {readinessChecklist.filter((i) => i.done).length}/{readinessChecklist.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {readinessChecklist.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    {item.done
                      ? <CheckCircle2 size={13} className="text-primary shrink-0 mt-0.5" />
                      : <Circle size={13} className="text-muted-foreground shrink-0 mt-0.5" />}
                    <p className="text-sm font-medium leading-tight">{item.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground ml-5">{item.detail}</p>
                </div>
                {!item.done && (
                  <Link
                    to={item.route}
                    className="inline-flex h-6 items-center rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-muted transition-colors"
                  >{item.actionLabel}</Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submission watchlist */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Submission Watchlist</CardTitle>
              <Badge variant="outline" className="text-xs">{submissionWatchlist.length} active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <QueryState
              isLoading={submissionsQuery.isLoading || venuesQuery.isLoading || referencesQuery.isLoading}
              error={submissionsQuery.error ?? venuesQuery.error ?? referencesQuery.error}
              empty={submissionWatchlist.length === 0}
              emptyText="No active submission risk right now."
            >
              <div className="space-y-2">
                {submissionWatchlist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => { setNavSelect("submissions", item.id); void navigate({ to: "/submissions" }); }}
                    className="flex items-start justify-between gap-2 rounded-md px-2 py-1 -mx-2 hover:bg-accent/60 transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium leading-tight">{item.venue}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.paper}</p>
                      <p className="text-xs text-muted-foreground">{formatDaysLeft(item.daysLeft)}</p>
                    </div>
                    <Badge variant={submissionBadgeVariant(item.status)} className="text-xs shrink-0">{item.status}</Badge>
                  </div>
                ))}
              </div>
            </QueryState>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Operations row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Weekly planning board */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Weekly Planning Board</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{weeklyBoardItems.length} tasks</Badge>
                <Button size="sm" variant="outline" onClick={() => { setWeeklyModalInput(""); setWeeklyModalLane("backlog"); setShowWeeklyModal(true); }} className="h-6 w-6 p-0">
                  <Plus size={13} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Quick add (Enter)…"
                value={weeklyTaskInput}
                onChange={(e) => setWeeklyTaskInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addWeeklyTask(); } }}
                className="h-8 text-sm"
              />
              <Select value={weeklyTaskLane} onValueChange={(v) => setWeeklyTaskLane(v as WeeklyBoardLane)}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKLY_BOARD_LANES.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {WEEKLY_BOARD_LANES.map((lane) => {
                const laneItems = weeklyBoardItems.filter((t) => t.lane === lane.id);
                return (
                  <div
                    key={lane.id}
                    className="flex flex-col gap-1 min-h-[80px] rounded-md border border-dashed p-2 transition-colors overflow-hidden"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = draggedTaskId ?? e.dataTransfer.getData("text/plain");
                      if (id) { moveWeeklyTask(id, lane.id); setDraggedTaskId(null); }
                    }}
                  >
                    <p className="text-xs font-semibold text-muted-foreground mb-1 truncate">{lane.label} <span className="font-normal">({laneItems.length})</span></p>
                    {laneItems.map((task) => (
                      editingTaskId === task.id
                        ? (
                          <input
                            key={task.id}
                            autoFocus
                            className="w-full rounded border bg-card px-2 py-1 text-xs outline-none ring-1 ring-primary"
                            value={editingTaskText}
                            onChange={(e) => setEditingTaskText(e.target.value)}
                            onBlur={() => {
                              if (editingTaskText.trim()) {
                                setWeeklyBoardItems((old) => old.map((t) => t.id === task.id ? { ...t, text: editingTaskText.trim() } : t));
                              }
                              setEditingTaskId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.currentTarget.blur(); }
                              if (e.key === "Escape") { setEditingTaskId(null); }
                            }}
                          />
                        )
                        : (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", task.id); setDraggedTaskId(task.id); }}
                            onDragEnd={() => setDraggedTaskId(null)}
                            onDoubleClick={() => { setEditingTaskId(task.id); setEditingTaskText(task.text); }}
                            className="rounded border bg-card px-2 py-1 text-xs cursor-grab active:cursor-grabbing group select-none overflow-hidden"
                            title="Double-click to edit"
                          >
                            <p className="leading-snug truncate">{task.text}</p>
                            <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {lane.id !== "done" && (
                                <button type="button" onClick={() => moveWeeklyTask(task.id, "done")} className="text-primary text-[10px] flex items-center gap-0.5"><CheckCircle2 size={10} /> done</button>
                              )}
                              <button type="button" onClick={() => setWeeklyBoardItems((old) => old.filter((t) => t.id !== task.id))} className="text-destructive ml-auto" aria-label="Remove"><X size={11} /></button>
                            </div>
                          </div>
                        )
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Paper milestones */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Paper Milestones</CardTitle>
              <Badge variant="outline" className="text-xs">{paperPlans.length} planned</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {references.length === 0
              ? <SectionEmpty text="Add references first to create milestone plans." />
              : (
                <>
                  <div className="flex gap-2">
                    <Select value={selectedPlanPaperId} onValueChange={(v) => { if (v != null) setSelectedPlanPaperId(v); }}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <span className="truncate">
                          {references.find((r) => r.id === selectedPlanPaperId)?.title ?? "Select paper…"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {references.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-xs">{r.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 text-xs" onClick={ensurePaperPlan}>Plan</Button>
                    {selectedPlan && (
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                        if (!selectedPaper) return;
                        setPaperPlans((old) => {
                          const next = old.filter((p) => p.referenceId !== selectedPaper.id);
                          return [createPaperMilestonePlan(selectedPaper), ...next];
                        });
                      }}>Reset</Button>
                    )}
                  </div>
                  {selectedPlan
                    ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground line-clamp-1">{selectedPaper?.title}</p>
                        {selectedPlan.milestones.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => togglePaperMilestone(selectedPlan.referenceId, m.id)}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded-md px-1 py-0.5 -mx-1 transition-colors select-none"
                          >
                            <div className="text-primary shrink-0 pointer-events-none">
                              {m.done ? <CheckCircle2 size={14} /> : <Circle size={14} className="text-muted-foreground" />}
                            </div>
                            <span className={m.done ? "line-through text-muted-foreground" : ""}>{m.label}</span>
                          </div>
                        ))}
                      </div>
                    )
                    : <SectionEmpty text="Select a paper and click Plan to create milestones." />}
                </>
              )
            }
          </CardContent>
        </Card>

        {/* Advisor report */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Advisor Weekly Report</CardTitle>
              <Badge variant="outline" className="text-xs">{completedFocusCount} focus done</Badge>
            </div>
            <CardDescription className="text-xs">Auto-generated from all tracked data</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 flex-1">
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => void copyAdvisorReport()}>
                <Copy size={13} /> Copy
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={downloadAdvisorReport}>
                <Download size={13} /> .md
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={printAdvisorReport}>
                <Printer size={13} /> PDF
              </Button>
              <Button size="sm" variant="secondary" className="h-8 text-xs gap-1.5 ml-auto" onClick={saveAdvisorReport}>
                Save to Reports
              </Button>
            </div>
            <Tabs defaultValue="raw" className="flex-1 flex flex-col">
              <TabsList className="h-7 w-fit">
                <TabsTrigger value="raw" className="text-xs h-6 px-3">Raw</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs h-6 px-3">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="raw" className="flex-1 mt-2">
                <Textarea
                  className="w-full font-mono text-xs resize-none min-h-[220px] h-full"
                  value={reportPreview}
                  readOnly
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div
                  className="rounded-md border bg-muted/30 p-3 text-sm min-h-[220px] overflow-y-auto prose-sm"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(reportPreview) }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Add Focus Item Dialog */}
      <Dialog open={showFocusModal} onOpenChange={setShowFocusModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Focus Item</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label htmlFor="focus-modal-input" className="text-sm">What do you want to focus on today?</Label>
            <Input
              id="focus-modal-input"
              autoFocus
              placeholder="e.g. Write intro section of paper…"
              value={focusModalInput}
              onChange={(e) => setFocusModalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitFocusModal(); } }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFocusModal(false)}>Cancel</Button>
            <Button onClick={submitFocusModal} disabled={!focusModalInput.trim()}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Weekly Task Dialog */}
      <Dialog open={showWeeklyModal} onOpenChange={setShowWeeklyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Weekly Task</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label htmlFor="weekly-modal-input" className="text-sm">Task description</Label>
            <Input
              id="weekly-modal-input"
              autoFocus
              placeholder="e.g. Finish related work section…"
              value={weeklyModalInput}
              onChange={(e) => setWeeklyModalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitWeeklyModal(); } }}
            />
            <Label className="text-sm">Lane</Label>
            <Select value={weeklyModalLane} onValueChange={(v) => setWeeklyModalLane(v as WeeklyBoardLane)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKLY_BOARD_LANES.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWeeklyModal(false)}>Cancel</Button>
            <Button onClick={submitWeeklyModal} disabled={!weeklyModalInput.trim()}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Deep Work Dialog */}
      <Dialog open={logWorkOpen} onOpenChange={setLogWorkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Deep Work Session</DialogTitle>
            <DialogDescription>Record a completed deep-work session to update your weekly hours.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Session type</Label>
              <Select value={logWorkType} onValueChange={(v) => { if (v) setLogWorkType(v); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Coding">Coding</SelectItem>
                  <SelectItem value="Writing">Writing</SelectItem>
                  <SelectItem value="Reading">Reading</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Duration (minutes)</Label>
              <Input
                type="number"
                inputMode="numeric"
                className="h-9"
                min="1"
                value={logWorkMinutes}
                onChange={(e) => setLogWorkMinutes(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Title (optional)</Label>
              <Input
                className="h-9"
                placeholder={`${logWorkType} session`}
                value={logWorkTitle}
                onChange={(e) => setLogWorkTitle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogWorkOpen(false)}>Cancel</Button>
            <Button onClick={() => logWorkMutation.mutate()} disabled={logWorkMutation.isPending}>
              {logWorkMutation.isPending ? "Logging…" : "Log session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
