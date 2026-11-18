from pydantic import BaseModel, ConfigDict, Field


class ReservationCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resource_ref: str = Field(min_length=1, max_length=256)
    project_id: str | None = Field(default=None, max_length=26)
    window_start: str = Field(min_length=10, max_length=64)
    window_end: str = Field(min_length=10, max_length=64)
    purpose: str = Field(min_length=3, max_length=240)


class ReservationTransitionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: str = Field(pattern=r"^(requested|active|released|cancelled)$")