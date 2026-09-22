export class UploadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "UploadError";
  }
}

export class ClassificationValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ClassificationValidationError";
  }
}

export class ClassificationServiceError extends Error {
  constructor(message: string, options?: ErrorOptions, readonly httpStatus?: number) {
    super(message, options);
    this.name = "ClassificationServiceError";
  }
}
