from services.errors import (
    BadRequestError,
    ConflictError,
    ExternalServiceError,
    NotFoundError,
    ServiceError,
)


def test_service_error_defaults_to_500():
    error = ServiceError("Database failed")

    assert error.message == "Database failed"
    assert error.status_code == 500


def test_domain_errors_have_expected_status_codes():
    assert BadRequestError("bad").status_code == 400
    assert NotFoundError("missing").status_code == 404
    assert ConflictError("conflict").status_code == 409
    assert ExternalServiceError("provider down").status_code == 502
