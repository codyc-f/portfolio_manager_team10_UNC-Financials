import pytest

from validators import (
    is_currency_code,
    is_mysql_datetime,
    is_number_in_range,
    validate_holding_payload,
    validate_portfolio_payload,
)


@pytest.mark.parametrize("value", ["USD", "CAD", "EUR"])
def test_currency_code_accepts_three_uppercase_letters(value):
    assert is_currency_code(value)


@pytest.mark.parametrize("value", ["usd", "US", "US1", "", None])
def test_currency_code_rejects_invalid_values(value):
    assert not is_currency_code(value)


@pytest.mark.parametrize("value", [0, "0.01", 25.5])
def test_number_in_range_accepts_numeric_values(value):
    assert is_number_in_range(value, 0)


@pytest.mark.parametrize("value", [True, False, "NaN", "-1", object()])
def test_number_in_range_rejects_invalid_values(value):
    assert not is_number_in_range(value, 0)


def test_mysql_datetime_requires_exact_format():
    assert is_mysql_datetime("2026-07-27 14:30:00")
    assert not is_mysql_datetime("2026-07-27T14:30")


def test_validate_portfolio_payload_accepts_valid_payload(portfolio_payload):
    assert validate_portfolio_payload(portfolio_payload) is None


def test_validate_portfolio_payload_rejects_bad_currency(portfolio_payload):
    portfolio_payload["base_currency"] = "usd"
    assert validate_portfolio_payload(portfolio_payload) == (
        "'base_currency' must be a 3-letter uppercase currency code"
    )


def test_validate_holding_payload_accepts_valid_payload(holding_payload):
    assert validate_holding_payload(holding_payload) is None


def test_validate_holding_payload_rejects_missing_required_field(holding_payload):
    del holding_payload["ticker"]
    assert validate_holding_payload(holding_payload) == (
        "Missing required fields: ticker"
    )


def test_validate_holding_payload_rejects_sell_typo(holding_payload):
    holding_payload["trade_type"] = "SHORT"
    assert validate_holding_payload(holding_payload) == (
        "'trade_type' must be either 'BUY' or 'SELL'"
    )
