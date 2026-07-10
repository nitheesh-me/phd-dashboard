import { FormEvent, useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { consumeNavSelect } from "@/lib/nav-intent";
import { toast } from "sonner";
import { FileText, ExternalLink, Loader2, Pencil, Plus, Search } from "lucide-react";

import { api } from "@/lib/api/tauri-client";
import type { CreateSubmissionTrackerInput, SubmissionStatus, CodeReleaseStatus, SubmissionTracker } from "@/lib/api/types";
import { useCoreData, emptySubmissionForm } from "@/lib/core-data";
import { queryKeys } from "@/lib/api/query-keys";
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

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  Accepted: "status-accepted",
  Rejected: "status-rejected",
  Submitted: "status-submitted",
  Rebuttal: "status-rebuttal",
  Drafting: "status-drafting",
};

const CODE_LABELS: Record<CodeReleaseStatus, string> = {
  NotStarted: "Not started",
  InProgress: "In progress",
  Released: "Released",
};

export function SubmissionsPage() {
  const qc = useQueryClient();
  const { submissionsQuery, venuesQuery, referencesQuery } = useCoreData();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "All">("All");

  // Deep-link from dashboard: open the item that was navigated to
  useEffect(() => {
    const id = consumeNavSelect("submissions");
    if (id) setSelectedId(id);
  }, []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubmissionTracker | null>(null);
  const [form, setForm] = useState<CreateSubmissionTrackerInput>(emptySubmissionForm());

  const submissions = submissionsQuery.data ?? [];
  const venues = venuesQuery.data ?? [];
  const references = referencesQuery.data ?? [];

  const getVenueName = (id: string) => venues.find((v) => v.id === id)?.acronym ?? id;
  const getPaperTitle = (id: string) => references.find((r) => r.id === id)?.title ?? id;

  const filtered = submissions.filter((s) => {
    const kw = search.trim().toLowerCase();
    const vname = getVenueName(s.venue_id).toLowerCase();
    const ptitle = getPaperTitle(s.paper_id).toLowerCase();
    return (kw === "" || vname.includes(kw) || ptitle.includes(kw))
      && (statusFilter === "All" || s.status === statusFilter);
  });
  const selected = submissions.find((s) => s.id === selectedId) ?? null;

  const openCreate = () => { setEditingSub(null); setForm(emptySubmissionForm()); setSheetOpen(true); };
  const openEdit = (s: SubmissionTracker) => {
    setEditingSub(s);
    setForm({ venue_id: s.venue_id, paper_id: s.paper_id, status: s.status, openreview_link: s.openreview_link, code_release_status: s.code_release_status });
    setSheetOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: api.createSubmissionTracker,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.submissions });
      const prev = qc.getQueryData<SubmissionTracker[]>(queryKeys.submissions);
      const tempId = `__temp_${Date.now()}`;
      qc.setQueryData<SubmissionTracker[]>(queryKeys.submissions, (old = []) => [...old, { ...input, id: tempId }]);
      setSheetOpen(false); setSelectedId(tempId);
      return { prev, tempId };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKeys.submissions, ctx.prev); toast.error("Failed to add submission"); },
    onSuccess: (created, _v, ctx) => {
      qc.setQueryData<SubmissionTracker[]>(queryKeys.submissions, (old = []) => old.map((s) => s.id === ctx?.tempId ? created : s));
      setSelectedId(created.id); toast.success("Submission added");
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });

  const updateMutation = useMutation({
    mutationFn: api.updateSubmissionTracker,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.submissions });
      const prev = qc.getQueryData<SubmissionTracker[]>(queryKeys.submissions);
      qc.setQueryData<SubmissionTracker[]>(queryKeys.submissions, (old = []) => old.map((s) => s.id === input.id ? { ...s, ...input } : s));
      setSheetOpen(false);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKeys.submissions, ctx.prev); toast.error("Failed to update submission"); },
    onSuccess: (updated) => {
      qc.setQueryData<SubmissionTracker[]>(queryKeys.submissions, (old = []) => old.map((s) => s.id === updated.id ? updated : s));
      toast.success("Submission updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSubmissionTracker,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.submissions });
      const prev = qc.getQueryData<SubmissionTracker[]>(queryKeys.submissions);
      qc.setQueryData<SubmissionTracker[]>(queryKeys.submissions, (old = []) => old.filter((s) => s.id !== id));
      setSelectedId(null);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKeys.submissions, ctx.prev); toast.error("Failed to delete submission"); },
    onSuccess: () => { toast.success("Submission deleted"); void qc.invalidateQueries({ queryKey: queryKeys.dashboard }); },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingSub) updateMutation.mutate({ ...form, id: editingSub.id });
    else createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><FileText size={18} className="text-primary" /> Submissions</h1>
          <p className="text-xs text-muted-foreground">Paper submission tracker</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={openCreate}><Plus size={14} /> New Submission</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col w-80 border-r shrink-0">
          <div className="flex gap-2 px-3 py-2.5 border-b">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 text-xs pl-8 bg-muted/40" placeholder="Filter…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { if (v != null) setStatusFilter(v as typeof statusFilter); }}>
              <SelectTrigger className="h-8 w-28 text-xs bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {(["Drafting","Submitted","Rebuttal","Accepted","Rejected"] as SubmissionStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <QueryState isLoading={submissionsQuery.isLoading} error={submissionsQuery.error} empty={filtered.length === 0} emptyText="No submissions yet.">
                {filtered.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`list-stagger w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 border ${
                      s.id === selectedId ? "bg-primary/10 border-primary/30 shadow-sm" : "border-transparent hover:bg-accent/70"
                    }`}
                    style={{ animationDelay: `${idx * 35}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium">{getVenueName(s.venue_id)}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_CLASS[s.status]}`}>{s.status}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{getPaperTitle(s.paper_id)}</p>
                  </button>
                ))}
              </QueryState>
            </div>
          </ScrollArea>
          <div className="px-3 py-2 border-t">
            <p className="text-[11px] text-muted-foreground">{filtered.length} submission{filtered.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div key={selected.id} className="p-6 flex flex-col gap-5 animate-slide-in-right">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">{getVenueName(selected.venue_id)}</h2>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CLASS[selected.status]}`}>{selected.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{getPaperTitle(selected.paper_id)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openEdit(selected)}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <ConfirmDeleteDialog
                    label="Delete Submission"
                    description="This submission record will be permanently removed."
                    onConfirm={() => deleteMutation.mutate(selected.id)}
                    disabled={deleteMutation.isPending}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Code release</p>
                  <Badge variant="outline">{CODE_LABELS[selected.code_release_status]}</Badge>
                </div>
                {selected.openreview_link && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">OpenReview</p>
                    <a href={selected.openreview_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                      <ExternalLink size={12} /> {selected.openreview_link}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <FileText size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Select a submission</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">Track submission status, code release, and review links</p>
              <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs" onClick={openCreate}><Plus size={13} /> New Submission</Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle>{editingSub ? "Edit Submission" : "New Submission"}</SheetTitle>
            <SheetDescription>{editingSub ? "Update submission details." : "Track a new paper submission."}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            <form id="submission-form" onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Venue *</Label>
                <Select value={form.venue_id || "__none__"} onValueChange={(v) => { if (v != null) setForm((f) => ({ ...f, venue_id: v === "__none__" ? "" : v })); }}>
                  <SelectTrigger className="h-9">
                    <span className="truncate">
                      {form.venue_id ? (venues.find((v) => v.id === form.venue_id)?.acronym || venues.find((v) => v.id === form.venue_id)?.name) : "Select venue…"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select venue…</SelectItem>
                    {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.acronym || v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Paper *</Label>
                <Select value={form.paper_id || "__none__"} onValueChange={(v) => { if (v != null) setForm((f) => ({ ...f, paper_id: v === "__none__" ? "" : v })); }}>
                  <SelectTrigger className="h-9">
                    <span className="truncate">
                      {form.paper_id ? (references.find((r) => r.id === form.paper_id)?.title ?? form.paper_id) : "Select paper…"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select paper…</SelectItem>
                    {references.map((r) => <SelectItem key={r.id} value={r.id} className="text-xs">{r.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={form.status} onValueChange={(v) => { if (v != null) setForm((f) => ({ ...f, status: v as SubmissionStatus })); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["Drafting","Submitted","Rebuttal","Accepted","Rejected"] as SubmissionStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Code release</Label>
                  <Select value={form.code_release_status} onValueChange={(v) => { if (v != null) setForm((f) => ({ ...f, code_release_status: v as CodeReleaseStatus })); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NotStarted">Not started</SelectItem>
                      <SelectItem value="InProgress">In progress</SelectItem>
                      <SelectItem value="Released">Released</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">OpenReview link</Label>
                <Input type="url" className="h-9" placeholder="https://openreview.net/…" value={form.openreview_link ?? ""} onChange={(e) => setForm((f) => ({ ...f, openreview_link: e.target.value || null }))} />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="border-t px-6 py-4 flex-row gap-2">
            <Button form="submission-form" type="submit" className="flex-1 gap-1.5" disabled={isPending || !form.venue_id || !form.paper_id}>
              {isPending ? <Loader2 size={14} className="animate-spin" /> : editingSub ? null : <Plus size={14} />}
              {editingSub ? "Save changes" : "Add submission"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
