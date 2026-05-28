import os
import psycopg2
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
DB_URL = os.getenv("DATABASE_URL")

def chunk_text(text: str, chunk_size: int = 500) -> list[str]:
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunks.append(text[i:i+chunk_size])
    return chunks

def store_embeddings(invoice_id: int, text: str):
    chunks  = chunk_text(text)
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    for chunk in chunks:
        embedding = model.encode(chunk).tolist()
        cur.execute(
            "INSERT INTO invoice_embeddings (invoice_id, chunk_text, embedding) VALUES (%s, %s, %s)",
            (invoice_id, chunk, embedding)

        )
    conn.commit()
    cur.close()
    conn.close()

def search_embeddings(query: str, limit: int=5, user_id: str=None) -> list[str]:
    query_embedding = model.encode(query).tolist()
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    if user_id:
        cur.execute(
            "SELECT ie.chunk_text " 
            "FROM invoice_embeddings ie " 
            "JOIN invoices i ON ie.invoice_id = i.id "
            "WHERE i.user_id = %s "
            "ORDER BY embedding <-> %s::vector LIMIT %s",
            (user_id,query_embedding, limit)
        )
    else:
        cur.execute(
            "SELECT chunk_text " 
            "FROM invoice_embeddings " 
            "ORDER BY embedding <-> %s::vector LIMIT %s",
            (query_embedding, limit)
        )       
    results = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return results

def get_all_chunks_for_user(user_id: str) -> list[str]:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        "SELECT ie.chunk_text "
        "FROM invoice_embeddings ie "
        "JOIN invoices i ON ie.invoice_id = i.id "
        "WHERE i.user_id = %s",
        (user_id,)
    )
    results = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return results    

def update_embeddings(invoice_id: int, text:str):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM invoice_embeddings WHERE invoice_id = %s",
        (invoice_id,)
    )
    store_embeddings(invoice_id, text)
    conn.commit()
    cur.close()
    conn.close()

def delete_embeddings(invoice_id: int):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM invoice_embeddings WHERE invoice_id = %s",
        (invoice_id,)
    )
    conn.commit()
    cur.close()
    conn.close()
