class ServiceError(Exception):
    """Base error for service-layer failures.

    This is needed so app.py can catch service errors and return the matching
    HTTP status code and message in API responses.
    """
    # Default service error maps to HTTP 500
    status_code = 500

    def __init__(self, message):
        """Store the error message for API responses.

        This is used whenever a service raises a ServiceError or one of its
        subclasses and app.py returns error.message to the client.
        """
        # Store message so route handlers can return it in the API response
        super().__init__(message)
        self.message = message


class NotFoundError(ServiceError):
    """Error for missing database records.

    This is needed when a requested portfolio or holding does not exist. It is
    used by service functions that look up records by id before returning them.
    """
    # Resource was not found
    status_code = 404


class ConflictError(ServiceError):
    """Error for requests that conflict with current portfolio state.

    This is needed when a request cannot safely continue, such as deleting a
    portfolio that still has active positions.
    """
    # Request conflicts with current portfolio state
    status_code = 409


class BadRequestError(ServiceError):
    """Error for invalid request data.

    This is needed when the request is syntactically valid JSON but the operation
    is not allowed, such as selling more shares than owned.
    """
    # Request data is invalid for this operation
    status_code = 400


class ExternalServiceError(ServiceError):
    """Error for market data provider failures.

    This is needed when the app cannot load prices, stock details, logos, or
    news from the external market data functions.
    """
    # External market data provider failed
    status_code = 502
