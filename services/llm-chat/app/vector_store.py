import os
import asyncio
import asyncpg
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_postgres import PGEngine, PGVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from sqlalchemy.exc import ProgrammingError

DATABASE_URL = os.getenv("DATABASE_URL")
TABLE_NAME = "langchain_invoice_embeddings"
VECTOR_SIZE = 384  # sentence-transformers/all-MiniLM-L6-v2
SCHEMA_NAME = "llm_chat"


def _asyncpg_url(url: str) -> str:
    return url.replace("postgresql://", "postgresql+asyncpg://", 1)


_embeddings: FastEmbedEmbeddings | None = None
_engine: PGEngine | None = None
_vectorstore: PGVectorStore | None = None
_init_lock = asyncio.Lock()

_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50, add_start_index=True)


def chunk_text(text: str, invoice_id: int, user_id: str, **metadata) -> list[Document]:
    splits = _splitter.create_documents([text])
    for doc in splits:
        doc.metadata["invoice_id"] = invoice_id
        doc.metadata["user_id"] = user_id
        for key, value in metadata.items():
            if value is not None:
                doc.metadata[key] = value
    return splits


def get_embeddings() -> FastEmbedEmbeddings:
    global _embeddings
    if _embeddings is None:
        # ONNX runtime (fastembed) instead of PyTorch: same all-MiniLM-L6-v2 model
        # and 384-dim output, but a fraction of the memory footprint.
        _embeddings = FastEmbedEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return _embeddings


async def get_vectorstore() -> PGVectorStore:
    global _engine, _vectorstore
    if DATABASE_URL is None:
        raise RuntimeError("DATABASE_URL environment variable is required")
    async with _init_lock:
        if _vectorstore is not None:
            return _vectorstore
        _ext_conn = await asyncpg.connect(DATABASE_URL)
        try:
            await _ext_conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        finally:
            await _ext_conn.close()

        _engine = PGEngine.from_connection_string(
            url=_asyncpg_url(DATABASE_URL),
            connect_args={"server_settings": {"search_path": f"{SCHEMA_NAME}, public"}},
        )
        try:
            await _engine.ainit_vectorstore_table(
                table_name=TABLE_NAME,
                vector_size=VECTOR_SIZE,
                schema_name=SCHEMA_NAME,
                overwrite_existing=False,
            )
        except ProgrammingError as e:
            if "already exists" not in str(e):
                raise
        _vectorstore = await PGVectorStore.create(
            engine=_engine,
            table_name=TABLE_NAME,
            embedding_service=get_embeddings(),
            schema_name=SCHEMA_NAME,
        )
    return _vectorstore


async def store_embeddings(
    invoice_id: int,
    text: str,
    user_id: str,
    item_name: str | None = None,
    company: str | None = None,
    price: float | None = None,
    category: str | None = None,
    invoice_date: str | None = None,
    document_id: int | None = None,
) -> None:
    vs = await get_vectorstore()
    await vs.aadd_documents(
        chunk_text(
            text,
            invoice_id,
            user_id,
            item_name=item_name,
            company=company,
            price=price,
            category=category,
            invoice_date=invoice_date,
            document_id=document_id,
        )
    )


async def search_embeddings(
    query: str, limit: int = 5, user_id: str | None = None
) -> list[Document]:
    vs = await get_vectorstore()
    filter_dict = {"user_id": user_id} if user_id else None
    return await vs.asimilarity_search(query, k=limit, filter=filter_dict)


async def update_embeddings(
    invoice_id: int,
    text: str,
    user_id: str,
    item_name: str | None = None,
    company: str | None = None,
    price: float | None = None,
    category: str | None = None,
    invoice_date: str | None = None,
    document_id: int | None = None,
) -> None:
    await delete_embeddings(invoice_id)
    await store_embeddings(
        invoice_id,
        text,
        user_id,
        item_name=item_name,
        company=company,
        price=price,
        category=category,
        invoice_date=invoice_date,
        document_id=document_id,
    )


async def delete_embeddings(invoice_id: int) -> None:
    if DATABASE_URL is None:
        raise RuntimeError("DATABASE_URL environment variable is required")
    conn = await asyncpg.connect(
        DATABASE_URL, server_settings={"search_path": f"{SCHEMA_NAME}, public"}
    )
    try:
        await conn.execute(
            f"DELETE FROM {TABLE_NAME} WHERE langchain_metadata->>'invoice_id' = $1",
            str(invoice_id),
        )
    finally:
        await conn.close()
