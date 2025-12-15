from .auth import router as auth_router
from .posts import router as posts_router
from .users import router as users_router
from .metadata import router as metadata_router
from .comments import router as comments_router

routers = [
    auth_router,
    posts_router,
    users_router,
    metadata_router,
    comments_router,
]