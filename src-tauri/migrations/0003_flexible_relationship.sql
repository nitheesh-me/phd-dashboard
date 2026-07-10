-- Remove the fixed CHECK constraint on people.relationship to allow any text value
-- (e.g. Researcher, Other custom roles, etc.)
PRAGMA foreign_keys = OFF;

CREATE TABLE people_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  institution TEXT,
  relationship TEXT NOT NULL DEFAULT 'Researcher',
  notes TEXT,
  last_contacted TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO people_new
  SELECT id, name, email, institution, relationship, notes, last_contacted, created_at, updated_at
  FROM people;

DROP TABLE people;
ALTER TABLE people_new RENAME TO people;

PRAGMA foreign_keys = ON;
