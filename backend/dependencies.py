from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User
from auth_utils import decode_access_token

# HTTPBearer схема для JWT токенов (лучше работает со Swagger)
http_bearer = HTTPBearer(
    scheme_name="Bearer",
    description="Введите JWT токен, полученный через /auth/login. Формат: Bearer <token>"
)

# Для обратной совместимости с OAuth2PasswordBearer
oauth2_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db)
) -> User:
    """Получение текущего пользователя из JWT токена"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось подтвердить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    login: str = payload.get("sub")
    if login is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.login == login).first()
    if user is None:
        raise credentials_exception
    
    return user


def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Проверка, что текущий пользователь является администратором"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав доступа"
        )
    return current_user

