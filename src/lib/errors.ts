/** A problem with what someone typed. Its message is shown to them as-is. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}
