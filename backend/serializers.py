from datetime import datetime
from decimal import Decimal


def serialize_db_row(row):
    """Convert database-specific values into stable JSON-friendly strings."""
    if row is None:
        return None

    serialized = {}
    for key, value in row.items():
        if isinstance(value, datetime):
            serialized[key] = value.strftime("%Y-%m-%d %H:%M:%S")
        elif isinstance(value, Decimal):
            serialized[key] = str(value)
        else:
            serialized[key] = value
    return serialized


def decimal_to_json_number(value, places="0.01"):
    return float(value.quantize(Decimal(places)))
