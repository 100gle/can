# Sprint 17 Implementation Plan: Unified Wails Logging

## 1. Goal
Implement a robust, unified logging infrastructure that captures both Backend (Go) and Frontend (JS/React) logs into a single, rotating file system. This ensures better debuggability for user issues in production.

## 2. Core Features

### 2.1 Backend Logging (Go)
- **Log Rotation**: Use `lumberjack` to manage log file size and rotation (e.g., 10MB max size, keep 5 files).
- **Log Location**: Store logs in the Operating System's standard application data directory (e.g., `~/.config/can/logs` or `%APPDATA%/can/logs`).
- **Structured Output**: Produce logs in a readable format including:
  - Timestamp (RFC3339 or custom format)
  - Severity level (DEBUG, INFO, WARN, ERROR, FATAL)
  - Module/Component (e.g., `dashboard.detail`, `transfer.queue`)
  - Message content
  - Optional fields: user context, trace ID, etc.

**Example Output Format:**
```
2025-12-10T11:30:00+08:00 [dashboard.detail] [INFO] User navigated to bucket view
2025-12-10T11:30:15+08:00 [transfer.upload] [ERROR] Failed to upload chunk: network timeout
```

### 2.1.1 Structured Logging with Zerolog
We'll use **[zerolog](https://github.com/rs/zerolog)**, a high-performance structured logging library that natively supports context fields.

**Backend (Go):**
- Implement Wails' `logger.Logger` interface using a zerolog wrapper.
- Zerolog provides native support for adding context fields via chaining:
  ```go
  log.Info().
      Str("module", "dashboard.detail").
      Str("bucketId", "my-bucket").
      Msg("User navigated to bucket view")
  ```
- Expose convenience methods in `App` for frontend calls:
  ```go
  func (a *App) LogWithContext(level, module, message string, context map[string]interface{})
  ```

**Frontend (TypeScript):**
- Provide helper functions:
  ```typescript
  logger.info(module: string, message: string, context?: Record<string, any>)
  logger.warn(module: string, message: string, context?: Record<string, any>)
  logger.error(module: string, message: string, context?: Record<string, any>)
  ```
- These call `App.LogWithContext()` which handles zerolog formatting internally.

### 2.2 Frontend-to-Backend Bridge
We'll provide **two complementary mechanisms** for frontend logging:

#### 2.2.1 Console Interception (Passive)
- **Purpose**: Capture existing `console.*` calls automatically without code changes.
- **Scope**: Applies to all console calls in the app (including third-party libraries).
- **Implementation**: Override `console.log`, `console.warn`, `console.error`.
- **Limitation**: Cannot capture structured metadata (module name, context).

#### 2.2.2 Structured Logger API (Active)
- **Purpose**: Allow explicit, structured logging from application code.
- **Usage Example**:
  ```typescript
  import { logger } from '@/lib/logger'
  
  logger.info('dashboard.detail', 'User navigated to bucket view', { bucketId: 'my-bucket' })
  logger.error('transfer.upload', 'Failed to upload chunk', { 
    fileName: 'image.png', 
    error: 'network timeout' 
  })
  ```
- **Benefit**: Rich metadata, searchable logs, better debugging context.

### 2.3 Wails Integration
- **Custom Logger**: Implement Wails' `logger.Logger` interface to direct internal Wails logs to our rotating file writer.
- **Log Level**: Allow configuration of log levels (Debug in Dev, Info/Error in Prod).

## 3. Architecture & Technical Design

### 3.1 Backend Changes
We'll integrate **zerolog** with **lumberjack** for log rotation.

*   **Dependencies**:
    1. `github.com/rs/zerolog` - High-performance structured logging.
    2. `gopkg.in/natefinch/lumberjack.v2` - Log rotation writer.

*   **Implementation Strategy**:
    1. **Create `internal/logger/logger.go`**:
        - Define `WailsLogger` struct that wraps a `zerolog.Logger`.
        - Implement Wails' `logger.Logger` interface (Print, Trace, Debug, Info, Warning, Error, Fatal).
        - Configure zerolog to write to a `lumberjack.Logger` for automatic rotation.
        
        ```go
        type WailsLogger struct {
            logger zerolog.Logger
        }
        
        func (l *WailsLogger) Info(message string) {
            l.logger.Info().Msg(message)
        }
        // ... implement other methods
        ```
    
    2. **Zerolog Configuration**:
        - Use `ConsoleWriter` for human-readable dev output.
        - Use JSON format for production logs.
        - Configure time format, level field names.
        - Integrate lumberjack for rotation:
        ```go
        fileWriter := &lumberjack.Logger{
            Filename:   "/path/to/app.log",
            MaxSize:    10, // megabytes
            MaxBackups: 5,
            MaxAge:     30, // days
            Compress:   true,
        }
        logger := zerolog.New(fileWriter).With().Timestamp().Logger()
        ```

*   **Exposed Methods** (in `internal/app/app.go`):
    ```go
    // For frontend structured logging
    func (a *App) LogWithContext(level, module, message string, context map[string]interface{}) {
        event := a.selectLogEvent(level)
        event = event.Str("module", module)
        
        // Add all context fields
        for key, value := range context {
            event = event.Interface(key, value)
        }
        
        event.Msg(message)
    }
    
    // Convenience methods for simple logging
    func (a *App) LogInfo(module, message string)
    func (a *App) LogError(module, message string)
    ```

*   **Bootstrap**: Initialize in `main.go` before `wails.Run`.

### 3.2 Frontend Changes
Create `src/lib/logger.ts` with **two parts**:

#### Part 1: Console Interception
1.  Check if `window.runtime` is available.
2.  Store original `console.*` methods.
3.  Override methods to:
    *   Call original (for browser DevTools).
    *   Forward to backend via `runtime.LogInfo/LogWarning/LogError`.

#### Part 2: Structured Logger API
Export a `logger` object with methods:
```typescript
interface LogContext {
  [key: string]: any
}

export const logger = {
  info(module: string, message: string, context?: LogContext): void {
    if (window.App?.LogWithContext) {
      window.App.LogWithContext('info', module, message, context || {})
    }
  },
  
  warn(module: string, message: string, context?: LogContext): void {
    if (window.App?.LogWithContext) {
      window.App.LogWithContext('warn', module, message, context || {})
    }
  },
  
  error(module: string, message: string, context?: LogContext): void {
    if (window.App?.LogWithContext) {
      window.App.LogWithContext('error', module, message, context || {})
    }
  },
  
  debug(module: string, message: string, context?: LogContext): void {
    if (window.App?.LogWithContext) {
      window.App.LogWithContext('debug', module, message, context || {})
    }
  }
}
```

**Initialization**: Call `initConsoleInterception()` in `main.tsx` entry point.

## 4. Implementation Steps

### Phase 1: Backend Infrastructure
1.  [ ] Add dependencies:
    *   `go get github.com/rs/zerolog`
    *   `go get gopkg.in/natefinch/lumberjack.v2`
2.  [ ] Create `internal/logger/logger.go`:
    *   Define `WailsLogger` struct wrapping `zerolog.Logger`.
    *   Implement all methods of Wails' `logger.Logger` interface.
    *   Configure zerolog with lumberjack writer for rotation.
    *   Export `NewLogger()` function to initialize the logger.
3.  [ ] Update `internal/app/app.go`:
    *   Add `logger *zerolog.Logger` field to `App` struct.
    *   Implement `LogWithContext(level, module, message string, context map[string]interface{})`.
    *   Implement helper method `selectLogEvent(level string) *zerolog.Event` to convert string level to zerolog event.
    *   Add convenience methods: `LogInfo(module, message string)`, `LogError(module, message string)`.
4.  [ ] Update `main.go`:
    *   Initialize custom logger via `logger.NewLogger()`.
    *   Pass logger to `wails.Run` Options (`Logger` field).
    *   Configure log level based on build mode (dev vs prod).
    *   Store zerolog instance in App for structured logging.

### Phase 2: Frontend Bridge
1.  [ ] Create `frontend/src/lib/logger.ts`.
2.  [ ] Implement **Console Interception**:
    *   `initConsoleInterception()` function.
    *   Store original `console` methods.
    *   Override methods to call both original (for DevTools) and `runtime.Log*` (for File).
3.  [ ] Implement **Structured Logger API**:
    *   Export `logger` object with methods: `info()`, `warn()`, `error()`, `debug()`.
    *   Each method calls `window.App.LogWithContext()` with level, module, message, and context.
    *   Add TypeScript types for `LogContext`.
4.  [ ] Import and run `initConsoleInterception()` in `frontend/src/main.tsx` (entry point).
5.  [ ] Generate Wails bindings: `wails generate module`.

### Phase 3: Verification
1.  [ ] **Dev Run**: 
    *   Run `wails dev`, inspect console output.
    *   Check if log file is created in the configured directory.
    *   Verify both `console.log` calls and `logger.info()` calls appear in the file.
2.  [ ] **Build**: 
    *   Run `wails build`, run the binary.
    *   Test console interception: trigger some `console.error()` calls, verify they appear in log file.
    *   Test structured logging: call `logger.info('test.module', 'Test message', { key: 'value' })`, verify output format:
        ```
        [timestamp] [test.module] [INFO] Test message {"key":"value"}
        ```
3.  [ ] **End-to-End Test**:
    *   Navigate through UI (triggers automatic console logs).
    *   Perform upload/download (should have structured logs from transfer module).
    *   Open log file, verify both types of logs are present and readable.


## 5. Proposed File Structure

```
internal/
  logger/
    logger.go           # Zerolog wrapper + Lumberjack config
  app/
    app.go              # Add LogWithContext() and convenience methods
main.go                 # Wiring the logger into Wails options
frontend/
  src/
    lib/
      logger.ts         # Structured logger API + Console interceptor
    main.tsx            # Call initConsoleInterception()
```


## 6. Risk Mitigation Strategies

### 6.1 Performance Overhead
Excessive frontend logging can flood the IPC bridge.
*   **Strategy 1: Production Level Filtering**:
    *   **Console**: In `Production` builds, only forward `console.warn` and `console.error`. Ignore `console.log` to prevent noise from dependencies.
    *   **Structured**: Always forward `logger.*` calls as they are intentional business logs.
*   **Strategy 2: Batching (Optional Phase 4)**:
    *   If UI lag is observed, implement a **Log Buffer** in `logger.ts`.
    *   Queue logs and flush to backend in batches (e.g., every 1s or when buffer reaches 50 items).
    *   *Decision*: Start without batching (KISS). Implement if profiling shows issues.

### 6.2 Circular Loop Prevention
Prevent `runtime.Log` -> `Wails Event` -> `console.log` -> `runtime.Log` infinite loops.
*   **Strategy**: **Reentrancy Guard** in `logger.ts`.
    ```typescript
    let isForwarding = false;
    
    function safeForward(level, message) {
        if (isForwarding) return;
        isForwarding = true;
        try {
            window.App.LogWithContext(...)
        } finally {
            isForwarding = false;
        }
    }
    ```

### 6.3 Context Serialization
Large objects in `logger.info(..., context)` can cause performance spikes during JSON serialization.
*   **Strategy**: **Depth/Size Limiter** protection.
    *   Before sending context to backend, run it through a sanitizer.
    *   Truncate strings > 1KB.
    *   Discard nested objects deeper than 2 levels or replace with `"[Object]"`.
