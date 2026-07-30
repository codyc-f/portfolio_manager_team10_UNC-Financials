class ServiceError(Exception):
    status_code = 500

    def __init__(self, message):
        super().__init__(message)
        self.message = message


class NotFoundError(ServiceError):
    status_code = 404


class ConflictError(ServiceError):
    status_code = 409


class BadRequestError(ServiceError):
    status_code = 400


class ExternalServiceError(ServiceError):
    status_code = 502
