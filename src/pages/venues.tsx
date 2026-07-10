import { FormEvent, useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { consumeNavSelect } from "@/lib/nav-intent";
import { toast } from "sonner";
import { Building2, CalendarDays, ExternalLink, Loader2, Pencil, Plus, Search } from "lucide-react";

import { api } from "@/lib/api/tauri-client";
import type { CreateVenueInput, VenueType, Venue } from "@/lib/api/types";
import { useCoreData, emptyVenueForm } from "@/lib/core-data";
import { queryKeys } from "@/lib/api/query-keys";
import { toLocalDateInput, formatDate, daysUntil, formatDaysLeft } from "@/lib/format";
import { QueryState } from "@/components/shared/query-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";

function deadlineBadge(dateStr: string | null): { label: string; urgent: boolean } | null {
  if (!dateStr) return null;
  const days = daysUntil(dateStr);
  if (days === null) return null;
  return { label: formatDaysLeft(days), urgent: days <= 14 };
}

export function VenuesPage() {
  const qc = useQueryClient();
  const { venuesQuery } = useCoreData();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<VenueType | "All">("All");

  // Deep-link from dashboard: open the item that was navigated to
  useEffect(() => {
    const id = consumeNavSelect("venues");
    if (id) setSelectedId(id);
  }, []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [form, setForm] = useState<CreateVenueInput>(emptyVenueForm());

  const venues = venuesQuery.data ?? [];
  const filtered = venues.filter((v) => {
    const kw = search.trim().toLowerCase();
    return (kw === "" || v.name.toLowerCase().includes(kw) || v.acronym.toLowerCase().includes(kw))
      && (typeFilter === "All" || v.type === typeFilter);
  });
  const selected = venues.find((v) => v.id === selectedId) ?? null;

  const openCreate = () => { setEditingVenue(null); setForm(emptyVenueForm()); setSheetOpen(true); };
  const openEdit = (v: Venue) => {
    setEditingVenue(v);
    setForm({ name: v.name, acronym: v.acronym, venue_type: v.type, submission_deadline: v.submission_deadline, abstract_deadline: v.abstract_deadline, url: v.url, version: v.version ?? null });
    setSheetOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: api.createVenue,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.venues });
      const prev = qc.getQueryData<Venue[]>(queryKeys.venues);
      const tempId = `__temp_${Date.now()}`;
      qc.setQueryData<Venue[]>(queryKeys.venues, (old = []) => [...old, { ...input, id: tempId, type: input.venue_type, core_ranking: null, h5_index: null, rebuttal_date: null, notification_date: null, camera_ready_date: null }]);
      setSheetOpen(false); setSelectedId(tempId);
      return { prev, tempId };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKeys.venues, ctx.prev); toast.error("Failed to add venue"); },
    onSuccess: (created, _v, ctx) => {
      qc.setQueryData<Venue[]>(queryKeys.venues, (old = []) => old.map((v) => v.id === ctx?.tempId ? created : v));
      setSelectedId(created.id); toast.success("Venue added");
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });

  const updateMutation = useMutation({
    mutationFn: api.updateVenue,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.venues });
      const prev = qc.getQueryData<Venue[]>(queryKeys.venues);
      qc.setQueryData<Venue[]>(queryKeys.venues, (old = []) => old.map((v) => v.id === input.id ? { ...v, ...input, type: input.venue_type } : v));
      setSheetOpen(false);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKeys.venues, ctx.prev); toast.error("Failed to update venue"); },
    onSuccess: (updated) => {
      qc.setQueryData<Venue[]>(queryKeys.venues, (old = []) => old.map((v) => v.id === updated.id ? updated : v));
      toast.success("Venue updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteVenue,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.venues });
      const prev = qc.getQueryData<Venue[]>(queryKeys.venues);
      qc.setQueryData<Venue[]>(queryKeys.venues, (old = []) => old.filter((v) => v.id !== id));
      setSelectedId(null);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKeys.venues, ctx.prev); toast.error("Failed to delete venue"); },
    onSuccess: () => { toast.success("Venue deleted"); void qc.invalidateQueries({ queryKey: queryKeys.dashboard }); },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingVenue) updateMutation.mutate({ ...form, id: editingVenue.id });
    else createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Building2 size={18} className="text-primary" /> Venues</h1>
          <p className="text-xs text-muted-foreground">Conferences and journals to track</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={openCreate}><Plus size={14} /> New Venue</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col w-80 border-r shrink-0">
          <div className="flex gap-2 px-3 py-2.5 border-b">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 text-xs pl-8 bg-muted/40" placeholder="Filter…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={(v) => { if (v != null) setTypeFilter(v as typeof typeFilter); }}>
              <SelectTrigger className="h-8 w-28 text-xs bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Conference">Conference</SelectItem>
                <SelectItem value="Journal">Journal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <QueryState isLoading={venuesQuery.isLoading} error={venuesQuery.error} empty={filtered.length === 0} emptyText="No venues yet.">
                {filtered.map((v, idx) => {
                  const dl = deadlineBadge(v.submission_deadline);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedId(v.id)}
                      className={`list-stagger w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 border ${
                        v.id === selectedId ? "bg-primary/10 border-primary/30 shadow-sm" : "border-transparent hover:bg-accent/70"
                      }`}
                      style={{ animationDelay: `${idx * 35}ms` }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{v.acronym || v.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">{v.type}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] text-muted-foreground truncate">{v.name}</p>
                        {dl && <span className={`text-[10px] shrink-0 font-medium ${dl.urgent ? "text-destructive" : "text-muted-foreground"}`}>{dl.label}</span>}
                      </div>
                    </button>
                  );
                })}
              </QueryState>
            </div>
          </ScrollArea>
          <div className="px-3 py-2 border-t">
            <p className="text-[11px] text-muted-foreground">{filtered.length} venue{filtered.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div key={selected.id} className="p-6 flex flex-col gap-5 animate-slide-in-right">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{selected.acronym || selected.name}</h2>
                    <Badge variant="outline">{selected.type}</Badge>
                  </div>
                  {selected.acronym && <p className="text-sm text-muted-foreground mt-0.5">{selected.name}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openEdit(selected)}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <ConfirmDeleteDialog
                    label="Delete Venue"
                    description={`"${selected.name}" will be permanently removed.`}
                    onConfirm={() => deleteMutation.mutate(selected.id)}
                    disabled={deleteMutation.isPending}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-3">
                {[
                  { label: "Abstract deadline", date: selected.abstract_deadline },
                  { label: "Submission deadline", date: selected.submission_deadline },
                  { label: "Rebuttal date", date: selected.rebuttal_date },
                  { label: "Notification date", date: selected.notification_date },
                  { label: "Camera ready", date: selected.camera_ready_date },
                ].filter((d) => d.date).map(({ label, date }) => {
                  const days = date ? daysUntil(date) : null;
                  const urgent = days !== null && days <= 14;
                  return (
                    <div key={label} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="text-muted-foreground" />
                        <span className="text-sm">{label}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{date ? formatDate(date) : "—"}</p>
                        {days !== null && <p className={`text-[11px] ${urgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>{formatDaysLeft(days)}</p>}
                      </div>
                    </div>
                  );
                })}
                {selected.url && (
                  <a href={selected.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ExternalLink size={13} /> {selected.url}
                  </a>
                )}
                {selected.version && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Version / Edition</p>
                    <p className="text-sm">{selected.version}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Building2 size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Select a venue</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">Choose a venue to view deadlines and details</p>
              <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs" onClick={openCreate}><Plus size={13} /> New Venue</Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle>{editingVenue ? "Edit Venue" : "New Venue"}</SheetTitle>
            <SheetDescription>{editingVenue ? `Editing "${editingVenue.name}"` : "Add a conference or journal."}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            <form id="venue-form" onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Name *</Label>
                <Input required className="h-9" placeholder="International Conference on Machine Learning" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Acronym *</Label>
                  <Input required className="h-9 uppercase" placeholder="ICML" value={form.acronym} onChange={(e) => setForm((f) => ({ ...f, acronym: e.target.value.toUpperCase() }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Type</Label>
                  <Select value={form.venue_type} onValueChange={(v) => { if (v != null) setForm((f) => ({ ...f, venue_type: v as VenueType })); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Conference">Conference</SelectItem>
                      <SelectItem value="Journal">Journal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Abstract deadline</Label>
                <DatePicker value={form.abstract_deadline ?? null} onChange={(d) => setForm((f) => ({ ...f, abstract_deadline: d }))} placeholder="No abstract deadline" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Submission deadline</Label>
                <DatePicker value={form.submission_deadline ?? null} onChange={(d) => setForm((f) => ({ ...f, submission_deadline: d }))} placeholder="No submission deadline" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">URL</Label>
                <Input type="url" className="h-9" placeholder="https://…" value={form.url ?? ""} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value || null }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Version / Edition</Label>
                <Input className="h-9" placeholder="e.g. 2025, Vol. 12, Q2…" value={form.version ?? ""} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value || null }))} />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="border-t px-6 py-4 flex-row gap-2">
            <Button form="venue-form" type="submit" className="flex-1 gap-1.5" disabled={isPending}>
              {isPending ? <Loader2 size={14} className="animate-spin" /> : editingVenue ? null : <Plus size={14} />}
              {editingVenue ? "Save changes" : "Add venue"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
