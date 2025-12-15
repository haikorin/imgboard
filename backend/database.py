from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@db:5432/imageboard"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency для получения сессии БД"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Создание всех таблиц в БД и выполнение миграций"""
    # Сначала создаём таблицы
    Base.metadata.create_all(bind=engine)
    
    # Затем выполняем миграции
    try:
        from migrations import migrate_posts_table
        migrate_posts_table()
    except Exception as e:
        print(f"Предупреждение при выполнении миграций: {e}")

