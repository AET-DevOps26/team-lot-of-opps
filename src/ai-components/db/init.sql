CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS invoice_embeddings (
    id SERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(384)
);

CREATE TABLE IF NOT EXISTS suggestions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    suggestion TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
