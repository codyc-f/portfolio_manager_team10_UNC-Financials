class ServiceError(Exception):
    # Default service error maps to HTTP 500
    status_code = 500

    def __init__(self, message):
        # Store message so route handlers can return it in the API response
        super().__init__(message)
        self.message = message


class NotFoundError(ServiceError):
    # Resource was not found
    status_code = 404


class ConflictError(ServiceError):
    # Request conflicts with current portfolio state
    status_code = 409


class BadRequestError(ServiceError):
    # Request data is invalid for this operation
    status_code = 400


class ExternalServiceError(ServiceError):
    # External market data provider failed
    status_code = 502
