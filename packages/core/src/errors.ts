export class ScrubEnvironmentError extends Error {
  constructor(format: string) {
    super(`${format} scrubbing requires a browser environment (canvas or HEIC decoder unavailable)`);
    this.name = "ScrubEnvironmentError";
  }
}

export class UnsupportedFormatError extends Error {
  constructor(name: string, mime: string) {
    super(`Unsupported format for in-browser scrub: ${mime || name}`);
    this.name = "UnsupportedFormatError";
  }
}

export class ScrubValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrubValidationError";
  }
}
