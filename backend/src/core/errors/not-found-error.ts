export class NotFoundError extends Error {
  status = 404;
  constructor(m: string) {
    super(m);
  }
}
