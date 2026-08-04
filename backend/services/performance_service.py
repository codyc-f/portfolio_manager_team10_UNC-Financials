from decimal import Decimal

import mysql.connector

from db import get_connection
from market_data import get_price_history
from repositories import holding_repository, portfolio_repository
from serializers import decimal_to_json_number
from services.errors import (
    ConflictError,
    ExternalServiceError,
    NotFoundError,
    ServiceError,
)
from services.position_service import build_positions_from_transactions


def get_portfolio_performance(portfolio_id):
    """Return one month of market value for the portfolio's current positions.

    This is needed so the API can build a portfolio performance chart from the
    active holdings and historical close prices. It is used by the
    GET /api/portfolios/<portfolio_id>/performance endpoint in app.py.
    """
    try:
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                # Load the portfolio first so we can return its base currency
                portfolio = portfolio_repository.get_portfolio_by_id(
                    cursor,
                    portfolio_id,
                )
                if portfolio is None:
                    raise NotFoundError("Portfolio not found")

                # Load all transactions because performance is based on active positions
                transactions = holding_repository.list_position_transactions(
                    cursor,
                    portfolio_id,
                )
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    try:
        positions = build_positions_from_transactions(transactions)
    except ValueError as error:
        raise ConflictError(str(error)) from error

    # Return an empty chart when the portfolio has no active positions
    if not positions:
        return {
            "currency": portfolio["base_currency"],
            "period": "1mo",
            "points": [],
        }

    try:
        # Get one month of price history for each active ticker
        histories = {
            ticker: get_price_history(ticker)
            for ticker in {position["ticker"] for position in positions}
        }
    except Exception as error:
        raise ExternalServiceError(str(error)) from error

    # Use only dates that exist for every ticker so totals compare the same day
    common_dates = set.intersection(*(
        {point["date"] for point in history}
        for history in histories.values()
    ))
    # Map prices by ticker and date for quick lookup while building chart points
    prices_by_ticker = {
        ticker: {point["date"]: Decimal(str(point["close"])) for point in history}
        for ticker, history in histories.items()
    }

    points = []
    for date in sorted(common_dates):
        stock_values = []

        for position in positions:
            ticker = position["ticker"]
            # Convert quantity back to Decimal before multiplying by market prices
            quantity = Decimal(str(position["quantity_owned"]))
            closing_price = prices_by_ticker[ticker][date]
            # Position value is shares owned times that day's closing price
            position_value = quantity * closing_price

            stock_values.append({
                "ticker": ticker,
                "asset_name": position["asset_name"],
                "currency": position["currency"],
                "quantity": decimal_to_json_number(quantity),
                "close": decimal_to_json_number(closing_price),
                "value": decimal_to_json_number(position_value),
            })

        # Sum every stock value to get the total portfolio value for the date
        total_value = sum(
            Decimal(str(stock["value"]))
            for stock in stock_values
        )

        # Store one chart point with total value and per-stock breakdown
        points.append({
            "date": date,
            "value": decimal_to_json_number(total_value),
            "stock_values": stock_values,
        })

    # Return chart metadata and all calculated performance points
    return {
        "currency": portfolio["base_currency"],
        "period": "1mo",
        "points": points,
    }
