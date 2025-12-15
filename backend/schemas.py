from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List


# User Schemas
class UserCreate(BaseModel):
    login: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=72)
    nick: str = Field(..., min_length=1, max_length=100)
    is_admin: bool = False

    @field_validator('password')
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        # Bcrypt ограничение: 72 байта максимум
        if len(v.encode('utf-8')) > 72:
            raise ValueError('Пароль не может быть длиннее 72 байт')
        return v


class UserLogin(BaseModel):
    login: str
    password: str = Field(..., max_length=72)


class UserResponse(BaseModel):
    id: int
    login: str
    nick: str
    is_admin: bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    nick: Optional[str] = None
    is_admin: Optional[bool] = None


# Post Schemas
class PostCreate(BaseModel):
    text: str
    # Файл загружается отдельно через multipart/form-data


class PostUpdate(BaseModel):
    text: Optional[str] = None
    # Файл можно обновить через отдельный эндпоинт


class PostFileResponse(BaseModel):
    id: int
    file_path: Optional[str] = None  # Путь к файлу (внутренний)
    file_type: str  # MIME type файла
    file_name: str  # Оригинальное имя файла
    file_url: Optional[str] = None  # URL для получения файла
    file_size: Optional[int] = None  # Размер файла в байтах
    order: int  # Порядок файла в посте

    class Config:
        from_attributes = True


class PostResponse(BaseModel):
    id: int
    text: Optional[str] = None  # Текст поста (опциональный)
    # Старые поля для обратной совместимости
    file_path: Optional[str] = None  # Путь к файлу (внутренний, deprecated)
    file_type: Optional[str] = None  # MIME type файла (deprecated)
    file_name: Optional[str] = None  # Оригинальное имя файла (deprecated)
    file_url: Optional[str] = None  # URL для получения файла (deprecated)
    # Новые поля для поддержки нескольких файлов
    files: List[PostFileResponse] = []  # Список файлов поста
    date: datetime
    is_deleted: bool
    upvotes: int
    author_nick: Optional[str] = None  # Ник пользователя, создавшего пост
    author_id: Optional[int] = None  # ID пользователя, создавшего пост

    class Config:
        from_attributes = True


# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    login: Optional[str] = None


# Comment Schemas
class CommentCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class CommentResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    text: str
    date: datetime
    is_deleted: bool
    author_nick: Optional[str] = None  # Ник пользователя, создавшего комментарий
    author_id: Optional[int] = None  # ID пользователя, создавшего комментарий

    class Config:
        from_attributes = True

