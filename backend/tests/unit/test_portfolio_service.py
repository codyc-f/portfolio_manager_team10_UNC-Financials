import pytest

from services.errors import ConflictError, NotFoundError
from services import portfolio_service
from tests.conftest import position_row as row


class FakeCursor:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class FakeConnection:
    def __init__(self):
        self.committed = False
        self.rolled_back = False

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self, **_kwargs):
        return FakeCursor()

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


def test_delete_portfolio_removes_closed_transaction_history(monkeypatch):
    connection = FakeConnection()
    deleted_holdings_for = []
    deleted_portfolios = []

    monkeypatch.setattr(portfolio_service, "get_connection", lambda: connection)
    monkeypatch.setattr(
        portfolio_service.portfolio_repository,
        "portfolio_exists",
        lambda _cursor, _portfolio_id: True,
    )
    monkeypatch.setattr(
        portfolio_service.holding_repository,
        "list_position_transactions",
        lambda _cursor, _portfolio_id: [
            row(quantity="10", price_per_unit="100"),
            row(trade_type="SELL", quantity="10", price_per_unit="125"),
        ],
    )

    def delete_holdings(_cursor, portfolio_id):
        deleted_holdings_for.append(portfolio_id)
        return 2

    def delete_portfolio(_cursor, portfolio_id):
        deleted_portfolios.append(portfolio_id)
        return True

    monkeypatch.setattr(
        portfolio_service.holding_repository,
        "delete_holdings_for_portfolio",
        delete_holdings,
    )
    monkeypatch.setattr(
        portfolio_service.portfolio_repository,
        "delete_portfolio",
        delete_portfolio,
    )

    result = portfolio_service.delete_portfolio(7)

    assert result == {"message": "Successfully deleted portfolio with id 7"}
    assert deleted_holdings_for == [7]
    assert deleted_portfolios == [7]
    assert connection.committed is True


def test_delete_portfolio_blocks_active_positions(monkeypatch):
    connection = FakeConnection()

    monkeypatch.setattr(portfolio_service, "get_connection", lambda: connection)
    monkeypatch.setattr(
        portfolio_service.portfolio_repository,
        "portfolio_exists",
        lambda _cursor, _portfolio_id: True,
    )
    monkeypatch.setattr(
        portfolio_service.holding_repository,
        "list_position_transactions",
        lambda _cursor, _portfolio_id: [row(quantity="1", price_per_unit="100")],
    )

    with pytest.raises(ConflictError, match="active positions"):
        portfolio_service.delete_portfolio(7)

    assert connection.committed is False


def test_delete_portfolio_raises_not_found_before_delete(monkeypatch):
    connection = FakeConnection()

    monkeypatch.setattr(portfolio_service, "get_connection", lambda: connection)
    monkeypatch.setattr(
        portfolio_service.portfolio_repository,
        "portfolio_exists",
        lambda _cursor, _portfolio_id: False,
    )

    with pytest.raises(NotFoundError, match="Portfolio not found"):
        portfolio_service.delete_portfolio(404)

    assert connection.committed is False
