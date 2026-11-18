from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    project_type: str | None = Field(default=None, max_length=64)