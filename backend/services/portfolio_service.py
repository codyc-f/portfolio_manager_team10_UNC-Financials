from decimal import Decimal

import mysql.connector

from db import get_connection
from repositories import holding_repository, portfolio_repository
from serializers import serialize_db_row
from services.errors import ConflictError, NotFoundError, ServiceError
from services.position_service import build_positions_from_transactions


def list_portfolios():
    try:
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                portfolios = portfolio_repository.list_portfolios(cursor)
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    return [serialize_db_row(row) for row in portfolios]


def create_portfolio(data):
    name = data["name"]
    base_currency = data["base_currency"]
    balance = data.get("balance", 0.00)

    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    portfolio_id = portfolio_repository.create_portfolio(
                        cursor,
                        name,
                        base_currency,
                        balance,
                    )
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    return {
        "id": portfolio_id,
        "name": name.strip(),
        "base_currency": base_currency,
        "balance": str(Decimal(str(balance)).quantize(Decimal("0.01"))),
        "message": "Portfolio created successfully",
    }


def get_portfolio(portfolio_id):
    try:
        with get_connection() as connection:
            try:
                with connection.cursor(dictionary=True) as cursor:
                    portfolio = portfolio_repository.get_portfolio_by_id(
                        cursor,
                        portfolio_id,
                    )
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    if portfolio is None:
        raise NotFoundError("Portfolio not found")

    return serialize_db_row(portfolio)


def update_portfolio(portfolio_id, data):
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    if not portfolio_repository.portfolio_exists(
                        cursor,
                        portfolio_id,
                    ):
                        raise NotFoundError("Portfolio not found")

                    portfolio_repository.update_portfolio(
                        cursor,
                        portfolio_id,
                        data["name"].strip(),
                        data["base_currency"],
                        data.get("balance", 0.00),
                    )
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    return {
        "id": int(portfolio_id),
        "name": data["name"].strip(),
        "base_currency": data["base_currency"],
        "balance": str(
            Decimal(str(data.get("balance", 0.00))).quantize(Decimal("0.01"))
        ),
        "message": "Portfolio updated successfully",
    }


def delete_portfolio(portfolio_id):
    try:
        with get_connection() as connection:
            try:
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
                    try:
                        active_positions = build_positions_from_transactions(
                            transactions,
                        )
                    except ValueError as error:
                        raise ConflictError(str(error)) from error
                    if active_positions:
                        raise ConflictError(
                            "Portfolio cannot be deleted while it contains "
                            "active positions"
                        )

                    holding_repository.delete_holdings_for_portfolio(
                        cursor,
                        portfolio_id,
                    )
                    portfolio_repository.delete_portfolio(
                        cursor,
                        portfolio_id,
                    )
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    return {
        "message": f"Successfully deleted portfolio with id {portfolio_id}"
    }
