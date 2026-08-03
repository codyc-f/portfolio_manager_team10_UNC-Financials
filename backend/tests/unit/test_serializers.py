from datetime import datetime
from decimal import Decimal

from serializers import decimal_to_json_number, serialize_db_row


def test_serialize_db_row_converts_database_types_to_json_friendly_values():
    row = {
        "amount": Decimal("123.4500"),
        "created_at": datetime(2026, 7, 27, 14, 30),
        "name": "Growth",
    }

    assert serialize_db_row(row) == {
        "amount": "123.4500",
        "created_at": "2026-07-27 14:30:00",
        "name": "Growth",
    }


def test_serialize_db_row_allows_none():
    assert serialize_db_row(None) is None


def test_decimal_to_json_number_quantizes_decimal():
    assert decimal_to_json_number(Decimal("12.345")) == 12.34
