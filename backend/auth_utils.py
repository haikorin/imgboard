from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


def _truncate_password(password: str) -> bytes:
    """Обрезает пароль до 72 байт (ограничение bcrypt) и возвращает bytes"""
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # Обрезаем до 72 байт
        truncated_bytes = password_bytes[:72]
        # Находим последний полный символ UTF-8 (убираем неполные байты)
        while truncated_bytes and (truncated_bytes[-1] & 0xC0) == 0x80:
            truncated_bytes = truncated_bytes[:-1]
        return truncated_bytes
    return password_bytes


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    try:
        # Bcrypt ограничение: 72 байта максимум
        password_bytes = _truncate_password(plain_password)
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        # Логируем ошибку для отладки
        print(f"Ошибка при проверке пароля: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Хэширование пароля"""
    try:
        # Bcrypt ограничение: 72 байта максимум
        password_bytes = _truncate_password(password)
        # Генерируем соль и хэшируем пароль
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')
    except Exception as e:
        # Логируем ошибку для отладки
        print(f"Ошибка при хэшировании пароля: {e}, длина пароля в байтах: {len(password.encode('utf-8'))}")
        raise


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Создание JWT токена"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Декодирование JWT токена"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

