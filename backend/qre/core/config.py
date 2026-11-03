"""Typed application configuration (LLD §13.4, §13.9, Appendix D).

All settings come from environment variables prefixed ``QRE_`` or from ``backend/.env``.
Invalid configuration aborts start-up with a precise message (no partial start).
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
"""Absolute path of the ``backend/`` directory (contains ``.env`` and ``alembic.ini``)."""

APP_VERSION = "0.1.0"


class Profile(StrEnum):
    LAB = "lab"
    PRODUCTION = "production"


class LogFormat(StrEnum):
    JSON = "json"
    TEXT = "text"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="QRE_",
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Profile = Profile.LAB
    database_url: SecretStr = Field(
        description="SQLAlchemy async DSN, e.g. postgresql+asyncpg://user:pw@host:5432/qre"
    )
    public_base_url: str = "http://localhost:5173"
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    log_level: str = "INFO"
    log_format: LogFormat = LogFormat.JSON

    session_idle_min: int = Field(default=30, ge=5, le=24 * 60)
    session_absolute_h: int = Field(default=12, ge=1, le=7 * 24)
    mfa_required: bool = False

    page_size_default: int = Field(default=25, ge=1, le=200)
    page_size_max: int = Field(default=200, ge=1, le=1000)

    max_body_mb: int = Field(default=10, ge=1, le=100)
    max_upload_mb: int = Field(default=50, ge=1, le=500)

    readiness_db_timeout_ms: int = Field(default=2000, ge=100, le=30000)
    api_statement_timeout_ms: int = Field(default=5000, ge=100, le=60000)  # PD-35

    feature_svc05_enabled: bool = False  # Procurement & Entitlements — Pending Approval (OI-01)
    rls_enabled: bool = False  # PostgreSQL RLS second layer — Pending Approval (PD-44)

    error_type_base: str = "https://qre.cdac.in/errors/"  # placeholder base URI (LLD §10.2)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("database_url")
    @classmethod
    def _async_driver(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith("postgresql+asyncpg://"):
            raise ValueError("QRE_DATABASE_URL must start with 'postgresql+asyncpg://'")
        return value

    @field_validator("log_level")
    @classmethod
    def _level(cls, value: str) -> str:
        level = value.upper()
        if level not in {"DEBUG", "INFO", "WARNING", "ERROR"}:
            raise ValueError("QRE_LOG_LEVEL must be DEBUG, INFO, WARNING or ERROR")
        return level

    @model_validator(mode="after")
    def _cross_field_rules(self) -> Settings:
        if self.page_size_default > self.page_size_max:
            raise ValueError("QRE_PAGE_SIZE_DEFAULT must not exceed QRE_PAGE_SIZE_MAX")
        if self.env is Profile.PRODUCTION:
            # LLD §13.9: production requires explicit MFA setting, TLS DB URL and CORS list.
            problems = []
            if "mfa_required" not in self.model_fields_set:
                problems.append("QRE_MFA_REQUIRED must be set explicitly")
            if "ssl=" not in self.database_url.get_secret_value():
                problems.append("QRE_DATABASE_URL must enable TLS (e.g. ?ssl=verify-full)")
            if not self.cors_origins:
                problems.append("QRE_CORS_ORIGINS must list the allowed origins")
            if problems:
                raise ValueError("production profile: " + "; ".join(problems))
        return self

    @property
    def is_lab(self) -> bool:
        return self.env is Profile.LAB

    def masked(self) -> dict[str, Any]:
        """Effective configuration with secrets masked (used by `qre config-check`)."""
        data = self.model_dump(mode="json")
        dsn = self.database_url.get_secret_value()
        if "@" in dsn and ":" in dsn.split("@", 1)[0]:
            scheme_user, rest = dsn.split("@", 1)
            scheme_user = scheme_user.rsplit(":", 1)[0] + ":***"
            dsn = f"{scheme_user}@{rest}"
        data["database_url"] = dsn
        return data


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings (validated once, cached)."""
    return Settings()  # type: ignore[call-arg]  # values come from the environment
