from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    mixes = relationship("SavedMix", back_populates="user", cascade="all, delete-orphan")


class SavedMix(Base):
    __tablename__ = "saved_mixes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    prompt = Column(Text, nullable=False)
    resolved_tags = Column(JSON, nullable=False, default=list)
    tracks = Column(JSON, nullable=False, default=list)
    transitions = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    user = relationship("User", back_populates="mixes")
