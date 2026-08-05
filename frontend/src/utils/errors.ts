import { ApiError } from "../api";

export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}
