/** Readable message for an unknown thrown value, with a fallback for non-Error values. */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
