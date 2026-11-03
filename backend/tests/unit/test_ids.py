from qre.core.ids import ULID_PATTERN, is_ulid, new_ulid


def test_ulid_format_is_26_crockford_chars():
    value = new_ulid()
    assert len(value) == 26
    assert ULID_PATTERN.fullmatch(value)
    assert is_ulid(value)


def test_is_ulid_rejects_lowercase_and_excluded_letters():
    assert not is_ulid("01jd3q7a0b1c2d3e4f5g6h7j8k")  # lower case
    assert not is_ulid("01JD3Q7A0B1C2D3E4F5G6H7J8I")  # I is not Crockford
    assert not is_ulid("too-short")


def test_ulids_are_unique_and_monotonic():
    values = [new_ulid() for _ in range(50_000)]
    assert len(set(values)) == len(values)
    assert values == sorted(values)
