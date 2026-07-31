from decimal import Decimal
import unittest

from services.position_service import build_positions_from_transactions


def row(
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


class PositionSummaryTests(unittest.TestCase):
    def test_multiple_buys_group_into_one_position(self):
        positions = build_positions_from_transactions([
            row(quantity="10.5", price_per_unit="195.25", fee_amount="2.99"),
            row(quantity="10.5", price_per_unit="100", fee_amount="2.99"),
            row(quantity="10.5", price_per_unit="200", fee_amount="2.99"),
        ])

        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0]["ticker"], "AAPL")
        self.assertEqual(positions[0]["quantity_owned"], 31.5)
        self.assertEqual(positions[0]["cost_basis"], 5209.1)
        self.assertEqual(positions[0]["average_cost"], 165.37)
        self.assertIsNone(positions[0]["unrealized_gain"])

    def test_partial_sell_reduces_quantity_and_cost_basis_by_average_cost(self):
        positions = build_positions_from_transactions([
            row(quantity="10", price_per_unit="100"),
            row(quantity="10", price_per_unit="200"),
            row(trade_type="SELL", quantity="5", price_per_unit="250"),
        ])

        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0]["quantity_owned"], 15)
        self.assertEqual(positions[0]["cost_basis"], 2250)
        self.assertEqual(positions[0]["average_cost"], 150)

    def test_current_price_adds_market_value_and_unrealized_gain(self):
        positions = build_positions_from_transactions(
            [
                row(quantity="10", price_per_unit="100"),
                row(quantity="10", price_per_unit="200"),
            ],
            {"AAPL": 180},
        )

        self.assertEqual(positions[0]["current_price"], 180)
        self.assertEqual(positions[0]["market_value"], 3600)
        self.assertEqual(positions[0]["unrealized_gain"], 600)
        self.assertEqual(positions[0]["unrealized_gain_percent"], 20)

    def test_fully_sold_position_is_hidden(self):
        positions = build_positions_from_transactions([
            row(quantity="10", price_per_unit="100"),
            row(trade_type="SELL", quantity="10", price_per_unit="150"),
        ])

        self.assertEqual(positions, [])

    def test_same_ticker_different_currency_is_separate(self):
        positions = build_positions_from_transactions([
            row(ticker="SHOP", currency="USD", quantity="2", price_per_unit="60"),
            row(ticker="SHOP", currency="CAD", quantity="3", price_per_unit="80"),
        ])

        self.assertEqual(len(positions), 2)
        self.assertEqual(
            {(position["ticker"], position["currency"]) for position in positions},
            {("SHOP", "CAD"), ("SHOP", "USD")},
        )

    def test_oversold_position_raises_error(self):
        with self.assertRaisesRegex(ValueError, "Oversold position"):
            build_positions_from_transactions([
                row(quantity="3", price_per_unit="100"),
                row(trade_type="SELL", quantity="4", price_per_unit="150"),
            ])


if __name__ == "__main__":
    unittest.main()
