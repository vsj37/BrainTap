-- BrainTap cloud schema (Cloudflare D1 / SQLite). Safe to run more than once.
CREATE TABLE IF NOT EXISTS players (
  id        TEXT PRIMARY KEY,
  username  TEXT NOT NULL,
  key_hash  TEXT NOT NULL,
  created   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS results (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day       TEXT NOT NULL,
  scores    TEXT NOT NULL,
  maxes     TEXT NOT NULL,
  targets   TEXT NOT NULL DEFAULT '[]',
  total     INTEGER NOT NULL,
  PRIMARY KEY (player_id, day)
);
CREATE TABLE IF NOT EXISTS groups (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  owner_id  TEXT NOT NULL,
  code      TEXT NOT NULL UNIQUE,
  created   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined    TEXT NOT NULL,
  PRIMARY KEY (group_id, player_id)
);
CREATE INDEX IF NOT EXISTS members_player ON members(player_id);
CREATE INDEX IF NOT EXISTS results_day ON results(day);
