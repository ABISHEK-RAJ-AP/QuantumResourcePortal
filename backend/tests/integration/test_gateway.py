"""Gateway behaviour that does not need a database: correlation ids and problem+json errors."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from qre.core.errors import QreError
from qre.core.ids import is_ulid


class _Body(BaseModel):
    shots: int = Field(gt=0)


def _add_test_routes(client) -> None:
    router = APIRouter(prefix="/__test__")

    @router.get("/qre-error")
    async def qre_error():
        raise QreError("Requested 51 shots; available 50.", code="QUOTA_INSUFFICIENT")

    @router.post("/validate")
    async def validate(body: _Body):
        return body

    @router.get("/boom")
    async def boom():
        raise RuntimeError("database password=hunter2 leaked?")

    client.app.include_router(router)


async def test_healthz_generates_correlation_id(client):
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert is_ulid(response.headers["X-Correlation-ID"])


async def test_valid_inbound_correlation_id_is_preserved(client):
    response = await client.get("/healthz", headers={"X-Correlation-ID": "trace-abc-12345"})
    assert response.headers["X-Correlation-ID"] == "trace-abc-12345"


async def test_malformed_inbound_correlation_id_is_replaced(client):
    response = await client.get("/healthz", headers={"X-Correlation-ID": "bad id!"})
    assert is_ulid(response.headers["X-Correlation-ID"])


async def test_unknown_route_returns_problem_json_404(client):
    response = await client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["code"] == "RESOURCE_NOT_FOUND"
    assert body["correlation_id"] == response.headers["X-Correlation-ID"]


async def test_domain_error_uses_catalogue_status_and_detail(client):
    _add_test_routes(client)
    response = await client.get("/__test__/qre-error")
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "QUOTA_INSUFFICIENT"
    assert body["type"].endswith("/QUOTA_INSUFFICIENT")
    assert body["detail"] == "Requested 51 shots; available 50."


async def test_validation_error_is_400_with_field_errors(client):
    _add_test_routes(client)
    response = await client.post("/__test__/validate", json={"shots": 0})
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "VALIDATION_FAILED"
    assert body["field_errors"][0]["field"] == "shots"


async def test_malformed_json_is_reported_as_malformed_request(client):
    _add_test_routes(client)
    response = await client.post(
        "/__test__/validate", content=b"{not json", headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "MALFORMED_REQUEST"


async def test_unhandled_exception_hides_internals(client):
    _add_test_routes(client)
    response = await client.get("/__test__/boom")
    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "INTERNAL_ERROR"
    assert "hunter2" not in response.text
    assert body["correlation_id"] == response.headers["X-Correlation-ID"]


async def test_openapi_is_served_under_api_v1(client):
    response = await client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Quantum Resource Portal API"
