import pytest

from services.position_service import build_positions_from_transactions
from tests.conftest import position_row as row


def test_multiple_buys_group_into_one_position():
    positions = build_positions_from_transactions([
        row(quantity="10.5", price_per_unit="195.25", fee_amount="2.99"),
        row(quantity="10.5", price_per_unit="100", fee_amount="2.99"),
        row(quantity="10.5", price_per_unit="200", fee_amount="2.99"),
    ])

    assert len(positions) == 1
    assert positions[0]["ticker"] == "AAPL"
    assert positions[0]["quantity_owned"] == 31.5
    assert positions[0]["cost_basis"] == 5209.1
    assert positions[0]["average_cost"] == 165.37
    assert positions[0]["unrealized_gain"] is None


def test_partial_sell_reduces_quantity_and_cost_basis_by_average_cost():
    positions = build_positions_from_transactions([
        row(quantity="10", price_per_unit="100"),
        row(quantity="10", price_per_unit="200"),
        row(trade_type="SELL", quantity="5", price_per_unit="250"),
    ])

    assert len(positions) == 1
    assert positions[0]["quantity_owned"] == 15
    assert positions[0]["cost_basis"] == 2250
    assert positions[0]["average_cost"] == 150


def test_current_price_adds_market_value_and_unrealized_gain():
    positions = build_positions_from_transactions(
        [
            row(quantity="10", price_per_unit="100"),
            row(quantity="10", price_per_unit="200"),
        ],
        {"AAPL": 180},
    )

    assert positions[0]["current_price"] == 180
    assert positions[0]["market_value"] == 3600
    assert positions[0]["unrealized_gain"] == 600
    assert positions[0]["unrealized_gain_percent"] == 20


def test_fully_sold_position_is_hidden():
    positions = build_positions_from_transactions([
        row(quantity="10", price_per_unit="100"),
        row(trade_type="SELL", quantity="10", price_per_unit="150"),
    ])

    assert positions == []


def test_same_ticker_different_currency_is_separate():
    positions = build_positions_from_transactions([
        row(ticker="SHOP", currency="USD", quantity="2", price_per_unit="60"),
        row(ticker="SHOP", currency="CAD", quantity="3", price_per_unit="80"),
    ])

    assert len(positions) == 2
    assert {
        (position["ticker"], position["currency"]) for position in positions
    } == {("SHOP", "CAD"), ("SHOP", "USD")}


def test_oversold_position_raises_error():
    with pytest.raises(ValueError, match="Oversold position"):
        build_positions_from_transactions([
            row(quantity="3", price_per_unit="100"),
            row(trade_type="SELL", quantity="4", price_per_unit="150"),
        ])
