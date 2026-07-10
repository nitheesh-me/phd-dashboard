import { FormEvent, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, Pencil, Plus, Search, Users } from "lucide-react";

import { api } from "@/lib/api/tauri-client";
import type { CreatePersonInput, Person } from "@/lib/api/types";
import { useCoreData, emptyPersonForm } from "@/lib/core-data";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/format";
import { QueryState } from "@/components/shared/query-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

const PRESET_RELATIONSHIPS = ["Advisor", "Co-author", "Reviewer", "Researcher"] as const;
type PresetRelationship = typeof PRESET_RELATIONSHIPS[number];

function isPreset(r: string): r is PresetRelationship {
  return (PRESET_RELATIONSHIPS as readonly string[]).includes(r);
}

function relationshipBadgeColor(r: string) {
  if (r === "Advisor") return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
  if (r === "Co-author") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (r === "Researcher") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

export function PeoplePage() {
  const qc = useQueryClient();
  const { peopleQuery } = useCoreData();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [relFilter, setRelFilter] = useState<string>("All");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [form, setForm] = useState<CreatePersonInput>(emptyPersonForm());
  // "other" input state for custom relationship text
  const [relSelectValue, setRelSelectValue] = useState<string>("Researcher");
  const [relOtherText, setRelOtherText] = useState("");

  const people = peopleQuery.data ?? [];
  const filtered = people.filter((p) => {
    const kw = search.trim().toLowerCase();
    const matchesSearch =
      kw === "" ||
      p.name.toLowerCase().includes(kw) ||
      (p.email ?? "").toLowerCase().includes(kw) ||
      (p.institution ?? "").toLowerCase().includes(kw);
    const matchesRel = relFilter === "All" || p.relationship === relFilter;
    return matchesSearch && matchesRel;
  });
  const selected = people.find((p) => p.id === selectedId) ?? null;

  const openCreate = () => {
    setEditingPerson(null);
    setForm(emptyPersonForm());
    setRelSelectValue("Researcher");
    setRelOtherText("");
    setSheetOpen(true);
  };
  const openEdit = (p: Person) => {
    setEditingPerson(p);
    const preset = isPreset(p.relationship);
    setRelSelectValue(preset ? p.relationship : "Other");
    setRelOtherText(preset ? "" : p.relationship);
    setForm({
      name: p.name,
      email: p.email,
      institution: p.institution,
      relationship: p.relationship,
      notes: p.notes,
      last_contacted: p.last_contacted,
    });
    setSheetOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: api.createPerson,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.people });
      const prev = qc.getQueryData<Person[]>(queryKeys.people);
      const tempId = `__temp_${Date.now()}`;
      qc.setQueryData<Person[]>(queryKeys.people, (old = []) => [
        ...old,
        { ...input, id: tempId },
      ]);
      setSheetOpen(false);
      setSelectedId(tempId);
      return { prev, tempId };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.people, ctx.prev);
      toast.error("Failed to add contact");
    },
    onSuccess: (created, _v, ctx) => {
      qc.setQueryData<Person[]>(queryKeys.people, (old = []) =>
        old.map((p) => (p.id === ctx?.tempId ? created : p)),
      );
      setSelectedId(created.id);
      toast.success("Contact added");
    },
  });

  const updateMutation = useMutation({
    mutationFn: api.updatePerson,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.people });
      const prev = qc.getQueryData<Person[]>(queryKeys.people);
      qc.setQueryData<Person[]>(queryKeys.people, (old = []) =>
        old.map((p) => (p.id === input.id ? { ...p, ...input } : p)),
      );
      setSheetOpen(false);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.people, ctx.prev);
      toast.error("Failed to update contact");
    },
    onSuccess: (updated) => {
      qc.setQueryData<Person[]>(queryKeys.people, (old = []) =>
        old.map((p) => (p.id === updated.id ? updated : p)),
      );
      toast.success("Contact updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deletePerson,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.people });
      const prev = qc.getQueryData<Person[]>(queryKeys.people);
      qc.setQueryData<Person[]>(queryKeys.people, (old = []) => old.filter((p) => p.id !== id));
      setSelectedId(null);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.people, ctx.prev);
      toast.error("Failed to delete contact");
    },
    onSuccess: () => { toast.success("Contact removed"); },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const rel = relSelectValue === "Other" ? relOtherText.trim() || "Other" : relSelectValue;
    const finalForm = { ...form, relationship: rel };
    if (editingPerson) updateMutation.mutate({ ...finalForm, id: editingPerson.id });
    else createMutation.mutate(finalForm);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Users size={18} className="text-primary" /> People
          </h1>
          <p className="text-xs text-muted-foreground">Contacts, collaborators, and advisors</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={openCreate}>
          <Plus size={14} /> New Contact
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="flex flex-col w-80 border-r shrink-0">
          <div className="flex gap-2 px-3 py-2.5 border-b">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 text-xs pl-8 bg-muted/40"
                placeholder="Filter…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={relFilter}
              onValueChange={(v) => { if (v != null) setRelFilter(v as typeof relFilter); }}
            >
              <SelectTrigger className="h-8 w-28 text-xs bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {PRESET_RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <QueryState
                isLoading={peopleQuery.isLoading}
                error={peopleQuery.error}
                empty={filtered.length === 0}
                emptyText="No contacts yet."
              >
                {filtered.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`list-stagger w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 border ${
                      p.id === selectedId
                        ? "bg-primary/10 border-primary/30 shadow-sm"
                        : "border-transparent hover:bg-accent/70"
                    }`}
                    style={{ animationDelay: `${idx * 35}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${relationshipBadgeColor(p.relationship)}`}>
                        {p.relationship}
                      </span>
                    </div>
                    {p.institution && (
                      <p className="text-[11px] text-muted-foreground truncate">{p.institution}</p>
                    )}
                  </button>
                ))}
              </QueryState>
            </div>
          </ScrollArea>
          <div className="px-3 py-2 border-t">
            <p className="text-[11px] text-muted-foreground">
              {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div key={selected.id} className="p-6 flex flex-col gap-5 animate-slide-in-right">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">{selected.name}</h2>
                    <Badge variant="outline">{selected.relationship}</Badge>
                  </div>
                  {selected.institution && (
                    <p className="text-sm text-muted-foreground mt-0.5">{selected.institution}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => openEdit(selected)}
                  >
                    <Pencil size={13} /> Edit
                  </Button>
                  <ConfirmDeleteDialog
                    label="Remove Contact"
                    description={`"${selected.name}" will be permanently removed.`}
                    onConfirm={() => deleteMutation.mutate(selected.id)}
                    disabled={deleteMutation.isPending}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-3">
                {selected.email && (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5">
                    <Mail size={14} className="text-muted-foreground shrink-0" />
                    <a
                      href={`mailto:${selected.email}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {selected.email}
                    </a>
                  </div>
                )}
                {selected.last_contacted && (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                    <span className="text-sm text-muted-foreground">Last contacted</span>
                    <span className="text-sm font-medium">{formatDate(selected.last_contacted)}</span>
                  </div>
                )}
                {selected.notes && (
                  <div className="rounded-lg border px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Users size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Select a contact</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Choose a person to view their details
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1.5 text-xs"
                onClick={openCreate}
              >
                <Plus size={13} /> New Contact
              </Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle>{editingPerson ? "Edit Contact" : "New Contact"}</SheetTitle>
            <SheetDescription>
              {editingPerson ? `Editing "${editingPerson.name}"` : "Add a researcher or collaborator."}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            <form id="person-form" onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Name *</Label>
                <Input
                  required
                  className="h-9"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Relationship</Label>
                <Select
                  value={relSelectValue}
                  onValueChange={(v) => {
                    if (v != null) {
                      setRelSelectValue(v);
                      if (v !== "Other") setForm((f) => ({ ...f, relationship: v }));
                    }
                  }}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRESET_RELATIONSHIPS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other (custom)…</SelectItem>
                  </SelectContent>
                </Select>
                {relSelectValue === "Other" && (
                  <Input
                    className="h-9 mt-1"
                    placeholder="e.g. Industry contact, Mentor…"
                    value={relOtherText}
                    onChange={(e) => setRelOtherText(e.target.value)}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input
                  type="email"
                  className="h-9"
                  placeholder="jane@university.edu"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value || null }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Institution</Label>
                <Input
                  className="h-9"
                  placeholder="MIT, Stanford…"
                  value={form.institution ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value || null }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Last contacted</Label>
                <DatePicker
                  value={form.last_contacted}
                  onChange={(d) => setForm((f) => ({ ...f, last_contacted: d }))}
                  placeholder="Not recorded"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea
                  className="resize-none text-sm min-h-[80px]"
                  placeholder="Research interests, how you met, collaboration ideas…"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
                />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="border-t px-6 py-4 flex-row gap-2">
            <Button form="person-form" type="submit" className="flex-1 gap-1.5" disabled={isPending}>
              {isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : editingPerson ? null : (
                <Plus size={14} />
              )}
              {editingPerson ? "Save changes" : "Add contact"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
