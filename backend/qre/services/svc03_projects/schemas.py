from pydantic import BaseModel, ConfigDict, Field


class ProjectCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    project_type: str | None = Field(default="quantum_circuit", max_length=32)


class ProjectMemberIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=2, max_length=64)
    role: str = Field(pattern=r"^(editor|viewer)$")