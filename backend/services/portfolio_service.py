from decimal import Decimal

import mysql.connector

from db import get_connection
from repositories import holding_repository, portfolio_repository
from serializers import serialize_db_row
from services.errors import ConflictError, NotFoundError, ServiceError
from services.position_service import build_positions_from_transactions


def list_portfolios():
    """Return every portfolio saved in the database.

    This is needed so the API can show the user's portfolio list. It is used by
    the GET /api/portfolios endpoint in app.py.
    """
    try:
        # Open database connection and read every portfolio row
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                portfolios = portfolio_repository.list_portfolios(cursor)
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    return [serialize_db_row(row) for row in portfolios]


def create_portfolio(data):
    """Create a new portfolio record.

    This is needed so users can start tracking cash and holdings under a
    portfolio. It is used by the POST /api/portfolios endpoint in app.py.
    """
    # Pull validated request fields from the incoming data
    name = data["name"]
    base_currency = data["base_currency"]
    balance = data.get("balance", 0.00)

    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    # Insert the portfolio and commit only if the insert succeeds
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

    # Return the new portfolio details in the same shape as the API response
    return {
        "id": portfolio_id,
        "name": name.strip(),
        "base_currency": base_currency,
        "balance": str(Decimal(str(balance)).quantize(Decimal("0.01"))),
        "message": "Portfolio created successfully",
    }


def get_portfolio(portfolio_id):
    """Return one portfolio by id.

    This is needed so the API can show details for a specific portfolio. It is
    used by the GET /api/portfolios/<portfolio_id> endpoint in app.py.
    """
    try:
        with get_connection() as connection:
            try:
                with connection.cursor(dictionary=True) as cursor:
                    # Look up one portfolio by its primary key
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

    # Convert database values into JSON-friendly values before returning
    return serialize_db_row(portfolio)


def update_portfolio(portfolio_id, data):
    """Update one existing portfolio.

    This is needed so portfolio details like name, base currency, or balance can
    be corrected. It is used by the PUT /api/portfolios/<portfolio_id> endpoint
    in app.py.
    """
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    # Confirm the portfolio exists before trying to update it
                    if not portfolio_repository.portfolio_exists(
                        cursor,
                        portfolio_id,
                    ):
                        raise NotFoundError("Portfolio not found")

                    # Update the stored portfolio details and save the transaction
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

    # Return the updated values using the same rounding as portfolio creation
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
    """Delete a portfolio when it has no active positions.

    This is needed so empty portfolios can be removed without deleting shares
    that are still owned. It is used by the DELETE /api/portfolios/<portfolio_id>
    endpoint in app.py.
    """
    try:
        with get_connection() as connection:
            try:
                with connection.cursor(dictionary=True) as cursor:
                    # Confirm the portfolio exists before trying to delete it
                    if not portfolio_repository.portfolio_exists(
                        cursor,
                        portfolio_id,
                    ):
                        raise NotFoundError("Portfolio not found")

                    # Load transaction history to check whether shares are still owned
                    transactions = holding_repository.list_position_transactions(
                        cursor,
                        portfolio_id,
                    )
                    try:
                        # Build active positions from all transactions in the portfolio
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

                    # Delete holdings first so the portfolio can be removed cleanly
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
