import csv
from decimal import Decimal
from pathlib import Path

from services.position_service import build_positions_from_transactions
from tests.conftest import position_row as row


FIXTURE_PATH = (
    Path(__file__).resolve().parents[1]
    / "fixtures"
    / "portfolio_pl_scenario.csv"
)
TICKER = "AAPL"


def display_money(value):
    if value is None:
        return "None"
    return str(Decimal(str(value)).quantize(Decimal("0.01")))


def decimal_value(value):
    if value == "":
        return None
    return Decimal(value)


def load_portfolio_pl_rows():
    numeric_columns = {
        "current_price",
        "quantity",
        "cash_in_hand",
        "shares",
        "average_cost_per_share",
        "unrealized_pl",
    }
    scenario_rows = []

    with FIXTURE_PATH.open(newline="") as csv_file:
        reader = csv.DictReader(csv_file)

        for csv_row in reader:
            scenario_row = {}

            for key, value in csv_row.items():
                if key in numeric_columns:
                    scenario_row[key] = decimal_value(value)
                else:
                    scenario_row[key] = value

            scenario_rows.append(scenario_row)

    return scenario_rows


def test_portfolio_pl_scenario_matches_csv_fixture():
    transactions = []

    print("\nCSV portfolio P/L scenario using build_positions_from_transactions")

    for row_number, scenario_row in enumerate(load_portfolio_pl_rows(), start=1):
        current_price = scenario_row["current_price"]
        action = scenario_row["action"]
        quantity = scenario_row["quantity"]

        if action == "BUY":
            transactions.append(
                row(
                    ticker=TICKER,
                    trade_type="BUY",
                    quantity=str(quantity),
                    price_per_unit=str(current_price),
                )
            )

        if action == "SELL":
            transactions.append(
                row(
                    ticker=TICKER,
                    trade_type="SELL",
                    quantity=str(quantity),
                    price_per_unit=str(current_price),
                )
            )

        positions = build_positions_from_transactions(
            transactions,
            {TICKER: current_price} if current_price is not None else {},
        )
        position = positions[0] if positions else None

        expected_shares = scenario_row["shares"]
        expected_average_cost = scenario_row["average_cost_per_share"]
        expected_cash = scenario_row["cash_in_hand"]
        expected_unrealized_pl = scenario_row["unrealized_pl"]

        actual_shares = (
            Decimal(str(position["quantity_owned"]))
            if position is not None
            else Decimal("0")
        )
        actual_average_cost = (
            Decimal(str(position["average_cost"]))
            if position is not None
            else Decimal("0")
        )
        actual_unrealized_pl = (
            Decimal(str(position["unrealized_gain"]))
            if position is not None and position["unrealized_gain"] is not None
            else Decimal("0")
        )
        actual_cost_basis = (
            Decimal(str(position["cost_basis"]))
            if position is not None
            else Decimal("0")
        )
        actual_market_value = (
            Decimal(str(position["market_value"]))
            if position is not None and position["market_value"] is not None
            else Decimal("0")
        )

        row_label = action if action else "PRICE CHECK"
        print(
            "\n"
            f"Row {row_number}: {row_label}"
            f"{'' if quantity is None else f' {quantity}'}"
            f"{'' if current_price is None else f' @ ${display_money(current_price)}'}\n"
            f"  Cash in hand:  expected ${display_money(expected_cash)}\n"
            f"  Shares:        expected {expected_shares}, "
            f"actual {actual_shares}\n"
            f"  Average cost:  expected ${display_money(expected_average_cost)}, "
            f"actual ${display_money(actual_average_cost)}\n"
            f"  Unrealized P/L: expected ${display_money(expected_unrealized_pl)}, "
            f"actual ${display_money(actual_unrealized_pl)}\n"
            f"  Cost basis:    actual ${display_money(actual_cost_basis)}\n"
            f"  Market value:  actual ${display_money(actual_market_value)}"
        )

        if expected_shares == 0:
            assert position is None
            assert expected_average_cost == 0
            assert expected_unrealized_pl == 0
            continue

        assert actual_shares == expected_shares
        assert actual_average_cost == expected_average_cost
        assert actual_unrealized_pl == expected_unrealized_pl
        assert actual_market_value == expected_shares * current_price
        assert actual_cost_basis == expected_shares * expected_average_cost
