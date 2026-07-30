from datetime import datetime
from decimal import Decimal, InvalidOperation


HOLDING_REQUIRED_FIELDS = {
    "portfolio_id",
    "ticker",
    "asset_name",
    "asset_type",
    "currency",
    "trade_type",
    "quantity",
    "price_per_unit",
    "traded_at",
}


def is_non_empty_string(value, max_length):
    return (
        isinstance(value, str)
        and bool(value.strip())
        and len(value) <= max_length
    )


def is_currency_code(value):
    return (
        isinstance(value, str)
        and len(value) == 3
        and value.isalpha()
        and value.isupper()
    )


def is_number_in_range(value, minimum, maximum=None):
    if isinstance(value, bool):
        return False

    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return False

    if not number.is_finite() or number < Decimal(str(minimum)):
        return False

    return maximum is None or number <= Decimal(str(maximum))


def is_mysql_datetime(value):
    if not isinstance(value, str):
        return False

    try:
        datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return False

    return True


def validate_holding_payload(data):
    """Return a validation error string, or ``None`` for a valid holding."""
    if not isinstance(data, dict):
        return "Request body must be a JSON object"

    missing_fields = HOLDING_REQUIRED_FIELDS - set(data.keys())
    if missing_fields:
        return f"Missing required fields: {', '.join(sorted(missing_fields))}"

    if (
        isinstance(data["portfolio_id"], bool)
        or not isinstance(data["portfolio_id"], int)
        or data["portfolio_id"] <= 0
    ):
        return "'portfolio_id' must be a positive integer"

    text_field_limits = {
        "ticker": 20,
        "asset_name": 255,
        "asset_type": 50,
    }
    for field, max_length in text_field_limits.items():
        if not is_non_empty_string(data[field], max_length):
            return (
                f"'{field}' must be a non-empty string "
                f"of at most {max_length} characters"
            )

    if not is_currency_code(data["currency"]):
        return "'currency' must be a 3-letter uppercase currency code"

    if data["trade_type"] not in {"BUY", "SELL"}:
        return "'trade_type' must be either 'BUY' or 'SELL'"

    if not is_number_in_range(data["quantity"], 0.000001):
        return "'quantity' must be a number greater than zero"

    if not is_number_in_range(data["price_per_unit"], 0):
        return "'price_per_unit' must be a non-negative number"

    if not is_number_in_range(data.get("fee_amount", 0), 0):
        return "'fee_amount' must be a non-negative number"

    if not is_mysql_datetime(data["traded_at"]):
        return "'traded_at' must use YYYY-MM-DD HH:MM:SS format"

    return None


def validate_portfolio_payload(data):
    """Return a validation error string, or ``None`` for a valid portfolio."""
    if not isinstance(data, dict):
        return "Request body must be a JSON object"

    if "name" not in data or "base_currency" not in data:
        return "Missing required fields: 'name' and 'base_currency'"

    if not is_non_empty_string(data["name"], 255):
        return "'name' must be a non-empty string of at most 255 characters"

    if not is_currency_code(data["base_currency"]):
        return "'base_currency' must be a 3-letter uppercase currency code"

    if not is_number_in_range(data.get("balance", 0), 0):
        return "'balance' must be a non-negative number"

    return None
