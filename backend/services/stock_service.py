from market_data import (
    get_current_price_in_currency,
    get_market_news,
    get_stock_details,
    get_top_20_stocks,
)
from services.errors import BadRequestError, ExternalServiceError


def list_most_active_stocks():
    try:
        return get_top_20_stocks()
    except Exception as error:
        raise ExternalServiceError("Unable to load most active stocks") from error


def get_stock_price(ticker, currency="USD"):
    ticker = ticker.strip().upper()
    currency = currency.strip().upper()

    if not ticker or len(ticker) > 20:
        raise BadRequestError("'ticker' must be 1 to 20 characters")

    if len(currency) != 3 or not currency.isalpha():
        raise BadRequestError("'currency' must be a three-letter currency code")

    try:
        stock_details = get_stock_details(ticker)
        converted_price = get_current_price_in_currency(ticker, currency)

        stock_details["current_price"] = float(converted_price)
        stock_details["currency"] = currency

        return stock_details
    except Exception as error:
        raise ExternalServiceError(str(error)) from error

def list_market_news():
    try:
        return get_market_news()
    except Exception as error:
        raise ExternalServiceError("Unable to load market news") from error
