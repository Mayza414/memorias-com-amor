import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Text, Integer, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(60))
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30), default="amor")
    commemorative_date: Mapped[Optional[date]] = mapped_column(Date)
    cover_url: Mapped[Optional[str]] = mapped_column(String(500))
    photo_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="albums")
    photos: Mapped[list["Photo"]] = relationship(
        "Photo", back_populates="album", cascade="all, delete-orphan"
    )
