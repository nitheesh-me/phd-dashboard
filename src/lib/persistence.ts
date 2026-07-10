import type {
  FocusItem,
  PaperMilestonePlan,
  SavedReport,
  UiPreferences,
  WeeklyBoardItem,
} from "@/lib/types/local";
import { clampHoursTarget } from "@/lib/format";
import type { Reference } from "@/lib/api/types";

// ── Keys ────────────────────────────────────────────────────────
const FOCUS_PLANNER_KEY = "scholaros.focus.planner";
const WEEKLY_TARGET_HOURS_KEY = "scholaros.weekly.target.hours";
const WEEKLY_BOARD_KEY = "scholaros.weekly.board";
const PAPER_MILESTONE_PLANS_KEY = "scholaros.paper.milestone.plans";
const UI_PREFERENCES_KEY = "scholaros.ui.preferences";

// ── Focus planner ────────────────────────────────────────────────
export function loadFocusPlanner(): FocusItem[] {
  try {
    const raw = window.localStorage.getItem(FOCUS_PLANNER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FocusItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item?.id === "string" && typeof item?.text === "string")
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function persistFocusPlanner(items: FocusItem[]): void {
  window.localStorage.setItem(FOCUS_PLANNER_KEY, JSON.stringify(items));
}

// ── Weekly target hours ──────────────────────────────────────────
export function loadWeeklyTargetHours(): number {
  try {
    const raw = window.localStorage.getItem(WEEKLY_TARGET_HOURS_KEY);
    if (!raw) return 20;
    return clampHoursTarget(raw);
  } catch {
    return 20;
  }
}

export function persistWeeklyTargetHours(value: number): void {
  window.localStorage.setItem(WEEKLY_TARGET_HOURS_KEY, String(clampHoursTarget(String(value))));
}

// ── Weekly board ─────────────────────────────────────────────────
export function loadWeeklyBoard(): WeeklyBoardItem[] {
  try {
    const raw = window.localStorage.getItem(WEEKLY_BOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WeeklyBoardItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        typeof item?.id === "string" &&
        typeof item?.text === "string" &&
        (item?.lane === "backlog" ||
          item?.lane === "this_week" ||
          item?.lane === "today" ||
          item?.lane === "done")
    );
  } catch {
    return [];
  }
}

export function persistWeeklyBoard(items: WeeklyBoardItem[]): void {
  window.localStorage.setItem(WEEKLY_BOARD_KEY, JSON.stringify(items));
}

// ── Paper milestone plans ────────────────────────────────────────
export function createPaperMilestonePlan(reference: Reference): PaperMilestonePlan {
  return {
    referenceId: reference.id,
    title: reference.title,
    updatedAt: new Date().toISOString(),
    milestones: [
      { id: crypto.randomUUID(), label: "Clarify core research question and novelty claim", done: false },
      { id: crypto.randomUUID(), label: "Complete baseline and ablation experiments", done: false },
      { id: crypto.randomUUID(), label: "Write methods and results sections", done: false },
      { id: crypto.randomUUID(), label: "Prepare figures, tables, and appendix", done: false },
      { id: crypto.randomUUID(), label: "Internal review pass and final edits", done: false },
      { id: crypto.randomUUID(), label: "Submission + artifact readiness check", done: false },
    ],
  };
}

export function loadPaperMilestonePlans(): PaperMilestonePlan[] {
  try {
    const raw = window.localStorage.getItem(PAPER_MILESTONE_PLANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaperMilestonePlan[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item?.referenceId === "string" && Array.isArray(item?.milestones))
      .slice(0, 200);
  } catch {
    return [];
  }
}

export function persistPaperMilestonePlans(value: PaperMilestonePlan[]): void {
  window.localStorage.setItem(PAPER_MILESTONE_PLANS_KEY, JSON.stringify(value));
}

// ── UI preferences ───────────────────────────────────────────────
export function loadUiPreferences(): UiPreferences {
  const fallback: UiPreferences = { name: "Researcher", density: "compact", tone: "ocean", setupDone: false };
  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    const density = parsed.density === "comfortable" ? "comfortable" : "compact";
    const tone = parsed.tone === "forest" || parsed.tone === "ink" ? parsed.tone : "ocean";
    const name =
      typeof parsed.name === "string" && parsed.name.trim().length > 0 ? parsed.name : fallback.name;
    const setupDone = parsed.setupDone === true;
    return { name, density, tone, setupDone };
  } catch {
    return fallback;
  }
}

export function persistUiPreferences(value: UiPreferences): void {
  window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(value));
}

// ── Saved reports ─────────────────────────────────────────────────
const SAVED_REPORTS_KEY = "scholaros.saved.reports";
const REPORT_TEMPLATE_KEY = "scholaros.report.template";

export function loadSavedReports(): SavedReport[] {
  try {
    const raw = window.localStorage.getItem(SAVED_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedReport[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => typeof r?.id === "string" && typeof r?.content === "string");
  } catch {
    return [];
  }
}

export function persistSavedReports(reports: SavedReport[]): void {
  window.localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(reports));
}

export function loadReportTemplate(): string | null {
  try {
    return window.localStorage.getItem(REPORT_TEMPLATE_KEY);
  } catch {
    return null;
  }
}

export function persistReportTemplate(template: string): void {
  window.localStorage.setItem(REPORT_TEMPLATE_KEY, template);
}

// ── Clear all local data (used by Settings Reset) ────────────────
export function clearAllLocalData(): void {
  window.localStorage.removeItem(FOCUS_PLANNER_KEY);
  window.localStorage.removeItem(WEEKLY_BOARD_KEY);
  window.localStorage.removeItem(WEEKLY_TARGET_HOURS_KEY);
  window.localStorage.removeItem(PAPER_MILESTONE_PLANS_KEY);
  window.localStorage.removeItem(SAVED_REPORTS_KEY);
  // deliberately keep UI_PREFERENCES_KEY (name, tone, density, setupDone)
}

// ── Full backup helpers ──────────────────────────────────────────

export interface LocalSnapshot {
  focusPlanner: FocusItem[];
  weeklyTargetHours: number;
  weeklyBoard: WeeklyBoardItem[];
  paperMilestonePlans: PaperMilestonePlan[];
  uiPreferences: UiPreferences;
  savedReports: SavedReport[];
  reportTemplate: string | null;
}

/** Collect all localStorage data into a plain object for export. */
export function exportLocalData(): LocalSnapshot {
  return {
    focusPlanner: loadFocusPlanner(),
    weeklyTargetHours: loadWeeklyTargetHours(),
    weeklyBoard: loadWeeklyBoard(),
    paperMilestonePlans: loadPaperMilestonePlans(),
    uiPreferences: loadUiPreferences(),
    savedReports: loadSavedReports(),
    reportTemplate: loadReportTemplate(),
  };
}

/** Restore all localStorage data from a snapshot (used during import). */
export function importLocalData(snapshot: Partial<LocalSnapshot>): void {
  if (Array.isArray(snapshot.focusPlanner)) persistFocusPlanner(snapshot.focusPlanner);
  if (typeof snapshot.weeklyTargetHours === "number") persistWeeklyTargetHours(snapshot.weeklyTargetHours);
  if (Array.isArray(snapshot.weeklyBoard)) persistWeeklyBoard(snapshot.weeklyBoard);
  if (Array.isArray(snapshot.paperMilestonePlans)) persistPaperMilestonePlans(snapshot.paperMilestonePlans);
  if (snapshot.uiPreferences && typeof snapshot.uiPreferences === "object") persistUiPreferences(snapshot.uiPreferences as UiPreferences);
  if (Array.isArray(snapshot.savedReports)) persistSavedReports(snapshot.savedReports);
  if (typeof snapshot.reportTemplate === "string") persistReportTemplate(snapshot.reportTemplate);
}

