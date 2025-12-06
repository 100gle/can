# Sprint 3: Observability & Optimization

**Goal**: Provide insights into usage/costs and polish the user experience.

## 1. Cost Analysis & Traffic Monitoring
**Context**: These features are missing. We need to track data usage and estimate costs.
**Relevant Spec**: `docs/spec/cost_analysis.md`, `docs/spec/traffic_monitoring.md`
**File Paths**:
- `internal/analytics/` (New Directory)
- `frontend/src/pages/analytics-page.tsx` (New)

**Tasks**:
- [ ] Create `internal/analytics` package to aggregate transfer and storage metrics.
- [ ] Implement cost calculation logic based on provider rates (mocked or configurable).
- [ ] Create "Cost Analysis" dashboard in Frontend showing spending trends.
- [ ] Create "Traffic" dashboard showing bandwidth usage.

## 2. Performance Dashboard & Optimization
**Context**: Basic config helper exists, but no real-time monitoring.
**Relevant Spec**: `docs/spec/performance_optimization.md`
**File Paths**:
- `internal/system/` (New Directory for system metrics?)
- `frontend/src/pages/settings-page.tsx`

**Tasks**:
- [ ] Create "Performance" section in Global Settings.
- [ ] Implement system metrics collection (memory usage, cache hit rates, connection pool stats).
- [ ] Display these metrics in a dashboard.

*(Localization/i18n has been removed from scope)*

## Parallel Development Notes
> [!IMPORTANT]
> **Conflict Prevention Strategy**:
> *   **Isolation**: This sprint focuses on disjoint components (Analytics, Global Settings) and should have **zero overlap** with Sprint 1 or 2 (which focus on Buckets and Data Movement).
> *   **Frontend**: You will be creating new pages (`analytics-page.tsx`) or editing global settings (`settings-page.tsx`), which are distinct from `bucket-settings-page.tsx`.
