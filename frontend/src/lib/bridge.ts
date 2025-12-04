export function isBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false
  // Wails injects window.go.main.App runtime hooks
  return Boolean((window as any)?.go?.main?.App)
}
