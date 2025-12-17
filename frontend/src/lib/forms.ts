export const getFieldErrorMessage = (errors?: unknown[]): string | undefined => {
  if (!errors || errors.length === 0) return undefined;
  for (const entry of errors) {
    if (!entry) continue;
    if (typeof entry === "string") {
      return entry;
    }
    if (Array.isArray(entry)) {
      const nested = getFieldErrorMessage(entry as unknown[]);
      if (nested) return nested;
    } else if (typeof entry === "object") {
      const message = (entry as { message?: unknown }).message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }
  }
  return undefined;
};
