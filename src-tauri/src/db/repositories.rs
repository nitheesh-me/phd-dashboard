use anyhow::Context;
use serde::Serialize;
use sqlx::{FromRow, SqlitePool};

use crate::domain::models::{
  CodeReleaseStatus, EnvironmentType, GitStatus, Person, Project, ReadStatus, Reference,
  SubmissionStatus, SubmissionTracker, Venue, VenueType,
};

#[derive(Debug, Serialize, FromRow)]
pub struct DashboardSnapshot {
    pub urgent_deadlines: i64,
    pub active_projects: i64,
    pub unread_papers: i64,
    pub deep_work_minutes: i64,
    pub next_deadline_name: Option<String>,
    pub next_deadline_at: Option<String>,
}

#[derive(Debug, FromRow)]
struct ProjectRow {
    id: String,
    name: String,
    local_path: String,
    git_status: String,
    env_type: String,
    env_status: String,
    last_opened: Option<String>,
    associated_paper_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct ReferenceRow {
    id: String,
    title: String,
    authors: String,
    abstract_value: Option<String>,
    pdf_local_path: Option<String>,
    bibtex: Option<String>,
    doi: Option<String>,
    arxiv_id: Option<String>,
    read_status: String,
    rating: Option<i32>,
    tags: String,
    date_added: String,
}

#[derive(Debug, FromRow)]
struct VenueRow {
    id: String,
    name: String,
    acronym: String,
    venue_type: String,
    core_ranking: Option<String>,
    h5_index: Option<i32>,
    abstract_deadline: Option<String>,
    submission_deadline: Option<String>,
    rebuttal_date: Option<String>,
    notification_date: Option<String>,
    camera_ready_date: Option<String>,
    url: Option<String>,
    version: Option<String>,
}

  #[derive(Debug, FromRow)]
  struct SubmissionTrackerRow {
    id: String,
    venue_id: String,
    paper_id: String,
    status: String,
    openreview_link: Option<String>,
    code_release_status: String,
  }

pub async fn list_projects(pool: &SqlitePool) -> anyhow::Result<Vec<Project>> {
    let rows = sqlx::query_as::<_, ProjectRow>(
        r#"
    SELECT id, name, local_path, git_status, env_type, env_status, last_opened, associated_paper_id
    FROM projects
    ORDER BY CASE WHEN last_opened IS NULL THEN 1 ELSE 0 END, datetime(last_opened) DESC, name ASC
    "#,
    )
    .fetch_all(pool)
    .await
    .context("failed to list projects")?;

    rows.into_iter().map(TryInto::try_into).collect()
}

pub async fn list_references(pool: &SqlitePool) -> anyhow::Result<Vec<Reference>> {
    let rows = sqlx::query_as::<_, ReferenceRow>(
        r#"
    SELECT
      id,
      title,
      authors,
      abstract AS abstract_value,
      pdf_local_path,
      bibtex,
      doi,
      arxiv_id,
      read_status,
      rating,
      tags,
      date_added
    FROM "references"
    ORDER BY datetime(date_added) DESC, title ASC
    "#,
    )
    .fetch_all(pool)
    .await
    .context("failed to list references")?;

    rows.into_iter().map(TryInto::try_into).collect()
}

pub async fn list_venues(pool: &SqlitePool) -> anyhow::Result<Vec<Venue>> {
    let rows = sqlx::query_as::<_, VenueRow>(
    r#"
    SELECT
      id,
      name,
      acronym,
      type AS venue_type,
      core_ranking,
      h5_index,
      abstract_deadline,
      submission_deadline,
      rebuttal_date,
      notification_date,
      camera_ready_date,
      url,
      version
    FROM venues
    ORDER BY CASE WHEN submission_deadline IS NULL THEN 1 ELSE 0 END, datetime(submission_deadline) ASC, acronym ASC
    "#,
  )
  .fetch_all(pool)
  .await
  .context("failed to list venues")?;

    rows.into_iter().map(TryInto::try_into).collect()
}

  pub async fn list_submission_trackers(pool: &SqlitePool) -> anyhow::Result<Vec<SubmissionTracker>> {
    let rows = sqlx::query_as::<_, SubmissionTrackerRow>(
      r#"
    SELECT id, venue_id, paper_id, status, openreview_link, code_release_status
    FROM submission_trackers
    ORDER BY datetime(updated_at) DESC, id ASC
    "#,
    )
    .fetch_all(pool)
    .await
    .context("failed to list submission trackers")?;

    rows.into_iter().map(TryInto::try_into).collect()
  }

pub async fn load_dashboard_snapshot(pool: &SqlitePool) -> anyhow::Result<DashboardSnapshot> {
    let snapshot = sqlx::query_as::<_, DashboardSnapshot>(
        r#"
    WITH next_deadline AS (
      SELECT acronym AS next_deadline_name, submission_deadline AS next_deadline_at
      FROM venues
      WHERE submission_deadline IS NOT NULL
      ORDER BY datetime(submission_deadline) ASC
      LIMIT 1
    )
    SELECT
      (
        SELECT COUNT(*)
        FROM venues
        WHERE submission_deadline IS NOT NULL
          AND datetime(submission_deadline) <= datetime('now', '+14 day')
      ) AS urgent_deadlines,
      (
        SELECT COUNT(*)
        FROM projects
        WHERE last_opened IS NOT NULL
          AND datetime(last_opened) >= datetime('now', '-48 hour')
      ) AS active_projects,
      (
        SELECT COUNT(*)
        FROM "references"
        WHERE read_status = 'Unread'
          AND datetime(date_added) >= datetime('now', '-7 day')
      ) AS unread_papers,
      (
        SELECT COALESCE(SUM(duration_minutes), 0)
        FROM pomodoro_tasks
        WHERE completed_at IS NOT NULL
          AND datetime(completed_at) >= datetime('now', '-7 day')
      ) AS deep_work_minutes,
      next_deadline.next_deadline_name,
      next_deadline.next_deadline_at
    FROM next_deadline
    UNION ALL
    SELECT
      (
        SELECT COUNT(*)
        FROM venues
        WHERE submission_deadline IS NOT NULL
          AND datetime(submission_deadline) <= datetime('now', '+14 day')
      ) AS urgent_deadlines,
      (
        SELECT COUNT(*)
        FROM projects
        WHERE last_opened IS NOT NULL
          AND datetime(last_opened) >= datetime('now', '-48 hour')
      ) AS active_projects,
      (
        SELECT COUNT(*)
        FROM "references"
        WHERE read_status = 'Unread'
          AND datetime(date_added) >= datetime('now', '-7 day')
      ) AS unread_papers,
      (
        SELECT COALESCE(SUM(duration_minutes), 0)
        FROM pomodoro_tasks
        WHERE completed_at IS NOT NULL
          AND datetime(completed_at) >= datetime('now', '-7 day')
      ) AS deep_work_minutes,
      NULL,
      NULL
    WHERE NOT EXISTS (SELECT 1 FROM next_deadline)
    LIMIT 1
    "#,
    )
    .fetch_one(pool)
    .await
    .context("failed to load dashboard snapshot")?;

    Ok(snapshot)
}

impl TryFrom<ProjectRow> for Project {
    type Error = anyhow::Error;

    fn try_from(value: ProjectRow) -> Result<Self, Self::Error> {
        Ok(Project {
            id: value.id,
            name: value.name,
            local_path: value.local_path,
            git_status: serde_json::from_str(&format!("\"{}\"", value.git_status))?,
            env_type: serde_json::from_str(&format!("\"{}\"", value.env_type))?,
            env_status: value.env_status,
            last_opened: value.last_opened,
            associated_paper_id: value.associated_paper_id,
        })
    }
}

impl TryFrom<ReferenceRow> for Reference {
    type Error = anyhow::Error;

    fn try_from(value: ReferenceRow) -> Result<Self, Self::Error> {
        Ok(Reference {
            id: value.id,
            title: value.title,
            authors: serde_json::from_str(&value.authors)?,
            r#abstract: value.abstract_value,
            pdf_local_path: value.pdf_local_path,
            bibtex: value.bibtex,
            doi: value.doi,
            arxiv_id: value.arxiv_id,
            read_status: serde_json::from_str(&format!("\"{}\"", value.read_status))?,
            rating: value.rating,
            tags: serde_json::from_str(&value.tags)?,
            date_added: value.date_added,
        })
    }
}

impl TryFrom<VenueRow> for Venue {
    type Error = anyhow::Error;

    fn try_from(value: VenueRow) -> Result<Self, Self::Error> {
    Ok(Venue {
            id: value.id,
            name: value.name,
            acronym: value.acronym,
            r#type: serde_json::from_str(&format!("\"{}\"", value.venue_type))?,
            core_ranking: value.core_ranking,
            h5_index: value.h5_index,
            abstract_deadline: value.abstract_deadline,
            submission_deadline: value.submission_deadline,
            rebuttal_date: value.rebuttal_date,
            notification_date: value.notification_date,
            camera_ready_date: value.camera_ready_date,
            url: value.url,
            version: value.version,
        })
    }
}

  impl TryFrom<SubmissionTrackerRow> for SubmissionTracker {
    type Error = anyhow::Error;

    fn try_from(value: SubmissionTrackerRow) -> Result<Self, Self::Error> {
      Ok(SubmissionTracker {
        id: value.id,
        venue_id: value.venue_id,
        paper_id: value.paper_id,
        status: serde_json::from_str(&format!("\"{}\"", value.status))?,
        openreview_link: value.openreview_link,
        code_release_status: serde_json::from_str(&format!("\"{}\"", value.code_release_status))?,
      })
    }
  }

  fn enum_to_text<T: Serialize>(value: T) -> anyhow::Result<String> {
    let serialized = serde_json::to_string(&value)?;
    Ok(serialized.trim_matches('"').to_string())
  }

  pub async fn create_project(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    local_path: &str,
    git_status: GitStatus,
    env_type: EnvironmentType,
    env_status: &str,
    associated_paper_id: Option<&str>,
  ) -> anyhow::Result<Project> {
    sqlx::query(
      r#"
      INSERT INTO projects (
        id, name, local_path, git_status, env_type, env_status, associated_paper_id, last_opened, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      "#,
    )
    .bind(id)
    .bind(name)
    .bind(local_path)
    .bind(enum_to_text(git_status)?)
    .bind(enum_to_text(env_type)?)
    .bind(env_status)
    .bind(associated_paper_id)
    .execute(pool)
    .await
    .context("failed to create project")?;

    let created = sqlx::query_as::<_, ProjectRow>(
      r#"
      SELECT id, name, local_path, git_status, env_type, env_status, last_opened, associated_paper_id
      FROM projects
      WHERE id = ?
      "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .context("failed to load created project")?;

    created.try_into()
  }

  pub async fn update_project(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    local_path: &str,
    git_status: GitStatus,
    env_type: EnvironmentType,
    env_status: &str,
    associated_paper_id: Option<&str>,
  ) -> anyhow::Result<Project> {
    let result = sqlx::query(
      r#"
      UPDATE projects
      SET
        name = ?,
        local_path = ?,
        git_status = ?,
        env_type = ?,
        env_status = ?,
        associated_paper_id = ?,
        last_opened = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
      "#,
    )
    .bind(name)
    .bind(local_path)
    .bind(enum_to_text(git_status)?)
    .bind(enum_to_text(env_type)?)
    .bind(env_status)
    .bind(associated_paper_id)
    .bind(id)
    .execute(pool)
    .await
    .context("failed to update project")?;

    if result.rows_affected() == 0 {
      anyhow::bail!("project not found");
    }

    let updated = sqlx::query_as::<_, ProjectRow>(
      r#"
      SELECT id, name, local_path, git_status, env_type, env_status, last_opened, associated_paper_id
      FROM projects
      WHERE id = ?
      "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .context("failed to load updated project")?;

    updated.try_into()
  }

  pub async fn delete_project(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
    let result = sqlx::query(
      r#"
      DELETE FROM projects
      WHERE id = ?
      "#,
    )
    .bind(id)
    .execute(pool)
    .await
    .context("failed to delete project")?;

    if result.rows_affected() == 0 {
      anyhow::bail!("project not found");
    }

    Ok(())
  }

  pub async fn create_reference(
    pool: &SqlitePool,
    id: &str,
    title: &str,
    authors: &[String],
    abstract_text: Option<&str>,
    doi: Option<&str>,
    arxiv_id: Option<&str>,
    tags: &[String],
    read_status: ReadStatus,
  ) -> anyhow::Result<Reference> {
    let authors_json = serde_json::to_string(authors)?;
    let tags_json = serde_json::to_string(tags)?;

    sqlx::query(
      r#"
      INSERT INTO "references" (
        id, title, authors, abstract, doi, arxiv_id, tags, read_status, date_added, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      "#,
    )
    .bind(id)
    .bind(title)
    .bind(authors_json)
    .bind(abstract_text)
    .bind(doi)
    .bind(arxiv_id)
    .bind(tags_json)
    .bind(enum_to_text(read_status)?)
    .execute(pool)
    .await
    .context("failed to create reference")?;

    let created = sqlx::query_as::<_, ReferenceRow>(
      r#"
      SELECT
        id,
        title,
        authors,
        abstract AS abstract_value,
        pdf_local_path,
        bibtex,
        doi,
        arxiv_id,
        read_status,
        rating,
        tags,
        date_added
      FROM "references"
      WHERE id = ?
      "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .context("failed to load created reference")?;

    created.try_into()
  }

  pub async fn update_reference(
    pool: &SqlitePool,
    id: &str,
    title: &str,
    authors: &[String],
    abstract_text: Option<&str>,
    doi: Option<&str>,
    arxiv_id: Option<&str>,
    tags: &[String],
    read_status: ReadStatus,
    rating: Option<i32>,
  ) -> anyhow::Result<Reference> {
    let authors_json = serde_json::to_string(authors)?;
    let tags_json = serde_json::to_string(tags)?;

    let result = sqlx::query(
      r#"
      UPDATE "references"
      SET
        title = ?,
        authors = ?,
        abstract = ?,
        doi = ?,
        arxiv_id = ?,
        tags = ?,
        read_status = ?,
        rating = ?,
        updated_at = datetime('now')
      WHERE id = ?
      "#,
    )
    .bind(title)
    .bind(authors_json)
    .bind(abstract_text)
    .bind(doi)
    .bind(arxiv_id)
    .bind(tags_json)
    .bind(enum_to_text(read_status)?)
    .bind(rating)
    .bind(id)
    .execute(pool)
    .await
    .context("failed to update reference")?;

    if result.rows_affected() == 0 {
      anyhow::bail!("reference not found");
    }

    let updated = sqlx::query_as::<_, ReferenceRow>(
      r#"
      SELECT
        id,
        title,
        authors,
        abstract AS abstract_value,
        pdf_local_path,
        bibtex,
        doi,
        arxiv_id,
        read_status,
        rating,
        tags,
        date_added
      FROM "references"
      WHERE id = ?
      "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .context("failed to load updated reference")?;

    updated.try_into()
  }

  pub async fn delete_reference(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
    let result = sqlx::query(
      r#"
      DELETE FROM "references"
      WHERE id = ?
      "#,
    )
    .bind(id)
    .execute(pool)
    .await
    .context("failed to delete reference")?;

    if result.rows_affected() == 0 {
      anyhow::bail!("reference not found");
    }

    Ok(())
  }

  pub async fn create_venue(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    acronym: &str,
    venue_type: VenueType,
    submission_deadline: Option<&str>,
    abstract_deadline: Option<&str>,
    url: Option<&str>,
    version: Option<&str>,
  ) -> anyhow::Result<Venue> {
    sqlx::query(
      r#"
      INSERT INTO venues (
        id, name, acronym, type, submission_deadline, abstract_deadline, url, version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      "#,
    )
    .bind(id)
    .bind(name)
    .bind(acronym)
    .bind(enum_to_text(venue_type)?)
    .bind(submission_deadline)
    .bind(abstract_deadline)
    .bind(url)
    .bind(version)
    .execute(pool)
    .await
    .context("failed to create venue")?;

    let created = sqlx::query_as::<_, VenueRow>(
      r#"
      SELECT
        id,
        name,
        acronym,
        type AS venue_type,
        core_ranking,
        h5_index,
        abstract_deadline,
        submission_deadline,
        rebuttal_date,
        notification_date,
        camera_ready_date,
        url,
        version
      FROM venues
      WHERE id = ?
      "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .context("failed to load created venue")?;

    created.try_into()
  }

  pub async fn update_venue(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    acronym: &str,
    venue_type: VenueType,
    submission_deadline: Option<&str>,
    abstract_deadline: Option<&str>,
    url: Option<&str>,
    version: Option<&str>,
  ) -> anyhow::Result<Venue> {
    let result = sqlx::query(
      r#"
      UPDATE venues
      SET
        name = ?,
        acronym = ?,
        type = ?,
        submission_deadline = ?,
        abstract_deadline = ?,
        url = ?,
        version = ?,
        updated_at = datetime('now')
      WHERE id = ?
      "#,
    )
    .bind(name)
    .bind(acronym)
    .bind(enum_to_text(venue_type)?)
    .bind(submission_deadline)
    .bind(abstract_deadline)
    .bind(url)
    .bind(version)
    .bind(id)
    .execute(pool)
    .await
    .context("failed to update venue")?;

    if result.rows_affected() == 0 {
      anyhow::bail!("venue not found");
    }

    let updated = sqlx::query_as::<_, VenueRow>(
      r#"
      SELECT
        id,
        name,
        acronym,
        type AS venue_type,
        core_ranking,
        h5_index,
        abstract_deadline,
        submission_deadline,
        rebuttal_date,
        notification_date,
        camera_ready_date,
        url,
        version
      FROM venues
      WHERE id = ?
      "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .context("failed to load updated venue")?;

    updated.try_into()
  }

  pub async fn delete_venue(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
    let result = sqlx::query(
      r#"
      DELETE FROM venues
      WHERE id = ?
      "#,
    )
    .bind(id)
    .execute(pool)
    .await
    .context("failed to delete venue")?;

    if result.rows_affected() == 0 {
      anyhow::bail!("venue not found");
    }

    Ok(())
  }

  pub async fn create_submission_tracker(
    pool: &SqlitePool,
    id: &str,
    venue_id: &str,
    paper_id: &str,
    status: SubmissionStatus,
    openreview_link: Option<&str>,
    code_release_status: CodeReleaseStatus,
  ) -> anyhow::Result<SubmissionTracker> {
    sqlx::query(
      r#"
      INSERT INTO submission_trackers (
        id, venue_id, paper_id, status, openreview_link, code_release_status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      "#,
    )
    .bind(id)
    .bind(venue_id)
    .bind(paper_id)
    .bind(enum_to_text(status)?)
    .bind(openreview_link)
    .bind(enum_to_text(code_release_status)?)
    .execute(pool)
    .await
    .context("failed to create submission tracker")?;

    let created = sqlx::query_as::<_, SubmissionTrackerRow>(
      r#"
      SELECT id, venue_id, paper_id, status, openreview_link, code_release_status
      FROM submission_trackers
      WHERE id = ?
      "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .context("failed to load created submission tracker")?;

    created.try_into()
  }

  pub async fn update_submission_tracker(
    pool: &SqlitePool,
    id: &str,
    venue_id: &str,
    paper_id: &str,
    status: SubmissionStatus,
    openreview_link: Option<&str>,
    code_release_status: CodeReleaseStatus,
  ) -> anyhow::Result<SubmissionTracker> {
    let result = sqlx::query(
      r#"
      UPDATE submission_trackers
      SET
        venue_id = ?,
        paper_id = ?,
        status = ?,
        openreview_link = ?,
        code_release_status = ?,
        updated_at = datetime('now')
      WHERE id = ?
      "#,
    )
    .bind(venue_id)
    .bind(paper_id)
    .bind(enum_to_text(status)?)
    .bind(openreview_link)
    .bind(enum_to_text(code_release_status)?)
    .bind(id)
    .execute(pool)
    .await
    .context("failed to update submission tracker")?;

    if result.rows_affected() == 0 {
      anyhow::bail!("submission tracker not found");
    }

    let updated = sqlx::query_as::<_, SubmissionTrackerRow>(
      r#"
      SELECT id, venue_id, paper_id, status, openreview_link, code_release_status
      FROM submission_trackers
      WHERE id = ?
      "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .context("failed to load updated submission tracker")?;

    updated.try_into()
  }

  pub async fn delete_submission_tracker(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
    let result = sqlx::query(
      r#"
      DELETE FROM submission_trackers
      WHERE id = ?
      "#,
    )
    .bind(id)
    .execute(pool)
    .await
    .context("failed to delete submission tracker")?;

    if result.rows_affected() == 0 {
      anyhow::bail!("submission tracker not found");
    }

    Ok(())
  }

  pub async fn clear_all_data(pool: &SqlitePool) -> anyhow::Result<()> {
    let mut tx = pool.begin().await.context("failed to begin clear-data transaction")?;

    sqlx::query("DELETE FROM submission_trackers")
      .execute(&mut *tx)
      .await
      .context("failed to clear submission_trackers")?;

    sqlx::query("DELETE FROM pomodoro_tasks")
      .execute(&mut *tx)
      .await
      .context("failed to clear pomodoro_tasks")?;

    sqlx::query("DELETE FROM note_contents")
      .execute(&mut *tx)
      .await
      .context("failed to clear note_contents")?;

    sqlx::query("DELETE FROM notes")
      .execute(&mut *tx)
      .await
      .context("failed to clear notes")?;

    sqlx::query("DELETE FROM people")
      .execute(&mut *tx)
      .await
      .context("failed to clear people")?;

    sqlx::query("DELETE FROM projects")
      .execute(&mut *tx)
      .await
      .context("failed to clear projects")?;

    sqlx::query("DELETE FROM venues")
      .execute(&mut *tx)
      .await
      .context("failed to clear venues")?;

    sqlx::query("DELETE FROM \"references\"")
      .execute(&mut *tx)
      .await
      .context("failed to clear references")?;

    tx.commit().await.context("failed to commit clear-data transaction")?;
    Ok(())
  }

// ── People ───────────────────────────────────────────────────────────────────

#[derive(Debug, FromRow)]
struct PersonRow {
  id: String,
  name: String,
  email: Option<String>,
  institution: Option<String>,
  relationship: String,
  notes: Option<String>,
  last_contacted: Option<String>,
}

impl TryFrom<PersonRow> for Person {
  type Error = anyhow::Error;
  fn try_from(value: PersonRow) -> Result<Self, Self::Error> {
    Ok(Person {
      id: value.id,
      name: value.name,
      email: value.email,
      institution: value.institution,
      relationship: serde_json::from_str(&format!("\"{}\"", value.relationship))?,
      notes: value.notes,
      last_contacted: value.last_contacted,
    })
  }
}

pub async fn list_people(pool: &SqlitePool) -> anyhow::Result<Vec<Person>> {
  let rows = sqlx::query_as::<_, PersonRow>(
    r#"
    SELECT id, name, email, institution, relationship, notes, last_contacted
    FROM people
    ORDER BY name ASC
    "#,
  )
  .fetch_all(pool)
  .await
  .context("failed to list people")?;
  rows.into_iter().map(TryInto::try_into).collect()
}

pub async fn create_person(
  pool: &SqlitePool,
  id: &str,
  name: &str,
  email: Option<&str>,
  institution: Option<&str>,
  relationship: &str,
  notes: Option<&str>,
  last_contacted: Option<&str>,
) -> anyhow::Result<Person> {
  sqlx::query(
    r#"
    INSERT INTO people (id, name, email, institution, relationship, notes, last_contacted, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    "#,
  )
  .bind(id)
  .bind(name)
  .bind(email)
  .bind(institution)
  .bind(relationship)
  .bind(notes)
  .bind(last_contacted)
  .execute(pool)
  .await
  .context("failed to create person")?;

  let created = sqlx::query_as::<_, PersonRow>(
    r#"SELECT id, name, email, institution, relationship, notes, last_contacted FROM people WHERE id = ?"#,
  )
  .bind(id)
  .fetch_one(pool)
  .await
  .context("failed to load created person")?;
  created.try_into()
}

pub async fn update_person(
  pool: &SqlitePool,
  id: &str,
  name: &str,
  email: Option<&str>,
  institution: Option<&str>,
  relationship: &str,
  notes: Option<&str>,
  last_contacted: Option<&str>,
) -> anyhow::Result<Person> {
  let result = sqlx::query(
    r#"
    UPDATE people
    SET name = ?, email = ?, institution = ?, relationship = ?, notes = ?, last_contacted = ?, updated_at = datetime('now')
    WHERE id = ?
    "#,
  )
  .bind(name)
  .bind(email)
  .bind(institution)
  .bind(relationship)
  .bind(notes)
  .bind(last_contacted)
  .bind(id)
  .execute(pool)
  .await
  .context("failed to update person")?;

  if result.rows_affected() == 0 {
    anyhow::bail!("person not found");
  }
  let updated = sqlx::query_as::<_, PersonRow>(
    r#"SELECT id, name, email, institution, relationship, notes, last_contacted FROM people WHERE id = ?"#,
  )
  .bind(id)
  .fetch_one(pool)
  .await
  .context("failed to load updated person")?;
  updated.try_into()
}

pub async fn delete_person(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
  let result = sqlx::query("DELETE FROM people WHERE id = ?")
    .bind(id)
    .execute(pool)
    .await
    .context("failed to delete person")?;
  if result.rows_affected() == 0 {
    anyhow::bail!("person not found");
  }
  Ok(())
}

// ── Import bundle ────────────────────────────────────────────────────────────

pub async fn import_bundle(
  pool: &SqlitePool,
  projects: Vec<crate::domain::models::Project>,
  references: Vec<crate::domain::models::Reference>,
  venues: Vec<crate::domain::models::Venue>,
  submissions: Vec<crate::domain::models::SubmissionTracker>,
  people: Vec<crate::domain::models::Person>,
) -> anyhow::Result<()> {
  let mut tx = pool.begin().await.context("failed to begin import transaction")?;

  for r in &references {
    sqlx::query(
      r#"INSERT OR IGNORE INTO "references"
         (id, title, authors, abstract, pdf_local_path, bibtex, doi, arxiv_id, read_status, rating, tags, date_added, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"#,
    )
    .bind(&r.id).bind(&r.title)
    .bind(serde_json::to_string(&r.authors).unwrap_or_default())
    .bind(&r.r#abstract).bind(&r.pdf_local_path).bind(&r.bibtex)
    .bind(&r.doi).bind(&r.arxiv_id)
    .bind(enum_to_text(r.read_status)?)
    .bind(r.rating)
    .bind(serde_json::to_string(&r.tags).unwrap_or_default())
    .bind(&r.date_added)
    .execute(&mut *tx).await.context("failed to import reference")?;
  }

  for v in &venues {
    sqlx::query(
      r#"INSERT OR IGNORE INTO venues
         (id, name, acronym, type, core_ranking, h5_index, abstract_deadline, submission_deadline,
          rebuttal_date, notification_date, camera_ready_date, url, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"#,
    )
    .bind(&v.id).bind(&v.name).bind(&v.acronym)
    .bind(enum_to_text(v.r#type)?)
    .bind(&v.core_ranking).bind(v.h5_index)
    .bind(&v.abstract_deadline).bind(&v.submission_deadline)
    .bind(&v.rebuttal_date).bind(&v.notification_date)
    .bind(&v.camera_ready_date).bind(&v.url).bind(&v.version)
    .execute(&mut *tx).await.context("failed to import venue")?;
  }

  for p in &projects {
    sqlx::query(
      r#"INSERT OR IGNORE INTO projects
         (id, name, local_path, git_status, env_type, env_status, associated_paper_id, last_opened, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"#,
    )
    .bind(&p.id).bind(&p.name).bind(&p.local_path)
    .bind(enum_to_text(p.git_status)?)
    .bind(enum_to_text(p.env_type)?)
    .bind(&p.env_status).bind(&p.associated_paper_id).bind(&p.last_opened)
    .execute(&mut *tx).await.context("failed to import project")?;
  }

  for s in &submissions {
    sqlx::query(
      r#"INSERT OR IGNORE INTO submission_trackers
         (id, venue_id, paper_id, status, openreview_link, code_release_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"#,
    )
    .bind(&s.id).bind(&s.venue_id).bind(&s.paper_id)
    .bind(enum_to_text(s.status)?)
    .bind(&s.openreview_link)
    .bind(enum_to_text(s.code_release_status)?)
    .execute(&mut *tx).await.context("failed to import submission")?;
  }

  for person in &people {
    sqlx::query(
      r#"INSERT OR IGNORE INTO people
         (id, name, email, institution, relationship, notes, last_contacted, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"#,
    )
    .bind(&person.id).bind(&person.name).bind(&person.email)
    .bind(&person.institution)
    .bind(&person.relationship)
    .bind(&person.notes).bind(&person.last_contacted)
    .execute(&mut *tx).await.context("failed to import person")?;
  }

  tx.commit().await.context("failed to commit import transaction")
}

// ── Pomodoro tasks ───────────────────────────────────────────────────────────

pub async fn create_pomodoro_task(
  pool: &SqlitePool,
  id: &str,
  title: &str,
  duration_minutes: i32,
  task_type: &str,
  project_id: Option<&str>,
) -> anyhow::Result<()> {
  sqlx::query(
    r#"INSERT INTO pomodoro_tasks (id, title, duration_minutes, type, project_id, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))"#,
  )
  .bind(id)
  .bind(title)
  .bind(duration_minutes)
  .bind(task_type)
  .bind(project_id)
  .execute(pool)
  .await
  .context("failed to create pomodoro task")?;
  Ok(())
}
