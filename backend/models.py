from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(100), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)  # Хэшированный пароль
    nick = Column(String(100), nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # Старые поля оставляем для обратной совместимости
    file_path = Column(String(500), nullable=True)  # Путь к файлу на сервере (deprecated)
    file_type = Column(String(50), nullable=True)  # MIME type файла (deprecated)
    file_name = Column(String(255), nullable=True)  # Оригинальное имя файла (deprecated)
    date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    upvotes = Column(Integer, default=0, nullable=False)
    
    # Relationship для доступа к пользователю
    user = relationship("User", backref="posts")
    # Relationship для доступа к файлам
    files = relationship("PostFile", back_populates="post", cascade="all, delete-orphan", order_by="PostFile.order")


class PostFile(Base):
    __tablename__ = "post_files"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)  # Путь к файлу на сервере
    file_type = Column(String(100), nullable=False)  # MIME type файла
    file_name = Column(String(255), nullable=False)  # Оригинальное имя файла
    file_size = Column(Integer, nullable=True)  # Размер файла в байтах
    order = Column(Integer, default=0, nullable=False)  # Порядок файла в посте (для альбомов)
    
    # Relationship для доступа к посту
    post = relationship("Post", back_populates="files")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    # Relationship для доступа к посту и пользователю
    post = relationship("Post", backref="comments")
    user = relationship("User", backref="comments")

