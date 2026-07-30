from decimal import Decimal

from serializers import decimal_to_json_number


def build_positions_from_transactions(transactions, current_prices=None):
    """Build active positions from transaction rows using average cost basis."""
    current_prices = current_prices or {}
    positions = {}

    for transaction in transactions:
        key = (transaction["ticker"], transaction["currency"])
        position = positions.setdefault(
            key,
            {
                "ticker": transaction["ticker"],
                "asset_name": transaction["asset_name"],
                "asset_type": transaction["asset_type"],
                "currency": transaction["currency"],
                "quantity_owned": Decimal("0"),
                "cost_basis": Decimal("0"),
            },
        )

        quantity = Decimal(str(transaction["quantity"]))
        price_per_unit = Decimal(str(transaction["price_per_unit"]))
        fee_amount = Decimal(str(transaction["fee_amount"]))

        if transaction["trade_type"] == "BUY":
            position["asset_name"] = transaction["asset_name"]
            position["asset_type"] = transaction["asset_type"]
            position["quantity_owned"] += quantity
            position["cost_basis"] += (quantity * price_per_unit) + fee_amount
            continue

        if position["quantity_owned"] < quantity:
            raise ValueError(
                f"Oversold position for {transaction['ticker']} "
                f"{transaction['currency']}"
            )

        average_cost = position["cost_basis"] / position["quantity_owned"]
        position["quantity_owned"] -= quantity
        position["cost_basis"] -= average_cost * quantity

        if position["quantity_owned"] == 0:
            position["cost_basis"] = Decimal("0")

    active_positions = []
    for position in positions.values():
        quantity_owned = position["quantity_owned"]
        if quantity_owned <= 0:
            continue

        cost_basis = position["cost_basis"]
        average_cost = cost_basis / quantity_owned
        current_price = current_prices.get(position["ticker"])
        market_value = None
        unrealized_gain = None
        unrealized_gain_percent = None

        if current_price is not None:
            current_price = Decimal(str(current_price))
            market_value = quantity_owned * current_price
            unrealized_gain = market_value - cost_basis
            if cost_basis != 0:
                unrealized_gain_percent = (unrealized_gain / cost_basis) * 100

        active_positions.append({
            "ticker": position["ticker"],
            "asset_name": position["asset_name"],
            "asset_type": position["asset_type"],
            "currency": position["currency"],
            "quantity_owned": decimal_to_json_number(quantity_owned, "0.000001"),
            "average_cost": decimal_to_json_number(average_cost),
            "cost_basis": decimal_to_json_number(cost_basis),
            "current_price": (
                None if current_price is None
                else decimal_to_json_number(current_price)
            ),
            "market_value": (
                None if market_value is None
                else decimal_to_json_number(market_value)
            ),
            "unrealized_gain": (
                None if unrealized_gain is None
                else decimal_to_json_number(unrealized_gain)
            ),
            "unrealized_gain_percent": (
                None if unrealized_gain_percent is None
                else decimal_to_json_number(unrealized_gain_percent)
            ),
        })

    return sorted(active_positions, key=lambda row: row["ticker"])
