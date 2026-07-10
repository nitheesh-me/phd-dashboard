import type { DashboardSnapshot, Project, Reference, SubmissionTracker, Venue } from "@/lib/api/types";

export type FocusItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

export type WeeklyBoardLane = "backlog" | "this_week" | "today" | "done";

export type WeeklyBoardItem = {
  id: string;
  text: string;
  lane: WeeklyBoardLane;
  createdAt: string;
};

export type PaperMilestone = {
  id: string;
  label: string;
  done: boolean;
};

export type PaperMilestonePlan = {
  referenceId: string;
  title: string;
  milestones: PaperMilestone[];
  updatedAt: string;
};

export type AdvisorReportInput = {
  generatedAt: string;
  researcherName: string;
  snapshot: DashboardSnapshot;
  weeklyTargetHours: number;
  projects: Project[];
  references: Reference[];
  submissions: SubmissionTracker[];
  venues: Venue[];
  focusItems: FocusItem[];
  weeklyBoardItems: WeeklyBoardItem[];
  paperPlans: PaperMilestonePlan[];
  submissionWatchlist: Array<{
    id: string;
    venue: string;
    paper: string;
    status: SubmissionTracker["status"];
    daysLeft: number | null;
  }>;
};

export type ReadinessItem = {
  label: string;
  detail: string;
  done: boolean;
  route: "/projects" | "/references" | "/venues" | "/submissions";
  actionLabel: string;
};

export type UiPreferences = {
  name: string;
  density: "compact" | "comfortable";
  tone: "ocean" | "forest" | "ink";
  setupDone: boolean;
};

export const WEEKLY_BOARD_LANES: Array<{ id: WeeklyBoardLane; label: string }> = [
  { id: "backlog", label: "Backlog" },
  { id: "this_week", label: "This Week" },
  { id: "today", label: "Today" },
  { id: "done", label: "Done" },
];

export type SavedReport = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};
