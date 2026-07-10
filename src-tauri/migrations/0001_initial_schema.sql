PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "references" (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT NOT NULL CHECK (json_valid(authors) AND json_type(authors) = 'array'),
  abstract TEXT,
  pdf_local_path TEXT,
  bibtex TEXT,
  doi TEXT UNIQUE,
  arxiv_id TEXT UNIQUE,
  read_status TEXT NOT NULL DEFAULT 'Unread' CHECK (read_status IN ('Unread', 'Reading', 'Read')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags) AND json_type(tags) = 'array'),
  citation_count INTEGER NOT NULL DEFAULT 0,
  date_added TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  local_path TEXT NOT NULL UNIQUE,
  git_status TEXT NOT NULL DEFAULT 'Clean' CHECK (git_status IN ('Clean', 'Dirty', 'Unpushed')),
  env_type TEXT NOT NULL DEFAULT 'Venv' CHECK (env_type IN ('Conda', 'Docker', 'Venv')),
  env_status TEXT NOT NULL DEFAULT 'Unknown',
  overleaf_url TEXT,
  local_latex_path TEXT,
  last_opened TEXT,
  associated_paper_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (associated_paper_id) REFERENCES "references"(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  acronym TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Conference', 'Journal')),
  core_ranking TEXT,
  h5_index INTEGER,
  abstract_deadline TEXT,
  submission_deadline TEXT,
  rebuttal_date TEXT,
  notification_date TEXT,
  camera_ready_date TEXT,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submission_trackers (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  paper_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Drafting', 'Submitted', 'Rebuttal', 'Accepted', 'Rejected')),
  openreview_link TEXT,
  code_release_status TEXT NOT NULL DEFAULT 'NotStarted' CHECK (code_release_status IN ('NotStarted', 'InProgress', 'Released')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (paper_id) REFERENCES "references"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (venue_id, paper_id)
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  local_path TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  last_modified TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS note_contents (
  note_id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  institution TEXT,
  relationship TEXT NOT NULL CHECK (relationship IN ('Advisor', 'Co-author', 'Reviewer')),
  notes TEXT,
  last_contacted TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pomodoro_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  project_id TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  completed_at TEXT,
  type TEXT NOT NULL CHECK (type IN ('Coding', 'Writing', 'Reading')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects(last_opened);
CREATE INDEX IF NOT EXISTS idx_projects_git_status ON projects(git_status);
CREATE INDEX IF NOT EXISTS idx_references_date_added ON "references"(date_added);
CREATE INDEX IF NOT EXISTS idx_references_read_status ON "references"(read_status);
CREATE INDEX IF NOT EXISTS idx_venues_submission_deadline ON venues(submission_deadline);
CREATE INDEX IF NOT EXISTS idx_venues_abstract_deadline ON venues(abstract_deadline);
CREATE INDEX IF NOT EXISTS idx_submission_trackers_status ON submission_trackers(status);
CREATE INDEX IF NOT EXISTS idx_submission_trackers_venue_id ON submission_trackers(venue_id);
CREATE INDEX IF NOT EXISTS idx_submission_trackers_paper_id ON submission_trackers(paper_id);
CREATE INDEX IF NOT EXISTS idx_notes_last_modified ON notes(last_modified);
CREATE INDEX IF NOT EXISTS idx_people_last_contacted ON people(last_contacted);
CREATE INDEX IF NOT EXISTS idx_pomodoro_tasks_project_id ON pomodoro_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_tasks_completed_at ON pomodoro_tasks(completed_at);

CREATE VIRTUAL TABLE IF NOT EXISTS references_fts USING fts5(
  reference_id UNINDEXED,
  title,
  abstract,
  authors,
  tags,
  tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS references_ai AFTER INSERT ON "references" BEGIN
  INSERT INTO references_fts(reference_id, title, abstract, authors, tags)
  VALUES (new.id, new.title, coalesce(new.abstract, ''), new.authors, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS references_ad AFTER DELETE ON "references" BEGIN
  DELETE FROM references_fts WHERE reference_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS references_au AFTER UPDATE ON "references" BEGIN
  DELETE FROM references_fts WHERE reference_id = old.id;
  INSERT INTO references_fts(reference_id, title, abstract, authors, tags)
  VALUES (new.id, new.title, coalesce(new.abstract, ''), new.authors, new.tags);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  note_id UNINDEXED,
  title,
  content,
  tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(note_id, title, content)
  VALUES (
    new.id,
    new.title,
    coalesce((SELECT content FROM note_contents WHERE note_id = new.id), '')
  );
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  DELETE FROM notes_fts WHERE note_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  DELETE FROM notes_fts WHERE note_id = old.id;
  INSERT INTO notes_fts(note_id, title, content)
  VALUES (
    new.id,
    new.title,
    coalesce((SELECT content FROM note_contents WHERE note_id = new.id), '')
  );
END;

CREATE TRIGGER IF NOT EXISTS note_contents_ai AFTER INSERT ON note_contents BEGIN
  DELETE FROM notes_fts WHERE note_id = new.note_id;
  INSERT INTO notes_fts(note_id, title, content)
  VALUES (
    new.note_id,
    coalesce((SELECT title FROM notes WHERE id = new.note_id), ''),
    new.content
  );
END;

CREATE TRIGGER IF NOT EXISTS note_contents_au AFTER UPDATE ON note_contents BEGIN
  DELETE FROM notes_fts WHERE note_id = new.note_id;
  INSERT INTO notes_fts(note_id, title, content)
  VALUES (
    new.note_id,
    coalesce((SELECT title FROM notes WHERE id = new.note_id), ''),
    new.content
  );
END;

CREATE TRIGGER IF NOT EXISTS note_contents_ad AFTER DELETE ON note_contents BEGIN
  DELETE FROM notes_fts WHERE note_id = old.note_id;
END;
