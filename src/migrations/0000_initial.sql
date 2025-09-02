-- Create users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- Create content table
CREATE TABLE content (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT,
  link TEXT,
  tags TEXT,
  content TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Create links table for sharing
CREATE TABLE links (
  userId TEXT PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX idx_content_userId ON content(userId);
CREATE INDEX idx_links_hash ON links(hash);