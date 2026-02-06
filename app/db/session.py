from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.config import settings

# Создание асинхронного движка (engine)
engine = create_async_engine(
    settings.database_url,  # подключение из конфигов
    echo=settings.debug,     # логирование запросов
    pool_pre_ping=True,
)

# Создание асинхронной фабрики сессий
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Функция для получения сессии
async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
