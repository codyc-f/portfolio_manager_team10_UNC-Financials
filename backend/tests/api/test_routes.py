import pytest

from app import app
from services.errors import ExternalServiceError, NotFoundError


@pytest.fixture
def client():
    app.config.update(TESTING=True)
    return app.test_client()


def test_health_route(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.text == "Welcome to UNC-Financials Portfolio Manager!"


def test_list_portfolios_returns_json(client, monkeypatch):
    monkeypatch.setattr(
        "services.portfolio_service.list_portfolios",
        lambda: [{"id": 1, "name": "Growth", "base_currency": "USD"}],
    )

    response = client.get("/api/portfolios")

    assert response.status_code == 200
    assert response.get_json()[0]["name"] == "Growth"


def test_create_portfolio_validates_payload_before_service(client):
    response = client.post("/api/portfolios", json={"name": "", "base_currency": "usd"})

    assert response.status_code == 400
    assert "error" in response.get_json()


def test_create_portfolio_returns_created_response(client, monkeypatch, portfolio_payload):
    monkeypatch.setattr(
        "services.portfolio_service.create_portfolio",
        lambda data: {"id": 7, **data, "message": "Portfolio created successfully"},
    )

    response = client.post("/api/portfolios", json=portfolio_payload)

    assert response.status_code == 201
    assert response.get_json()["id"] == 7


def test_get_portfolio_maps_service_error(client, monkeypatch):
    def raise_not_found(_portfolio_id):
        raise NotFoundError("Portfolio not found")

    monkeypatch.setattr("services.portfolio_service.get_portfolio", raise_not_found)

    response = client.get("/api/portfolios/404")

    assert response.status_code == 404
    assert response.get_json() == {"error": "Portfolio not found"}


def test_list_holdings_requires_positive_portfolio_id(client):
    response = client.get("/api/holdings?portfolio_id=0")

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "'portfolio_id' query parameter must be a positive integer"
    }


def test_create_holding_returns_created_response(client, monkeypatch, holding_payload):
    monkeypatch.setattr(
        "services.holding_service.create_holding",
        lambda data: {"id": 3, "message": "Successfully created holding"},
    )

    response = client.post("/api/holdings", json=holding_payload)

    assert response.status_code == 201
    assert response.get_json()["id"] == 3


def test_list_positions_rejects_non_numeric_id(client):
    response = client.get("/api/portfolios/not-a-number/positions")

    assert response.status_code == 400
    assert response.get_json() == {"error": "'portfolio_id' must be a positive integer"}


def test_stock_provider_errors_map_to_status_code(client, monkeypatch):
    def fail():
        raise ExternalServiceError("Provider failed")

    monkeypatch.setattr("services.stock_service.list_most_active_stocks", fail)

    response = client.get("/api/stocks/most-active")

    assert response.status_code == 502
    assert response.get_json() == {"error": "Provider failed"}
