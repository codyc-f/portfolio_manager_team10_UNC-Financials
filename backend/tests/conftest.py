import os
from decimal import Decimal

import pytest


@pytest.fixture
def portfolio_payload():
    return {
        "name": "Growth Portfolio",
        "base_currency": "USD",
        "balance": 10000,
    }


@pytest.fixture
def holding_payload():
    return {
        "portfolio_id": 1,
        "ticker": "AAPL",
        "asset_name": "Apple Inc.",
        "asset_type": "STOCK",
        "currency": "USD",
        "trade_type": "BUY",
        "quantity": 5,
        "price_per_unit": 100,
        "fee_amount": 1.5,
        "traded_at": "2026-07-27 14:30:00",
    }


def position_row(
    ticker="AAPL",
    currency="USD",
    trade_type="BUY",
    quantity="1",
    price_per_unit="100",
    fee_amount="0",
    asset_name="Apple Inc.",
    asset_type="STOCK",
):
    return {
        "ticker": ticker,
        "asset_name": asset_name,
        "asset_type": asset_type,
        "currency": currency,
        "trade_type": trade_type,
        "quantity": Decimal(quantity),
        "price_per_unit": Decimal(price_per_unit),
        "fee_amount": Decimal(fee_amount),
    }


def integration_enabled():
    return os.environ.get("RUN_DB_INTEGRATION_TESTS") == "1"
