from pydantic import BaseModel, ConfigDict, Field


class AssetCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider_id: str = Field(min_length=1, max_length=128)
    native_asset_id: str = Field(min_length=1, max_length=256)
    asset_class: str = Field(min_length=1, max_length=64)
    execution_class: str = Field(pattern=r"^(simulated|hardware)$")


class AssetLifecycleIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lifecycle_state: str = Field(
        pattern=r"^(registered|active|maintenance|suspended|retired)$"
    )


class ProviderCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider_id: str = Field(min_length=1, max_length=128)
    provider_name: str = Field(min_length=1, max_length=256)


class ProviderOnboardingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operations: list[str] = Field(min_length=1)
    execution_classes: list[str] = Field(min_length=1)


class ProviderTransitionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str = Field(pattern=r"^(active|suspended)$")


class PoolCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=80)


class PoolMemberIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    asset_id: str = Field(min_length=26, max_length=26)


class BackendCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    backend_id: str = Field(min_length=1, max_length=128)
    provider_id: str = Field(min_length=1, max_length=128)
    backend_name: str = Field(min_length=1, max_length=256)
    operational_status: str = Field(default="OFFLINE", pattern=r"^(ONLINE|OFFLINE|MAINTENANCE)$")
    qubit_count: int | None = Field(default=None, ge=0)
    qpu_modality: str | None = Field(default=None, max_length=64)
    topology_type: str | None = Field(default=None, max_length=64)