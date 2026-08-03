from market_data import get_market_news, get_top_20_stocks, get_stock_details
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
        return get_stock_details(ticker)
    except Exception as error:
        raise ExternalServiceError(str(error)) from error


def list_market_news():
    try:
        return get_market_news()
    except Exception as error:
        raise ExternalServiceError("Unable to load market news") from error
