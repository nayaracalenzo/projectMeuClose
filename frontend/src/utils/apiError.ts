type ApiLikeError = {
  name?: string;
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
};

export const DEFAULT_UNEXPECTED_ERROR_MESSAGE =
  "Ocorreu um erro inesperado. Tente novamente e, se persistir, nos comunique.";

export function getUserFacingApiErrorMessage(
  error: unknown,
  fallbackMessage = DEFAULT_UNEXPECTED_ERROR_MESSAGE,
) {
  const maybeAxiosError = error as ApiLikeError;
  const errorName = maybeAxiosError.name;
  const directMessage = maybeAxiosError.message;
  const status = maybeAxiosError.response?.status;
  const message = maybeAxiosError.response?.data?.message;

  if (maybeAxiosError.name === "MutationInProgressError" && maybeAxiosError.message) {
    return maybeAxiosError.message;
  }

  if (status && status >= 400 && status < 500 && status !== 404 && message) {
    return message;
  }

  return fallbackMessage;
}
