export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type Result<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
