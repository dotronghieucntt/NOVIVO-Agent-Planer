from routers.auth import router as auth_router
from routers.planning import router as planning_router
from routers.chat import router as chat_router
from routers.content import router as content_router
from routers.admin import router as admin_router
from routers.settings import router as settings_router

__all__ = ["auth_router", "planning_router", "chat_router", "content_router", "admin_router", "settings_router"]
