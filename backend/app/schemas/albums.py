from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, date
from typing import Optional


class AlbumBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=60)
    description: Optional[str] = None
    category: str = Field(default="amor", max_length=30)
    commemorative_date: Optional[date] = None


class AlbumCreate(AlbumBase):
    pass


class AlbumUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=60)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=30)
    commemorative_date: Optional[date] = None


class AlbumOut(AlbumBase):
    id: str
    user_id: str
    cover_url: Optional[str] = None
    photo_count: int = 0
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class PhotoBase(BaseModel):
    caption: Optional[str] = None
    is_fav: bool = False
    photo_date: Optional[date] = None


class PhotoCreate(PhotoBase):
    pass


class PhotoUpdate(BaseModel):
    caption: Optional[str] = None
    is_fav: Optional[bool] = None
    photo_date: Optional[date] = None


class PhotoOut(PhotoBase):
    id: str
    album_id: str
    user_id: str
    filename: str
    url: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class AlbumWithPhotosOut(AlbumOut):
    photos: list[PhotoOut] = []
