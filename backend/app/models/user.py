from typing import Optional  # <-- IMPORTANTE
from datetime import datetime
from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_pic: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    albums: Mapped[list["Album"]] = relationship(
        "Album", back_populates="user", cascade="all, delete-orphan"
    )
    photos: Mapped[list["Photo"]] = relationship(
        "Photo", back_populates="user", cascade="all, delete-orphan"
    )