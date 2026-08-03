from decimal import Decimal

import mysql.connector

from db import get_connection
from market_data import get_company_logo_url, get_current_price
from repositories import holding_repository, portfolio_repository
from serializers import serialize_db_row
from services.errors import (
    BadRequestError,
    ExternalServiceError,
    ConflictError,
    NotFoundError,
    ServiceError,
)
from services.position_service import build_positions_from_transactions


def list_holdings(portfolio_id):
    try:
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                if not portfolio_repository.portfolio_exists(
                    cursor,
                    portfolio_id,
                ):
                    raise NotFoundError("Portfolio not found")

                holdings = holding_repository.list_holdings_for_portfolio(
                    cursor,
                    portfolio_id,
                )
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    return [serialize_db_row(row) for row in holdings]


def list_positions(portfolio_id):
    try:
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                if not portfolio_repository.portfolio_exists(
                    cursor,
                    portfolio_id,
                ):
                    raise NotFoundError("Portfolio not found")

                transactions = holding_repository.list_position_transactions(
                    cursor,
                    portfolio_id,
                )
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    try:
        positions_without_prices = build_positions_from_transactions(transactions)
    except ValueError as error:
        raise ConflictError(str(error)) from error

    tickers = [position["ticker"] for position in positions_without_prices]
    current_prices = {}
    try:
        for ticker in tickers:
            current_prices[ticker] = get_current_price(ticker)
    except Exception as error:
        raise ExternalServiceError(str(error)) from error

    positions = build_positions_from_transactions(transactions, current_prices)
    for position in positions:
        try:
            position["logo_url"] = get_company_logo_url(position["ticker"])
        except Exception:
            position["logo_url"] = None

    return positions


def create_holding(data):
    quantity = Decimal(str(data["quantity"]))
    price_per_unit = Decimal(str(data["price_per_unit"]))
    fee_amount = Decimal(str(data.get("fee_amount", 0.00)))
    trade_value = quantity * price_per_unit
    balance_delta = (
        -(trade_value + fee_amount)
        if data["trade_type"] == "BUY"
        else trade_value - fee_amount
    )

    try:
        with get_connection() as connection:
            try:
                with connection.cursor(dictionary=True) as cursor:
                    portfolio = portfolio_repository.get_portfolio_balance(
                        cursor,
                        data["portfolio_id"],
                    )
                    if portfolio is None:
                        raise NotFoundError("Portfolio not found")

                    next_balance = portfolio["balance"] + balance_delta
                    if next_balance < 0:
                        raise BadRequestError(
                            "Insufficient portfolio balance for this BUY"
                        )

                    if data["trade_type"] == "SELL":
                        _ensure_enough_shares_to_sell(cursor, data, quantity)

                    holding_id = holding_repository.create_holding(cursor, data)
                    portfolio_repository.update_portfolio_balance(
                        cursor,
                        data["portfolio_id"],
                        next_balance.quantize(Decimal("0.01")),
                    )
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    return {
        "id": holding_id,
        "portfolio_balance": str(next_balance.quantize(Decimal("0.01"))),
        "message": (
            "Successfully created holding with holding_id "
            f"{holding_id} & portfolio_id {data['portfolio_id']}"
        ),
    }


def get_holding(holding_id):
    try:
        with get_connection() as connection:
            try:
                with connection.cursor(dictionary=True) as cursor:
                    holding = holding_repository.get_holding_by_id(
                        cursor,
                        holding_id,
                    )
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    if holding is None:
        raise NotFoundError("Holding not found")

    return serialize_db_row(holding)


def update_holding(holding_id, data):
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    if not holding_repository.holding_exists(cursor, holding_id):
                        raise NotFoundError("Holding not found")

                    if not portfolio_repository.portfolio_exists(
                        cursor,
                        data["portfolio_id"],
                    ):
                        raise NotFoundError("Portfolio not found")

                    holding_repository.update_holding(cursor, holding_id, data)
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    return {
        "id": int(holding_id),
        "message": "Holding updated successfully",
    }


def delete_holding(holding_id):
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    deleted = holding_repository.delete_holding(
                        cursor,
                        holding_id,
                    )
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    if not deleted:
        raise NotFoundError("Holding not found")

    return {"message": f"Successfully deleted holding with id {holding_id}"}


def _ensure_enough_shares_to_sell(cursor, data, quantity):
    transactions = holding_repository.list_position_transactions_for_asset(
        cursor,
        data["portfolio_id"],
        data["ticker"],
        data["currency"],
    )
    current_positions = build_positions_from_transactions(transactions)
    current_position = next(
        (
            position for position in current_positions
            if (
                position["ticker"] == data["ticker"]
                and position["currency"] == data["currency"]
            )
        ),
        None,
    )
    quantity_owned = (
        Decimal(str(current_position["quantity_owned"]))
        if current_position else Decimal("0")
    )
    if quantity_owned < quantity:
        raise BadRequestError("Cannot sell more shares than owned")
