export type GitStatus = "Clean" | "Dirty" | "Unpushed";
export type EnvironmentType = "Conda" | "Docker" | "Venv";
export type ReadStatus = "Unread" | "Reading" | "Read";
export type VenueType = "Conference" | "Journal";
export type SubmissionStatus = "Drafting" | "Submitted" | "Rebuttal" | "Accepted" | "Rejected";
export type CodeReleaseStatus = "NotStarted" | "InProgress" | "Released";
export type Relationship = "Advisor" | "Co-author" | "Reviewer" | "Researcher" | (string & {});
export type TaskType = "Coding" | "Writing" | "Reading";

export interface Project {
  id: string;
  name: string;
  local_path: string;
  git_status: GitStatus;
  env_type: EnvironmentType;
  env_status: string;
  last_opened: string | null;
  associated_paper_id: string | null;
}

export interface Reference {
  id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  pdf_local_path: string | null;
  bibtex: string | null;
  doi: string | null;
  arxiv_id: string | null;
  read_status: ReadStatus;
  rating: number | null;
  tags: string[];
  date_added: string;
}

export interface Venue {
  id: string;
  name: string;
  acronym: string;
  type: VenueType;
  core_ranking: string | null;
  h5_index: number | null;
  abstract_deadline: string | null;
  submission_deadline: string | null;
  rebuttal_date: string | null;
  notification_date: string | null;
  camera_ready_date: string | null;
  url: string | null;
  version: string | null;
}

export interface SubmissionTracker {
  id: string;
  venue_id: string;
  paper_id: string;
  status: SubmissionStatus;
  openreview_link: string | null;
  code_release_status: CodeReleaseStatus;
}

export interface NoteKnowledge {
  id: string;
  title: string;
  local_path: string;
  content_hash: string;
  last_modified: string;
}

export interface Person {
  id: string;
  name: string;
  email: string | null;
  institution: string | null;
  relationship: string;
  notes: string | null;
  last_contacted: string | null;
}

export interface PomodoroTask {
  id: string;
  title: string;
  project_id: string | null;
  duration_minutes: number;
  completed_at: string | null;
  type: TaskType;
}

export interface DashboardSnapshot {
  urgent_deadlines: number;
  active_projects: number;
  unread_papers: number;
  deep_work_minutes: number;
  next_deadline_name: string | null;
  next_deadline_at: string | null;
}

export interface CreateProjectInput {
  name: string;
  local_path: string;
  git_status: GitStatus;
  env_type: EnvironmentType;
  env_status: string;
  associated_paper_id: string | null;
}

export interface UpdateProjectInput extends CreateProjectInput {
  id: string;
}

export interface CreateReferenceInput {
  title: string;
  authors: string[];
  abstract_text: string | null;
  doi: string | null;
  arxiv_id: string | null;
  tags: string[];
  read_status: ReadStatus;
}

export interface UpdateReferenceInput extends CreateReferenceInput {
  id: string;
  rating: number | null;
}

export interface CreateVenueInput {
  name: string;
  acronym: string;
  venue_type: VenueType;
  submission_deadline: string | null;
  abstract_deadline: string | null;
  url: string | null;
  version: string | null;
}

export interface UpdateVenueInput extends CreateVenueInput {
  id: string;
}

export interface CreatePersonInput {
  name: string;
  email: string | null;
  institution: string | null;
  relationship: string;
  notes: string | null;
  last_contacted: string | null;
}

export interface UpdatePersonInput extends CreatePersonInput {
  id: string;
}

export interface CreateSubmissionTrackerInput {
  venue_id: string;
  paper_id: string;
  status: SubmissionStatus;
  openreview_link: string | null;
  code_release_status: CodeReleaseStatus;
}

export interface UpdateSubmissionTrackerInput extends CreateSubmissionTrackerInput {
  id: string;
}

export interface DeleteEntityInput {
  id: string;
}
