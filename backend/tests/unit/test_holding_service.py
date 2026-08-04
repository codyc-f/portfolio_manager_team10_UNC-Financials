from services import holding_service
from tests.conftest import position_row as row


class FakeCursor:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class FakeConnection:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self, **_kwargs):
        return FakeCursor()


def test_list_positions_uses_position_currency_for_current_price(monkeypatch):
    connection = FakeConnection()
    price_requests = []

    monkeypatch.setattr(holding_service, "get_connection", lambda: connection)
    monkeypatch.setattr(
        holding_service.portfolio_repository,
        "portfolio_exists",
        lambda _cursor, _portfolio_id: True,
    )
    monkeypatch.setattr(
        holding_service.holding_repository,
        "list_position_transactions",
        lambda _cursor, _portfolio_id: [
            row(
                ticker="INTC",
                currency="CAD",
                quantity="10",
                price_per_unit="140.55",
                asset_name="Intel Corporation",
            )
        ],
    )

    def converted_price(ticker, currency):
        price_requests.append((ticker, currency))
        return 135

    monkeypatch.setattr(
        holding_service,
        "get_current_price_in_currency",
        converted_price,
    )
    monkeypatch.setattr(
        holding_service,
        "get_company_logo_url",
        lambda _ticker: None,
    )

    positions = holding_service.list_positions(1)

    assert price_requests == [("INTC", "CAD")]
    assert positions[0]["currency"] == "CAD"
    assert positions[0]["current_price"] == 135
    assert positions[0]["market_value"] == 1350
