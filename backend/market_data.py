import yfinance as yf


def get_current_price(ticker):
    """Return the latest available market price for a ticker."""
    ticker = ticker.strip().upper()
    stock = yf.Ticker(ticker)

    # Try yfinance's latest price first
    current_price = stock.fast_info.get("last_price")

    # Fall back to the most recent market price
    if current_price is None:
        price_history = stock.history(period="5d")

        if price_history.empty:
            raise ValueError(f"No market price found for {ticker}")

        current_price = price_history["Close"].iloc[-1]

    return round(float(current_price), 2)


def get_top_20_stocks():
    """Return information about the 20 most actively traded US stocks."""
    response = yf.screen("most_actives", count=20)

    return [
        {
            "ticker": stock.get("symbol"),
            "name": stock.get("shortName", stock.get("longName")),
            "currentPrice": stock.get("regularMarketPrice")
        }
        for stock in response["quotes"]
        if stock.get("symbol")
    ]
