import { FormEvent, useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { consumeNavSelect } from "@/lib/nav-intent";
import { toast } from "sonner";
import { BookOpen, ExternalLink, Loader2, Pencil, Plus, Search, Star, StarOff } from "lucide-react";

import { api } from "@/lib/api/tauri-client";
import type { CreateReferenceInput, ReadStatus, Reference } from "@/lib/api/types";
import { useCoreData, emptyReferenceForm } from "@/lib/core-data";
import { queryKeys } from "@/lib/api/query-keys";
import { splitCsv } from "@/lib/format";
import { parseBibtex } from "@/lib/parsers";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const READ_STATUS_COLOR: Record<ReadStatus, string> = {
  Unread: "bg-muted text-muted-foreground",
  Reading: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Read: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function StarRating({ value, onChange }: { value: number | null; onChange?: (v: number | null) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(value === n ? null : n)}
          className={`transition-colors ${n <= (value ?? 0) ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300"}`}
        >
          <Star size={14} fill={n <= (value ?? 0) ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export function ReferencesPage() {
  const qc = useQueryClient();
  const { referencesQuery } = useCoreData();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReadStatus | "All">("All");

  // Deep-link from dashboard: open the item that was navigated to
  useEffect(() => {
    const id = consumeNavSelect("references");
    if (id) setSelectedId(id);
  }, []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<Reference | null>(null);
  const [form, setForm] = useState<CreateReferenceInput>(emptyReferenceForm());
  const [rating, setRating] = useState<number | null>(null);
  const [bibtexInput, setBibtexInput] = useState("");

  const importFromBibtex = () => {
    if (!bibtexInput.trim()) return;
    const parsed = parseBibtex(bibtexInput);
    setForm((f) => ({
      ...f,
      title: parsed.title ?? f.title,
      authors: parsed.authors?.length ? parsed.authors : f.authors,
      doi: parsed.doi ?? f.doi,
      arxiv_id: parsed.arxiv_id ?? f.arxiv_id,
      abstract_text: parsed.abstract_text ?? f.abstract_text,
      tags: parsed.tags?.length ? parsed.tags : f.tags,
      read_status: parsed.read_status ?? f.read_status,
    }));
    setBibtexInput("");
    toast.success("BibTeX imported — review fields below");
  };

  const references = referencesQuery.data ?? [];
  const filtered = references.filter((r) => {
    const kw = search.trim().toLowerCase();
    return (kw === "" || r.title.toLowerCase().includes(kw) || r.authors.join(" ").toLowerCase().includes(kw) || r.tags.join(" ").toLowerCase().includes(kw))
      && (statusFilter === "All" || r.read_status === statusFilter);
  });
  const selected = references.find((r) => r.id === selectedId) ?? null;

  const openCreate = () => { setEditingRef(null); setForm(emptyReferenceForm()); setRating(null); setSheetOpen(true); };
  const openEdit = (r: Reference) => {
    setEditingRef(r);
    setForm({ title: r.title, authors: r.authors, abstract_text: r.abstract, doi: r.doi, arxiv_id: r.arxiv_id, tags: r.tags, read_status: r.read_status });
    setRating(r.rating);
    setSheetOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: api.createReference,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.references });
      const prev = qc.getQueryData<Reference[]>(queryKeys.references);
      const tempId = `__temp_${Date.now()}`;
      qc.setQueryData<Reference[]>(queryKeys.references, (old = []) => [...old, { ...input, id: tempId, abstract: input.abstract_text, pdf_local_path: null, bibtex: null, rating: null, date_added: new Date().toISOString() }]);
      setSheetOpen(false); setSelectedId(tempId);
      return { prev, tempId };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKeys.references, ctx.prev); toast.error("Failed to add reference"); },
    onSuccess: (created, _v, ctx) => {
      qc.setQueryData<Reference[]>(queryKeys.references, (old = []) => old.map((r) => r.id === ctx?.tempId ? created : r));
      setSelectedId(created.id); toast.success("Reference added");
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });

  const updateMutation = useMutation({
    mutationFn: api.updateReference,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.references });
      const prev = qc.getQueryData<Reference[]>(queryKeys.references);
      qc.setQueryData<Reference[]>(queryKeys.references, (old = []) => old.map((r) => r.id === input.id ? { ...r, ...input, abstract: input.abstract_text } : r));
      setSheetOpen(false);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKeys.references, ctx.prev); toast.error("Failed to update reference"); },
    onSuccess: (updated) => {
      qc.setQueryData<Reference[]>(queryKeys.references, (old = []) => old.map((r) => r.id === updated.id ? updated : r));
      toast.success("Reference updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteReference,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.references });
      const prev = qc.getQueryData<Reference[]>(queryKeys.references);
      qc.setQueryData<Reference[]>(queryKeys.references, (old = []) => old.filter((r) => r.id !== id));
      setSelectedId(null);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKeys.references, ctx.prev); toast.error("Failed to delete reference"); },
    onSuccess: () => { toast.success("Reference deleted"); void qc.invalidateQueries({ queryKey: queryKeys.dashboard }); },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingRef) updateMutation.mutate({ ...form, id: editingRef.id, rating });
    else createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><BookOpen size={18} className="text-primary" /> References</h1>
          <p className="text-xs text-muted-foreground">Papers, articles, and reading list</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={openCreate}><Plus size={14} /> New Reference</Button>
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
                <SelectItem value="Unread">Unread</SelectItem>
                <SelectItem value="Reading">Reading</SelectItem>
                <SelectItem value="Read">Read</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <QueryState isLoading={referencesQuery.isLoading} error={referencesQuery.error} empty={filtered.length === 0} emptyText="No references yet.">
                {filtered.map((r, idx) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`list-stagger w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 border ${
                      r.id === selectedId ? "bg-primary/10 border-primary/30 shadow-sm" : "border-transparent hover:bg-accent/70"
                    }`}
                    style={{ animationDelay: `${idx * 35}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="text-sm font-medium line-clamp-2 leading-snug">{r.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${READ_STATUS_COLOR[r.read_status]}`}>{r.read_status}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{r.authors.slice(0, 3).join(", ")}</p>
                    {r.rating && (
                      <div className="flex items-center gap-0.5 mt-1">
                        {Array.from({ length: r.rating }, (_, i) => <Star key={i} size={9} className="text-amber-400" fill="currentColor" />)}
                      </div>
                    )}
                  </button>
                ))}
              </QueryState>
            </div>
          </ScrollArea>
          <div className="px-3 py-2 border-t">
            <p className="text-[11px] text-muted-foreground">{filtered.length} reference{filtered.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {selected ? (
            <div key={selected.id} className="p-6 flex flex-col gap-5 animate-slide-in-right">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold leading-snug">{selected.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{selected.authors.join(", ")}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${READ_STATUS_COLOR[selected.read_status]}`}>{selected.read_status}</span>
                    {selected.rating && <StarRating value={selected.rating} />}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openEdit(selected)}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <ConfirmDeleteDialog
                    label="Delete Reference"
                    description={`"${selected.title}" will be permanently removed.`}
                    onConfirm={() => deleteMutation.mutate(selected.id)}
                    disabled={deleteMutation.isPending}
                  />
                </div>
              </div>
              <Separator />
              {selected.abstract && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Abstract</p>
                  <p className="text-sm leading-relaxed text-foreground/90">{selected.abstract}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {selected.doi && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">DOI</p>
                    <a href={`https://doi.org/${selected.doi}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                      <ExternalLink size={12} /> {selected.doi}
                    </a>
                  </div>
                )}
                {selected.arxiv_id && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">arXiv</p>
                    <a href={`https://arxiv.org/abs/${selected.arxiv_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                      <ExternalLink size={12} /> {selected.arxiv_id}
                    </a>
                  </div>
                )}
              </div>
              {selected.tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <BookOpen size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Select a reference</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">Browse your reading list and view abstracts</p>
              <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs" onClick={openCreate}><Plus size={13} /> New Reference</Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle>{editingRef ? "Edit Reference" : "New Reference"}</SheetTitle>
            <SheetDescription>{editingRef ? `Editing "${editingRef.title.slice(0, 40)}…"` : "Add a paper to your reading list."}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 px-6 py-4">
            {!editingRef && (
              <div className="mb-4">
                <Tabs defaultValue="manual">
                  <TabsList className="h-7 w-full mb-3">
                    <TabsTrigger value="manual" className="text-xs h-6 flex-1">Manual</TabsTrigger>
                    <TabsTrigger value="bibtex" className="text-xs h-6 flex-1">BibTeX Import</TabsTrigger>
                  </TabsList>
                  <TabsContent value="bibtex">
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-muted-foreground">Paste a BibTeX entry to auto-fill the form below.</p>
                      <Textarea
                        className="font-mono text-xs resize-none min-h-[140px]"
                        placeholder={"@article{key,\n  title = {Paper Title},\n  author = {Last, First and Second, Author},\n  doi = {10.xxxx/...},\n  year = {2024},\n  abstract = {Optional abstract...}\n}"}
                        value={bibtexInput}
                        onChange={(e) => setBibtexInput(e.target.value)}
                      />
                      <Button type="button" size="sm" className="h-8 gap-1.5 self-end" onClick={importFromBibtex} disabled={!bibtexInput.trim()}>
                        <Plus size={13} /> Parse & Fill Form
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="manual">
                    {/* fallthrough — form below is always shown */}
                  </TabsContent>
                </Tabs>
                <Separator className="mt-1" />
              </div>
            )}
            <form id="reference-form" onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Title *</Label>
                <Textarea required className="resize-none min-h-[60px] text-sm" placeholder="Paper title…" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Authors (comma-separated)</Label>
                <Input className="h-9" placeholder="Author A, Author B" value={form.authors.join(", ")} onChange={(e) => setForm((f) => ({ ...f, authors: splitCsv(e.target.value) }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">DOI</Label>
                  <Input className="h-9 text-sm" placeholder="10.xxxx/…" value={form.doi ?? ""} onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value || null }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">arXiv ID</Label>
                  <Input className="h-9 text-sm" placeholder="2301.00001" value={form.arxiv_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, arxiv_id: e.target.value || null }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Read status</Label>
                  <Select value={form.read_status} onValueChange={(v) => { if (v != null) setForm((f) => ({ ...f, read_status: v as ReadStatus })); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unread">Unread</SelectItem>
                      <SelectItem value="Reading">Reading</SelectItem>
                      <SelectItem value="Read">Read</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingRef && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Rating</Label>
                    <div className="flex items-center h-9">
                      <StarRating value={rating} onChange={setRating} />
                      {rating && <button type="button" onClick={() => setRating(null)} className="ml-2 text-muted-foreground hover:text-foreground"><StarOff size={13} /></button>}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Tags (comma-separated)</Label>
                <Input className="h-9" placeholder="nlp, transformer, survey" value={form.tags.join(", ")} onChange={(e) => setForm((f) => ({ ...f, tags: splitCsv(e.target.value) }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Abstract</Label>
                <Textarea className="resize-none min-h-[80px] text-sm" placeholder="Optional abstract…" value={form.abstract_text ?? ""} onChange={(e) => setForm((f) => ({ ...f, abstract_text: e.target.value || null }))} />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="border-t px-6 py-4 flex-row gap-2">
            <Button form="reference-form" type="submit" className="flex-1 gap-1.5" disabled={isPending}>
              {isPending ? <Loader2 size={14} className="animate-spin" /> : editingRef ? null : <Plus size={14} />}
              {editingRef ? "Save changes" : "Add reference"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
