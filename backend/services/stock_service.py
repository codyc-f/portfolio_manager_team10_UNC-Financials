from market_data import get_current_price, get_top_20_stocks
from services.errors import BadRequestError, ExternalServiceError


def list_most_active_stocks():
    try:
        return get_top_20_stocks()
    except Exception as error:
        raise ExternalServiceError("Unable to load most active stocks") from error


def get_stock_price(ticker):
    ticker = ticker.strip().upper()
    if not ticker or len(ticker) > 20:
        raise BadRequestError("'ticker' must be 1 to 20 characters")

    try:
        current_price = get_current_price(ticker)
    except Exception as error:
        raise ExternalServiceError(str(error)) from error

    return {
        "ticker": ticker,
        "current_price": current_price,
    }
