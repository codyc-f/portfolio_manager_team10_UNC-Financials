from decimal import Decimal

from serializers import decimal_to_json_number


def build_positions_from_transactions(transactions, current_prices=None):
    """Build active positions from transaction rows using average cost basis.

    This is needed because positions are not stored directly in the database.
    It is used by holding_service, portfolio_service, and performance_service
    whenever they need current shares owned, cost basis, or unrealized gain.
    """
    current_prices = current_prices or {}
    # Map to hold running position state, keyed by unique (ticker, currency) pairs
    positions = {}

    for transaction in transactions:
        # Group transactions by ticker and currency so the same ticker in
        # different currencies is treated as a separate position
        key = (transaction["ticker"], transaction["currency"])
        position = positions.setdefault(
            key,
            {
                "ticker": transaction["ticker"],
                "asset_name": transaction["asset_name"],
                "asset_type": transaction["asset_type"],
                "currency": transaction["currency"],
                # The quantity of the asset currently owned
                "quantity_owned": Decimal("0"),
                "cost_basis": Decimal("0"),
            },
        )
        # Convert numerical fields to Decimal via string representation to preserve precision
        quantity = Decimal(str(transaction["quantity"]))
        price_per_unit = Decimal(str(transaction["price_per_unit"]))
        fee_amount = Decimal(str(transaction["fee_amount"]))

        # BUY TRANSACTION LOGIC
        if transaction["trade_type"] == "BUY":
            # Keep the most recent asset details in case they changed between rows
            position["asset_name"] = transaction["asset_name"]
            position["asset_type"] = transaction["asset_type"]
            # Add purchased units to the quantity currently owned
            position["quantity_owned"] += quantity
            # Increase total cost basis: Total Purchase Amount + Transaction Fees
            position["cost_basis"] += (quantity * price_per_unit) + fee_amount
            continue

        # SELL TRANSACTION LOGIC

        # Prevent selling more units than currently held in the portfolio
        if position["quantity_owned"] < quantity:
            raise ValueError(
                f"Oversold position for {transaction['ticker']} "
                f"{transaction['currency']}"
            )

        # Use average cost basis to remove the sold shares from the open position.
        # The sell price is not used here because this function does not calculate
        # realized gain/loss; it only calculates the remaining active position.
        average_cost = position["cost_basis"] / position["quantity_owned"]
        position["quantity_owned"] -= quantity
        position["cost_basis"] -= average_cost * quantity

        # Reset cost basis to zero when every share has been sold
        if position["quantity_owned"] == 0:
            position["cost_basis"] = Decimal("0")

    active_positions = []
    for position in positions.values():
        quantity_owned = position["quantity_owned"]
        # Skip positions that have been fully sold
        if quantity_owned <= 0:
            continue

        # Calculate average cost for the shares still currently owned
        cost_basis = position["cost_basis"]
        average_cost = cost_basis / quantity_owned
        current_price = current_prices.get(position["ticker"])
        market_value = None
        unrealized_gain = None
        unrealized_gain_percent = None

        if current_price is not None:
            # Use current market price to value the remaining shares
            current_price = Decimal(str(current_price))
            market_value = quantity_owned * current_price
            # Unrealized gain/loss only applies to shares still owned
            unrealized_gain = market_value - cost_basis
            if cost_basis != 0:
                unrealized_gain_percent = (unrealized_gain / cost_basis) * 100

        # Convert Decimal values into JSON-friendly numbers before returning
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
