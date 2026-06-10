from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
import os


def _async_url(url: str) -> str:
    return url.replace("postgresql://", "postgresql+asyncpg://", 1)


Base = declarative_base()
engine = create_async_engine(_async_url(os.getenv("DATABASE_URL")))
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Suggestion(Base):
    __tablename__ = "suggestions"
    id = Column(Integer, primary_key=True)
    user_id = Column(String)
    suggestion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
