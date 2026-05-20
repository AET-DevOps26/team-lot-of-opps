CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS invoice_embeddings (
    id SERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(384)
);