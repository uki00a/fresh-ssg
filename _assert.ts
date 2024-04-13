export function assert(
  expr: boolean,
  message = "Assertion failed",
): asserts expr {
  if (!expr) {
    throw new Error("[fresh-ssg] " + message);
  }
}
