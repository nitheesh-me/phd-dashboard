import { useState } from "react";
import { FileText, Trash2, Plus, Copy, Download, Printer, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { useCoreData, defaultSnapshot } from "@/lib/core-data";
import {
  loadSavedReports, persistSavedReports,
  loadFocusPlanner, loadWeeklyBoard, loadPaperMilestonePlans,
  loadWeeklyTargetHours, loadReportTemplate,
} from "@/lib/persistence";
import { buildAdvisorWeeklyReport, downloadText, markdownToHtml, openPrintWindow } from "@/lib/report";
import { usePrefsStore } from "@/store/prefs-store";
import type { SavedReport } from "@/lib/types/local";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

export function ReportsPage() {
  const { prefs } = usePrefsStore();
  const { snapshotQuery, projectsQuery, referencesQuery, submissionsQuery, venuesQuery } = useCoreData();

  const [reports, setReports] = useState<SavedReport[]>(() => loadSavedReports());
  const [selectedId, setSelectedId] = useState<string | null>(() => loadSavedReports()[0]?.id ?? null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("");

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const generateReport = () => {
    const snapshot = snapshotQuery.data ?? defaultSnapshot();
    const projects = projectsQuery.data ?? [];
    const references = referencesQuery.data ?? [];
    const submissions = submissionsQuery.data ?? [];
    const venues = venuesQuery.data ?? [];
    const focusItems = loadFocusPlanner();
    const weeklyBoardItems = loadWeeklyBoard();
    const paperPlans = loadPaperMilestonePlans();
    const weeklyTargetHours = loadWeeklyTargetHours();

    const venueById = new Map(venues.map((v) => [v.id, v]));
    const paperById = new Map(references.map((r) => [r.id, r]));
    const submissionWatchlist = submissions
      .filter((s) => s.status === "Drafting" || s.status === "Submitted" || s.status === "Rebuttal")
      .map((s) => {
        const venue = venueById.get(s.venue_id);
        const paper = paperById.get(s.paper_id);
        const daysLeft = venue?.submission_deadline
          ? Math.ceil((new Date(venue.submission_deadline).getTime() - Date.now()) / 86400000)
          : null;
        return { id: s.id, venue: venue?.acronym ?? "Unknown", paper: paper?.title ?? "Unknown", status: s.status, daysLeft };
      });

    const content = buildAdvisorWeeklyReport({
      generatedAt: new Date().toISOString(),
      researcherName: prefs.name,
      snapshot, weeklyTargetHours,
      projects, references, submissions, venues,
      focusItems, weeklyBoardItems, paperPlans, submissionWatchlist,
    });

    const newReport: SavedReport = {
      id: crypto.randomUUID(),
      title: `Weekly Report — ${new Date().toLocaleDateString()}`,
      content,
      createdAt: new Date().toISOString(),
    };

    const updated = [newReport, ...reports];
    setReports(updated);
    persistSavedReports(updated);
    setSelectedId(newReport.id);
    toast.success("Report generated and saved");
  };

  const updateContent = (id: string, content: string) => {
    const updated = reports.map((r) => r.id === id ? { ...r, content } : r);
    setReports(updated);
    persistSavedReports(updated);
  };

  const deleteReport = (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    persistSavedReports(updated);
    if (selectedId === id) setSelectedId(updated[0]?.id ?? null);
  };

  const renameReport = (id: string) => {
    if (!titleInput.trim()) return;
    const updated = reports.map((r) => r.id === id ? { ...r, title: titleInput.trim() } : r);
    setReports(updated);
    persistSavedReports(updated);
    setEditingTitle(null);
  };

  const startRename = (r: SavedReport) => { setEditingTitle(r.id); setTitleInput(r.title); };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><FileText size={18} className="text-primary" /> Reports</h1>
          <p className="text-xs text-muted-foreground">Persistent advisor reports — edit templates in Settings</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={generateReport}><Plus size={14} /> Generate Report</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="flex flex-col w-72 border-r shrink-0">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {reports.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">No reports yet. Click "Generate Report" to create one.</p>
              ) : reports.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`list-stagger w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 border ${
                    r.id === selectedId ? "bg-primary/10 border-primary/30 shadow-sm" : "border-transparent hover:bg-accent/70"
                  }`}
                  style={{ animationDelay: `${idx * 35}ms` }}
                >
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(r.createdAt).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="px-3 py-2 border-t">
            <p className="text-[11px] text-muted-foreground">{reports.length} report{reports.length !== 1 ? "s" : ""} saved</p>
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div key={selected.id} className="flex flex-col h-full animate-slide-in-right">
              <div className="flex items-center justify-between gap-3 px-6 py-3 border-b">
                {editingTitle === selected.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      className="h-7 text-sm flex-1"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") renameReport(selected.id); if (e.key === "Escape") setEditingTitle(null); }}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => renameReport(selected.id)}><Check size={13} /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h2 className="text-sm font-semibold truncate">{selected.title}</h2>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => startRename(selected)}><Pencil size={12} /></Button>
                  </div>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => void navigator.clipboard.writeText(selected.content).then(() => toast.success("Copied"))}>
                    <Copy size={11} /> Copy
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => downloadText(`report-${selected.id.slice(0, 8)}.md`, selected.content).catch(console.error)}>
                    <Download size={11} /> .md
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openPrintWindow(selected.content, selected.title).catch(console.error)}>
                    <Printer size={11} /> PDF
                  </Button>
                  <ConfirmDeleteDialog
                    label="Delete"
                    description={`"${selected.title}" will be permanently deleted.`}
                    onConfirm={() => deleteReport(selected.id)}
                  />
                </div>
              </div>

              <Tabs defaultValue="preview" className="flex-1 flex flex-col px-6 py-4">
                <TabsList className="h-7 w-fit">
                  <TabsTrigger value="preview" className="text-xs h-6 px-3">Preview</TabsTrigger>
                  <TabsTrigger value="edit" className="text-xs h-6 px-3">Edit</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="flex-1 mt-3">
                  <div
                    className="rounded-md border bg-muted/20 p-4 min-h-[400px]"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(selected.content) }}
                  />
                </TabsContent>
                <TabsContent value="edit" className="flex-1 mt-3 flex flex-col">
                  <Textarea
                    className="flex-1 font-mono text-xs resize-none min-h-[400px]"
                    value={selected.content}
                    onChange={(e) => updateContent(selected.id, e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-2">Changes are saved automatically as you type.</p>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <FileText size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No report selected</p>
              <p className="text-xs text-muted-foreground max-w-[220px]">Generate a weekly report from your current dashboard data</p>
              <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs" onClick={generateReport}><Plus size={13} /> Generate Report</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
