export class TextProcessingError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "TextProcessingError";
  }
}
