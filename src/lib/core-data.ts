import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/tauri-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  CreatePersonInput,
  CreateProjectInput,
  CreateReferenceInput,
  CreateSubmissionTrackerInput,
  CreateVenueInput,
  DashboardSnapshot,
} from "@/lib/api/types";

export function useCoreData() {
  const queryClient = useQueryClient();
  const peopleQuery = useQuery({ queryKey: queryKeys.people, queryFn: api.listPeople });
  const snapshotQuery = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.getDashboardSnapshot });
  const projectsQuery = useQuery({ queryKey: queryKeys.projects, queryFn: api.listProjects });
  const referencesQuery = useQuery({ queryKey: queryKeys.references, queryFn: api.listReferences });
  const submissionsQuery = useQuery({ queryKey: queryKeys.submissions, queryFn: api.listSubmissionTrackers });
  const venuesQuery = useQuery({ queryKey: queryKeys.venues, queryFn: api.listVenues });

  const invalidateCore = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.people }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
      queryClient.invalidateQueries({ queryKey: queryKeys.references }),
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.venues }),
    ]);
  };

  return { snapshotQuery, peopleQuery, projectsQuery, referencesQuery, submissionsQuery, venuesQuery, invalidateCore };
}

export function useClearAll() {
  const { invalidateCore } = useCoreData();
  return useMutation({ mutationFn: api.clearAllData, onSuccess: invalidateCore });
}

export function defaultSnapshot(): DashboardSnapshot {
  return {
    urgent_deadlines: 0,
    active_projects: 0,
    unread_papers: 0,
    deep_work_minutes: 0,
    next_deadline_name: null,
    next_deadline_at: null,
  };
}

export function emptyProjectForm(): CreateProjectInput {
  return { name: "", local_path: "", git_status: "Clean", env_type: "Venv", env_status: "", associated_paper_id: null };
}

export function emptyReferenceForm(): CreateReferenceInput {
  return { title: "", authors: [], abstract_text: null, doi: null, arxiv_id: null, tags: [], read_status: "Unread" };
}

export function emptyVenueForm(): CreateVenueInput {
  return { name: "", acronym: "", venue_type: "Conference", submission_deadline: null, abstract_deadline: null, url: null, version: null };
}

export function emptySubmissionForm(): CreateSubmissionTrackerInput {
  return { venue_id: "", paper_id: "", status: "Drafting", openreview_link: null, code_release_status: "NotStarted" };
}

export function emptyPersonForm(): CreatePersonInput {
  return { name: "", email: null, institution: null, relationship: "Researcher", notes: null, last_contacted: null };
}
