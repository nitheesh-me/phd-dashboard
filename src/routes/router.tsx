import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from "@tanstack/react-router";
import {
  BookMarked,
  Building2,
  Command,
  FileText,
  FolderGit2,
  LayoutDashboard,
  Loader2,
  Moon,
  Send,
  Settings,
  Sun,
  Trash2,
  Users,
} from "lucide-react";

import { api } from "@/lib/api/tauri-client";
import { getTimeGreeting } from "@/lib/format";
import { useCoreData } from "@/lib/core-data";
import { importLocalData } from "@/lib/persistence";
import { useCommandPaletteStore } from "@/store/command-palette-store";
import { usePrefsStore } from "@/store/prefs-store";

import { DashboardPage } from "@/pages/dashboard";
import { ProjectsPage } from "@/pages/projects";
import { ReferencesPage } from "@/pages/references";
import { VenuesPage } from "@/pages/venues";
import { SubmissionsPage } from "@/pages/submissions";
import { PeoplePage } from "@/pages/people";
import { SettingsPage } from "@/pages/settings";
import { ReportsPage } from "@/pages/reports";

import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


// ── Command Palette ─────────────────────────────────────────────
const PALETTE_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" },
  { icon: FolderGit2, label: "Projects", to: "/projects" },
  { icon: BookMarked, label: "References", to: "/references" },
  { icon: Building2, label: "Venues", to: "/venues" },
  { icon: Send, label: "Submissions", to: "/submissions" },
  { icon: Users, label: "People", to: "/people" },
  { icon: FileText, label: "Reports", to: "/reports" },
  { icon: Settings, label: "Settings", to: "/settings" },
] as const;

function CommandPalette(): JSX.Element | null {
  const { isOpen, close } = useCommandPaletteStore();
  const navigate = useNavigate();
  const { invalidateCore } = useCoreData();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const clearAllMutation = useMutation({
    mutationFn: api.clearAllData,
    onSuccess: invalidateCore,
  });

  const filtered = PALETTE_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );
  const showReset = "reset".includes(query.toLowerCase()) || query === "";
  type PaletteItem = { icon: React.ElementType; label: string; to: string };
  const items: PaletteItem[] = [
    ...filtered,
    ...(showReset ? [{ icon: Trash2, label: "Reset All Data", to: "__reset__" }] : []),
  ];

  const go = useCallback((to: string) => {
    if (to === "__reset__") { clearAllMutation.mutate(); }
    else { void navigate({ to }); }
    close(); setQuery(""); setActiveIdx(0);
  }, [clearAllMutation, navigate, close]);

  useEffect(() => {
    if (isOpen) { setQuery(""); setActiveIdx(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [isOpen]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[activeIdx]) go(items[activeIdx].to); }
    else if (e.key === "Escape") { close(); setQuery(""); }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24"
      onClick={() => { close(); setQuery(""); }}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-popover shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Command size={15} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search pages & actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="text-muted-foreground hover:text-foreground text-xs" onClick={() => setQuery("")}>✕</button>
          )}
        </div>
        <div className="flex flex-col py-1 max-h-72 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No results for "{query}"</p>
          )}
          {items.map(({ icon: Icon, label, to }, idx) => (
            <button
              key={to}
              type="button"
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${to === "__reset__" ? "text-destructive" : ""} ${idx === activeIdx ? "bg-accent" : "hover:bg-accent/60"}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => go(to)}
              disabled={to === "__reset__" && clearAllMutation.isPending}
            >
              {to === "__reset__" && clearAllMutation.isPending
                ? <Loader2 size={15} className="animate-spin" />
                : <Icon size={15} />}
              {label}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>↑↓ navigate</span><span>↵ select</span><span>Esc close</span>
        </div>
      </div>
    </div>
  );
}

// ── App Shell ───────────────────────────────────────────────────
function AppFrame(): JSX.Element {
  const openPalette = useCommandPaletteStore((state) => state.open);
  const { prefs, setPrefs } = usePrefsStore();
  const { invalidateCore } = useCoreData();
  const [isDark, setIsDark] = useState<boolean>(
    () => document.documentElement.classList.contains("dark")
      || window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // Onboarding: show for fresh users
  const [showOnboarding, setShowOnboarding] = useState(() => !prefs.setupDone);
  const [onboardingName, setOnboardingName] = useState(prefs.name === "Researcher" ? "" : prefs.name);
  const [onboardingImporting, setOnboardingImporting] = useState(false);
  const onboardingFileRef = useRef<HTMLInputElement>(null);

  const handleOnboardingImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOnboardingImporting(true);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as { db?: object; local?: object; name?: string };
      if (!bundle.db && !bundle.local) throw new Error("Unrecognised backup file");
      if (bundle.db) await api.importData(JSON.stringify(bundle.db), "override");
      if (bundle.local) importLocalData(bundle.local);
      await invalidateCore();
      // Pre-fill name from backup if user hasn't typed one
      const backupName = (bundle.local as { uiPreferences?: { name?: string } } | undefined)?.uiPreferences?.name;
      if (backupName && !onboardingName) setOnboardingName(backupName);
    } catch (err) {
      console.error("Onboarding import failed", err);
    } finally {
      setOnboardingImporting(false);
      e.target.value = "";
    }
  };

  const completeOnboarding = () => {
    const name = onboardingName.trim() || "Researcher";
    setPrefs({ name, setupDone: true });
    setShowOnboarding(false);
  };

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("transitioning");
    if (isDark) html.classList.add("dark");
    else html.classList.remove("dark");
    const t = setTimeout(() => html.classList.remove("transitioning"), 250);
    return () => clearTimeout(t);
  }, [isDark]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPalette]);

  const greeting = getTimeGreeting(prefs.name);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex flex-col w-56 shrink-0 border-r bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-4 py-4 border-b">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">SO</div>
          <span className="font-semibold text-sm tracking-tight flex-1">ScholarOS</span>
          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>

        <div className="px-4 py-3 border-b">
          <p className="text-xs text-sidebar-foreground/70">{greeting}</p>
        </div>

        <nav className="flex flex-col gap-0.5 px-2 py-3 flex-1">
          {[
            { to: "/", icon: <LayoutDashboard size={15} />, label: "Dashboard" },
            { to: "/projects", icon: <FolderGit2 size={15} />, label: "Projects" },
            { to: "/references", icon: <BookMarked size={15} />, label: "References" },
            { to: "/venues", icon: <Building2 size={15} />, label: "Venues" },
            { to: "/submissions", icon: <Send size={15} />, label: "Submissions" },
            { to: "/people", icon: <Users size={15} />, label: "People" },
            { to: "/reports", icon: <FileText size={15} />, label: "Reports" },
            { to: "/settings", icon: <Settings size={15} />, label: "Settings" },
          ].map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors [&.active]:bg-sidebar-accent [&.active]:text-sidebar-foreground [&.active]:font-semibold [&.active]:border-l-2 [&.active]:border-primary [&.active]:pl-[10px]"
              activeProps={{ className: "active" }}
            >
              {icon} {label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-3 border-t">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs justify-between bg-sidebar-accent border-sidebar-border"
                  onClick={openPalette}
                >
                  <span className="flex items-center gap-1.5"><Command size={11} /> Quick actions</span>
                  <kbd className="text-[10px] text-sidebar-foreground/40 font-mono">⌘⇧Space</kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Open command palette (Ctrl+Shift+Space)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <CommandPalette />
      <Toaster richColors position="bottom-right" />

      {/* Onboarding Sheet — shown once for new users */}
      <Sheet open={showOnboarding} onOpenChange={() => { /* intentionally not closeable until completed */ }}>
        <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle>Welcome to ScholarOS 👋</SheetTitle>
            <SheetDescription>Let's do a quick 10-second setup before we get started.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 px-6 py-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboarding-name" className="text-sm font-medium">What's your name?</Label>
              <Input
                id="onboarding-name"
                className="h-9"
                placeholder="e.g. Alex Chen"
                value={onboardingName}
                onChange={(e) => setOnboardingName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") completeOnboarding(); }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Used in the dashboard greeting and advisor reports.</p>
            </div>
            <div className="rounded-md border border-dashed px-4 py-3 flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Have a backup? Restore it now.</p>
              <p className="text-[11px] text-muted-foreground">
                This will replace any existing data with your backup. You can also import later from Settings.
              </p>
              <input
                ref={onboardingFileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleOnboardingImport}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 self-start"
                disabled={onboardingImporting}
                onClick={() => onboardingFileRef.current?.click()}
              >
                {onboardingImporting ? <Loader2 size={13} className="animate-spin" /> : null}
                {onboardingImporting ? "Restoring…" : "Choose backup file"}
              </Button>
            </div>
          </div>
          <SheetFooter className="border-t px-6 py-4">
            <Button className="w-full" onClick={completeOnboarding}>
              Get started →
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Routes ──────────────────────────────────────────────────────
const rootRoute = createRootRoute({ component: AppFrame });
const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: DashboardPage });
const projectsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects", component: ProjectsPage });
const referencesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/references", component: ReferencesPage });
const venuesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/venues", component: VenuesPage });
const submissionsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/submissions", component: SubmissionsPage });
const peopleRoute = createRoute({ getParentRoute: () => rootRoute, path: "/people", component: PeoplePage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/reports", component: ReportsPage });
const routeTree = rootRoute.addChildren([dashboardRoute, projectsRoute, referencesRoute, venuesRoute, submissionsRoute, peopleRoute, settingsRoute, reportsRoute]);

export const router = createRouter({ routeTree });

export function AppRouterProvider(): JSX.Element {
  const routerInstance = useMemo(() => router, []);
  return <RouterProvider router={routerInstance} />;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
