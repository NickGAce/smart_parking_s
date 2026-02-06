from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Smart Parking"
    debug: bool = False

    database_url: str

    jwt_secret: str
    jwt_alg: str = "HS256"
    access_token_expire_minutes: int = 60


settings = Settings()
