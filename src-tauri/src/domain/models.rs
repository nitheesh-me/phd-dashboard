use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum GitStatus {
    Clean,
    Dirty,
    Unpushed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum EnvironmentType {
    Conda,
    Docker,
    Venv,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum ReadStatus {
    Unread,
    Reading,
    Read,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum VenueType {
    Conference,
    Journal,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum SubmissionStatus {
    Drafting,
    Submitted,
    Rebuttal,
    Accepted,
    Rejected,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum CodeReleaseStatus {
    NotStarted,
    InProgress,
    Released,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Relationship {
    #[serde(rename = "Advisor")]
    Advisor,
    #[serde(rename = "Co-author")]
    CoAuthor,
    #[serde(rename = "Reviewer")]
    Reviewer,
    #[serde(rename = "Researcher")]
    Researcher,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum TaskType {
    Coding,
    Writing,
    Reading,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub local_path: String,
    pub git_status: GitStatus,
    pub env_type: EnvironmentType,
    pub env_status: String,
    pub last_opened: Option<String>,
    pub associated_paper_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Reference {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub r#abstract: Option<String>,
    pub pdf_local_path: Option<String>,
    pub bibtex: Option<String>,
    pub doi: Option<String>,
    pub arxiv_id: Option<String>,
    pub read_status: ReadStatus,
    pub rating: Option<i32>,
    pub tags: Vec<String>,
    pub date_added: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Venue {
    pub id: String,
    pub name: String,
    pub acronym: String,
    pub r#type: VenueType,
    pub core_ranking: Option<String>,
    pub h5_index: Option<i32>,
    pub abstract_deadline: Option<String>,
    pub submission_deadline: Option<String>,
    pub rebuttal_date: Option<String>,
    pub notification_date: Option<String>,
    pub camera_ready_date: Option<String>,
    pub url: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SubmissionTracker {
    pub id: String,
    pub venue_id: String,
    pub paper_id: String,
    pub status: SubmissionStatus,
    pub openreview_link: Option<String>,
    pub code_release_status: CodeReleaseStatus,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteKnowledge {
    pub id: String,
    pub title: String,
    pub local_path: String,
    pub content_hash: String,
    pub last_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Person {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub institution: Option<String>,
    pub relationship: String,
    pub notes: Option<String>,
    pub last_contacted: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PomodoroTask {
    pub id: String,
    pub title: String,
    pub project_id: Option<String>,
    pub duration_minutes: i32,
    pub completed_at: Option<String>,
    pub r#type: TaskType,
}
