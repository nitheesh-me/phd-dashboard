import { invoke } from "@tauri-apps/api/core";

import type {
  CreatePersonInput,
  CreateProjectInput,
  CreateReferenceInput,
  CreateSubmissionTrackerInput,
  CreateVenueInput,
  DashboardSnapshot,
  Person,
  Project,
  Reference,
  SubmissionTracker,
  UpdatePersonInput,
  UpdateProjectInput,
  UpdateReferenceInput,
  UpdateSubmissionTrackerInput,
  UpdateVenueInput,
  Venue,
} from "./types";

export const api = {
  getDashboardSnapshot: () => invoke<DashboardSnapshot>("get_dashboard_snapshot"),
  listProjects: () => invoke<Project[]>("list_projects"),
  createProject: (input: CreateProjectInput) => invoke<Project>("create_project", { input }),
  updateProject: (input: UpdateProjectInput) => invoke<Project>("update_project", { input }),
  deleteProject: (id: string) => invoke<void>("delete_project", { id }),

  listReferences: () => invoke<Reference[]>("list_references"),
  createReference: (input: CreateReferenceInput) => invoke<Reference>("create_reference", { input }),
  updateReference: (input: UpdateReferenceInput) => invoke<Reference>("update_reference", { input }),
  deleteReference: (id: string) => invoke<void>("delete_reference", { id }),

  listSubmissionTrackers: () => invoke<SubmissionTracker[]>("list_submission_trackers"),
  createSubmissionTracker: (input: CreateSubmissionTrackerInput) =>
    invoke<SubmissionTracker>("create_submission_tracker", { input }),
  updateSubmissionTracker: (input: UpdateSubmissionTrackerInput) =>
    invoke<SubmissionTracker>("update_submission_tracker", { input }),
  deleteSubmissionTracker: (id: string) => invoke<void>("delete_submission_tracker", { id }),

  listVenues: () => invoke<Venue[]>("list_venues"),
  createVenue: (input: CreateVenueInput) => invoke<Venue>("create_venue", { input }),
  updateVenue: (input: UpdateVenueInput) => invoke<Venue>("update_venue", { input }),
  deleteVenue: (id: string) => invoke<void>("delete_venue", { id }),

  listPeople: () => invoke<Person[]>("list_people"),
  createPerson: (input: CreatePersonInput) => invoke<Person>("create_person", { input }),
  updatePerson: (input: UpdatePersonInput) => invoke<Person>("update_person", { input }),
  deletePerson: (id: string) => invoke<void>("delete_person", { id }),

  clearAllData: () => invoke<void>("clear_all_data"),
  exportAllData: () => invoke<string>("export_all_data"),
  importData: (json: string, mode: "append" | "override") =>
    invoke<void>("import_data", { json, mode }),
  saveTextFile: (filename: string, content: string) =>
    invoke<string>("save_text_file", { filename, content }),
  logDeepWork: (title: string, durationMinutes: number, workType: string, projectId?: string) =>
    invoke<void>("log_deep_work", { title, durationMinutes, workType, projectId: projectId ?? null }),
};
