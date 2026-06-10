import os
import asyncio
import asyncpg
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_postgres import PGEngine, PGVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from sqlalchemy.exc import ProgrammingError

DATABASE_URL = os.getenv("DATABASE_URL")
TABLE_NAME = "langchain_invoice_embeddings"
VECTOR_SIZE = 384  # sentence-transformers/all-MiniLM-L6-v2

def _asyncpg_url(url: str) -> str:
    return url.replace("postgresql://", "postgresql+asyncpg://", 1)

_embeddings: HuggingFaceEmbeddings | None = None
_engine: PGEngine | None = None
_vectorstore: PGVectorStore | None = None
_init_lock = asyncio.Lock()

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500, chunk_overlap=50, add_start_index=True
)


def chunk_text(text: str, invoice_id: int, user_id: str, **metadata) -> list[Document]:
    splits = _splitter.create_documents([text])
    for doc in splits:
        doc.metadata["invoice_id"] = invoice_id
        doc.metadata["user_id"] = user_id
        for key, value in metadata.items():
            if value is not None:
                doc.metadata[key] = value
    return splits


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
    return _embeddings


async def get_vectorstore() -> PGVectorStore:
    global _engine, _vectorstore
    async with _init_lock:
        if _vectorstore is not None:
            return _vectorstore
        _engine = PGEngine.from_connection_string(url=_asyncpg_url(DATABASE_URL))
        try:
            await _engine.ainit_vectorstore_table(
                table_name=TABLE_NAME,
                vector_size=VECTOR_SIZE,
            )
        except ProgrammingError:
            pass  # Table already exists from a previous run
        _vectorstore = await PGVectorStore.create(
            engine=_engine,
            table_name=TABLE_NAME,
            embedding_service=get_embeddings(),
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
    await vs.aadd_documents(chunk_text(
        text, invoice_id, user_id,
        item_name=item_name, company=company, price=price,
        category=category, invoice_date=invoice_date, document_id=document_id,
    ))


async def search_embeddings(query: str, limit: int = 5, user_id: str | None = None) -> list[Document]:
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
        invoice_id, text, user_id,
        item_name=item_name, company=company, price=price,
        category=category, invoice_date=invoice_date, document_id=document_id,
    )


async def delete_embeddings(invoice_id: int) -> None:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(
            f"DELETE FROM {TABLE_NAME} WHERE langchain_metadata->>'invoice_id' = $1",
            str(invoice_id),
        )
    finally:
        await conn.close()
