export function isBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  // After refactoring, App is in the 'app' package (internal/app), not 'main'
  return Boolean((window as any)?.go?.app?.App);
}

const getRuntime = (): Record<string, any> | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as any)?.runtime;
};

export type FileDialogOptions = {
  Title?: string;
  DefaultFilename?: string;
  Filters?: { DisplayName: string; Pattern: string }[];
  CanCreateDirectories?: boolean;
  ShowHiddenFiles?: boolean;
  InitialDirectory?: string;
};

export async function openFileDialog(options?: FileDialogOptions): Promise<string | undefined> {
  const runtime = getRuntime();
  if (!runtime?.OpenFileDialog) return undefined;
  const result = await runtime.OpenFileDialog(options ?? {});
  if (!result) return undefined;
  return String(result);
}

export async function saveFileDialog(options?: FileDialogOptions): Promise<string | undefined> {
  const runtime = getRuntime();
  if (!runtime?.SaveFileDialog) return undefined;
  const result = await runtime.SaveFileDialog(options ?? {});
  if (!result) return undefined;
  return String(result);
}
