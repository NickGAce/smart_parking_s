from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Smart Parking"
    debug: bool = False

    database_url: str

    jwt_secret: str
    jwt_alg: str = "HS256"
    access_token_expire_minutes: int = 60
    default_timezone: str = "Europe/Moscow"
    check_in_open_before_minutes: int = 15
    no_show_grace_minutes: int = 30
    booking_sync_enabled: bool = True
    booking_sync_interval_seconds: int = 60
    booking_sync_run_on_startup: bool = False


settings = Settings()
