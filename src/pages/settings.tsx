import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Settings2, Trash2, Loader2, Palette, Upload, User, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { api } from "@/lib/api/tauri-client";
import { loadReportTemplate, persistReportTemplate, clearAllLocalData, exportLocalData, importLocalData } from "@/lib/persistence";
import { buildAdvisorWeeklyReport } from "@/lib/report";
import { useCoreData } from "@/lib/core-data";
import { usePrefsStore } from "@/store/prefs-store";
import type { UiPreferences } from "@/lib/types/local";

const TONES: Array<{ value: UiPreferences["tone"]; label: string; swatch: string }> = [
  { value: "ocean", label: "Ocean", swatch: "oklch(0.47 0.09 196)" },
  { value: "forest", label: "Forest", swatch: "oklch(0.47 0.1 155)" },
  { value: "ink", label: "Ink", swatch: "oklch(0.35 0.04 250)" },
];

const DEFAULT_TEMPLATE = `# Weekly Research Report

Researcher: {{name}}
Generated: {{date}}

## Executive Summary
- Deep work this week: {{deep_work}}h / {{target}}h target
- Urgent deadlines (<=14 days): {{urgent_deadlines}}
- Active projects (48h): {{active_projects}}
- Unread papers (7d): {{unread_papers}}

## Focus Items Completed
{{focus_completed}}

## Focus Items Carrying Forward
{{focus_open}}

## Weekly Planning Board
{{board_summary}}

## Submission Risk Radar
{{submission_watchlist}}

## Paper Milestone Progress
{{milestones}}

## Next Week Priorities
- Finalize top 3 tasks from "Today" / "This Week" lanes
- Close at least one open milestone block
- Reduce active submission risk for nearest deadline`;

export function SettingsPage() {
  const { prefs, setPrefs } = usePrefsStore();
  const { invalidateCore } = useCoreData();
  const [reportTemplate, setReportTemplate] = useState(() => loadReportTemplate() ?? DEFAULT_TEMPLATE);
  const [templateSaved, setTemplateSaved] = useState(false);

  const clearMutation = useMutation({
    mutationFn: api.clearAllData,
    onSuccess: async () => {
      clearAllLocalData();
      await invalidateCore();
      toast.success("All data has been reset");
    },
    onError: () => toast.error("Failed to reset data"),
  });

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dbJson = await api.exportAllData();
      const dbData = JSON.parse(dbJson) as object;
      const bundle = {
        version: 1,
        exported_at: new Date().toISOString(),
        db: dbData,
        local: exportLocalData(),
      };
      const filename = `scholaros-backup-${new Date().toISOString().slice(0, 10)}.json`;
      await api.saveTextFile(filename, JSON.stringify(bundle, null, 2));
      toast.success("Backup saved");
    } catch (e) {
      toast.error(`Export failed: ${String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = (mode: "append" | "override") => {
    const input = importFileRef.current;
    if (!input) return;
    // stash the mode so the onChange handler can read it
    input.dataset.mode = mode;
    input.click();
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mode = (e.target.dataset.mode ?? "append") as "append" | "override";
    setIsImporting(true);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as { db?: object; local?: object };
      if (!bundle.db && !bundle.local) throw new Error("Unrecognised backup format");
      if (bundle.db) {
        await api.importData(JSON.stringify(bundle.db), mode);
      }
      if (bundle.local) {
        importLocalData(bundle.local);
      }
      await invalidateCore();
      toast.success(`Import complete (${mode})`);
    } catch (err) {
      toast.error(`Import failed: ${String(err)}`);
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const saveTemplate = () => {
    persistReportTemplate(reportTemplate);
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2000);
    toast.success("Report template saved");
  };

  const resetTemplate = () => {
    setReportTemplate(DEFAULT_TEMPLATE);
    persistReportTemplate(DEFAULT_TEMPLATE);
    toast.success("Template reset to default");
  };

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-up max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Settings2 size={20} className="text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preferences are saved automatically as you change them.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User size={14} className="text-primary" /> Profile
          </CardTitle>
          <CardDescription className="text-xs">Your display name shown in greetings and reports.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-name" className="text-xs">Display name</Label>
            <Input
              id="settings-name"
              className="h-8 text-sm max-w-xs"
              value={prefs.name}
              onChange={(e) => setPrefs({ name: e.target.value || "Researcher" })}
              placeholder="Your name"
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette size={14} className="text-primary" /> Appearance
          </CardTitle>
          <CardDescription className="text-xs">Changes apply instantly — no save needed.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-density" className="text-xs">Layout density</Label>
            <Select
              value={prefs.density}
              onValueChange={(v) => { if (v != null) setPrefs({ density: v as UiPreferences["density"] }); }}
            >
              <SelectTrigger id="settings-density" className="h-8 text-sm max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact" className="text-sm">Compact — tighter spacing</SelectItem>
                <SelectItem value="comfortable" className="text-sm">Comfortable — roomier spacing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Colour tone</Label>
            <div className="flex gap-3 flex-wrap">
              {TONES.map(({ value, label, swatch }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPrefs({ tone: value })}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150 ${
                    prefs.tone === value
                      ? "border-primary ring-1 ring-primary/30 bg-accent"
                      : "hover:bg-accent/60 hover:border-border/80"
                  }`}
                >
                  <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ background: swatch }} />
                  {label}
                  {prefs.tone === value && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1">active</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText size={14} className="text-primary" /> Report Template
          </CardTitle>
          <CardDescription className="text-xs">
            Customize the advisor weekly report. Placeholders: <code className="text-[11px] bg-muted px-1 rounded">{"{{name}}"}</code>{" "}
            <code className="text-[11px] bg-muted px-1 rounded">{"{{date}}"}</code>{" "}
            <code className="text-[11px] bg-muted px-1 rounded">{"{{deep_work}}"}</code>{" "}
            <code className="text-[11px] bg-muted px-1 rounded">{"{{focus_completed}}"}</code> etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            className="font-mono text-xs min-h-[280px] resize-y"
            value={reportTemplate}
            onChange={(e) => setReportTemplate(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={saveTemplate}>
              {templateSaved ? "Saved ✓" : "Save template"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={resetTemplate}>
              Reset to default
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Export & Import */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download size={14} /> Export &amp; Import
          </CardTitle>
          <CardDescription className="text-xs">
            Back up everything — database records (projects, references, venues, submissions, people) and all local settings/data — into a single JSON file. Import to restore or migrate.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Hidden file input */}
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportChange}
          />
          {/* Export */}
          <div className="flex items-center justify-between rounded-md border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Export all data</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saves a <code className="text-[11px]">.json</code> backup with your full database and local preferences.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs ml-4 shrink-0 gap-1.5"
              disabled={isExporting}
              onClick={handleExport}
            >
              {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Export
            </Button>
          </div>
          {/* Import — append */}
          <div className="flex items-center justify-between rounded-md border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Import — Append</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adds records from the backup without removing existing data. Conflicts are skipped.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs ml-4 shrink-0 gap-1.5"
              disabled={isImporting}
              onClick={() => handleImportFile("append")}
            >
              {isImporting ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Import
            </Button>
          </div>
          {/* Import — override */}
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Import — Override</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clears all existing data first, then restores everything from the backup.
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs ml-4 shrink-0 gap-1.5"
              disabled={isImporting}
              onClick={() => handleImportFile("override")}
            >
              {isImporting ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Override
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-destructive flex items-center gap-2">
            <Trash2 size={14} /> Danger zone
          </CardTitle>
          <CardDescription className="text-xs">
            These actions are permanent and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Reset all data</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deletes all projects, references, venues, and submissions from the local database.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger
                disabled={clearMutation.isPending}
                render={
                  <Button variant="destructive" size="sm" className="h-8 text-xs ml-4 shrink-0 gap-1.5" disabled={clearMutation.isPending}>
                    {clearMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Reset
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete everything in your ScholarOS database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => clearMutation.mutate()}
                  >
                    Yes, reset everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { DEFAULT_TEMPLATE, buildAdvisorWeeklyReport };
