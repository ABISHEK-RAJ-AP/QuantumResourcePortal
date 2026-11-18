from pydantic import BaseModel, ConfigDict, Field


class AuthorizeDispatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    backend_id: str = Field(min_length=1, max_length=128)


class RecordAttemptIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    backend_id: str = Field(min_length=1, max_length=128)
    execution_class: str | None = Field(default=None, max_length=32)
    external_job_id: str | None = Field(default=None, max_length=256)


class ReconcileIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    outcome: str = Field(pattern=r"^(confirmed|failed|unresolved)$")
    reason: str = Field(default="", max_length=2000)