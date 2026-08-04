from market_data import (
    get_current_price_in_currency,
    get_market_news,
    get_stock_details,
    get_top_20_stocks,
)
from services.errors import BadRequestError, ExternalServiceError


def list_most_active_stocks():
    """Return the most active stocks from the market data provider.

    This is needed so the API can show popular stocks users may want to inspect.
    It is used by the GET /api/stocks/most-active endpoint in app.py.
    """
    try:
        # Load most active stocks from the market data provider
        return get_top_20_stocks()
    except Exception as error:
        raise ExternalServiceError("Unable to load most active stocks") from error


def get_stock_price(ticker, currency="USD"):
    """Return stock details and current price for one ticker and currency.

    This is needed so the API can show a ticker's latest market data before a
    user records a trade. It is used by the GET /api/stocks/<ticker>/price
    endpoint in app.py.
    """
    # Clean user input before sending it to the market data provider
    ticker = ticker.strip().upper()
    currency = currency.strip().upper()

    # Reject missing or unreasonably long ticker symbols
    if not ticker or len(ticker) > 20:
        raise BadRequestError("'ticker' must be 1 to 20 characters")

    if len(currency) != 3 or not currency.isalpha():
        raise BadRequestError("'currency' must be a three-letter currency code")

    try:
        # Load current stock details for the requested ticker
        stock_details = get_stock_details(ticker)
        converted_price = get_current_price_in_currency(ticker, currency)

        stock_details["current_price"] = float(converted_price)
        stock_details["currency"] = currency

        return stock_details
    except Exception as error:
        raise ExternalServiceError(str(error)) from error


def list_market_news():
    """Return recent general market news.

    This is needed so the API can show market headlines in the app. It is used
    by the GET /api/stocks/news endpoint in app.py.
    """
    try:
        # Load latest market news from the market data provider
        return get_market_news()
    except Exception as error:
        raise ExternalServiceError("Unable to load market news") from error
