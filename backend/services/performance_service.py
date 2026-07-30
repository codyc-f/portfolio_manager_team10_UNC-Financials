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
    """Return one month of market value for the portfolio's current positions."""
    try:
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                portfolio = portfolio_repository.get_portfolio_by_id(
                    cursor,
                    portfolio_id,
                )
                if portfolio is None:
                    raise NotFoundError("Portfolio not found")

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

    if not positions:
        return {
            "currency": portfolio["base_currency"],
            "period": "1mo",
            "points": [],
        }

    try:
        histories = {
            ticker: get_price_history(ticker)
            for ticker in {position["ticker"] for position in positions}
        }
    except Exception as error:
        raise ExternalServiceError(str(error)) from error

    common_dates = set.intersection(*(
        {point["date"] for point in history}
        for history in histories.values()
    ))
    prices_by_ticker = {
        ticker: {point["date"]: Decimal(str(point["close"])) for point in history}
        for ticker, history in histories.items()
    }

    points = []
    for date in sorted(common_dates):
        value = sum(
            Decimal(str(position["quantity_owned"]))
            * prices_by_ticker[position["ticker"]][date]
            for position in positions
        )
        points.append({
            "date": date,
            "value": decimal_to_json_number(value),
        })

    return {
        "currency": portfolio["base_currency"],
        "period": "1mo",
        "points": points,
    }
