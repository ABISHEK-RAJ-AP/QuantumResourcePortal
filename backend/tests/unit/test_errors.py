import pytest

from qre.core.errors import CATALOGUE, QreError, ResourceNotFound
from qre.core.logging import mask


def test_catalogue_has_all_48_appendix_c_codes():
    assert len(CATALOGUE) == 48


def test_unknown_code_is_a_programming_error():
    with pytest.raises(ValueError):
        QreError(code="NOT_A_CODE")


def test_subclass_carries_status_and_title():
    err = ResourceNotFound()
    assert err.status == 404
    assert err.spec.title == "The requested resource was not found."


def test_mask_replaces_secret_keys_recursively():
    data = {"password": "x", "nested": [{"api_key": "y", "ok": 1}], "Authorization": "Bearer z"}
    assert mask(data) == {
        "password": "***",
        "nested": [{"api_key": "***", "ok": 1}],
        "Authorization": "***",
    }
