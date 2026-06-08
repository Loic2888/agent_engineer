from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://user:password@localhost:5432/mydb"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    max_retries: int = 3
    max_rows_returned: int = 100
    show_sql_in_ui: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
