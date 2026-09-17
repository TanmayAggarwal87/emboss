export class DiagramProcessingError extends Error {
  constructor(readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DiagramProcessingError";
  }
}

export class DiagramValidationError extends DiagramProcessingError {
  constructor(message: string) {
    super("DIAGRAM_VALIDATION_FAILED", message);
    this.name = "DiagramValidationError";
  }
}
