export class BadRequestError extends Error {
  status = 400;
  constructor(m = "Bad Request") {
    super(m);
  }
}
