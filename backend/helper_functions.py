import yfinance as yf

def get_required_fields(db, database_name, table_name):
    """Return columns that must be provided when inserting into a table."""
    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s
          AND TABLE_NAME = %s
          AND IS_NULLABLE = 'NO'
          AND COLUMN_DEFAULT IS NULL
          AND EXTRA NOT LIKE '%%auto_increment%%'
          AND EXTRA NOT LIKE '%%DEFAULT_GENERATED%%'
    """

    cursor.execute(sql, (database_name, table_name))
    fields = {row["COLUMN_NAME"] for row in cursor.fetchall()}
    cursor.close()

    return fields


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

#print(get_current_price("AAPL"))


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

#print(get_top_20_stocks())