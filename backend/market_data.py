from datetime import datetime, timezone
from functools import lru_cache

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


@lru_cache(maxsize=256)
def get_company_logo_url(ticker):
    """Return Yahoo's company logo URL when one is available."""
    ticker = ticker.strip().upper()
    info = yf.Ticker(ticker).get_info()
    return info.get("logoUrl") or info.get("logo_url") or None


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


def get_price_history(ticker, period="1mo"):
    """Return daily closing prices from the existing Yahoo integration."""
    ticker = ticker.strip().upper()
    history = yf.Ticker(ticker).history(
        period=period,
        interval="1d",
        auto_adjust=False,
    )

    if history.empty:
        raise ValueError(f"No price history found for {ticker}")

    points = []
    for timestamp, row in history.iterrows():
        close = row.get("Close")
        if close is None or close != close:
            continue
        points.append({
            "date": timestamp.date().isoformat(),
            "close": round(float(close), 2),
        })

    if not points:
        raise ValueError(f"No closing prices found for {ticker}")

    return points


def get_market_news(count=6):
    """Return a small general-market news feed from Yahoo Finance."""
    response = yf.Search("stock market investing", news_count=count)
    articles = []

    for item in response.news[:count]:
        content = item.get("content") or {}
        provider = content.get("provider") or {}
        canonical_url = content.get("canonicalUrl") or {}
        click_url = content.get("clickThroughUrl") or {}
        thumbnail = item.get("thumbnail") or content.get("thumbnail") or {}
        thumbnail_resolutions = thumbnail.get("resolutions") or []
        image_url = next(
            (
                resolution.get("url")
                for resolution in reversed(thumbnail_resolutions)
                if resolution.get("url")
            ),
            None,
        )
        published_at = item.get("providerPublishTime")
        if published_at:
            published_at = datetime.fromtimestamp(
                published_at,
                tz=timezone.utc,
            ).isoformat()
        else:
            published_at = content.get("pubDate")

        link = (
            item.get("link")
            or click_url.get("url")
            or canonical_url.get("url")
        )
        title = item.get("title") or content.get("title")
        if not title or not link:
            continue

        articles.append({
            "headline": title,
            "publisher": (
                item.get("publisher")
                or provider.get("displayName")
                or "Yahoo Finance"
            ),
            "published_at": published_at,
            "description": (
                item.get("summary")
                or item.get("description")
                or content.get("summary")
                or content.get("description")
            ),
            "image_url": image_url,
            "url": link,
        })

    return articles
