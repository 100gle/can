# Backend Storage Client Redesign

## Goals
- Single client entrypoint; remove builder map and layered adapters.
- Use generics to expose vendor SDKs with compile-time types (no `any`).
- Keep domain APIs (`Bucket()`, `Object()`, `Security()`) with provider-diff smoothing and error wrapping.
- Provide optional escape hatches to raw SDKs without making them the primary path.

## Core Types
```go
// Allowed SDK types per provider (extend when adding vendors).
type VendorSDK interface {
	oss.Client | cos.Client | struct{}
}

type Client[SDK VendorSDK] struct {
	provider types.Provider
	s3       S3Client       // base S3-compatible client
	sdk      SDK            // vendor SDK or struct{} for generic S3 providers
	bucket   BucketAPI      // domain-facing bucket API
	object   ObjectAPI      // domain-facing object API
	security SecurityAPI    // domain-facing security/STS API
}
```

### Constructors
```go
func NewClient[SDK VendorSDK](ctx context.Context, creds storage.ConnectionCredentials) (*Client[SDK], error) {
	s3c, err := newS3(ctx, creds)          // existing S3 factory logic
	if err != nil { return nil, err }

	sdk, bucketAPI, objectAPI := wireVendor[SDK](creds, s3c) // provider switch: build SDK + APIs

	return &Client[SDK]{
		provider: creds.Provider,
		s3:       s3c,
		sdk:      sdk,
		bucket:   bucketAPI,
		object:   objectAPI,
		security: pickSecurity(creds.Provider, creds),
	}, nil
}

// Convenience helpers (avoid generic parameter at call sites).
func NewOSSClient(ctx context.Context, creds storage.ConnectionCredentials) (*Client[oss.Client], error)
func NewCOSClient(ctx context.Context, creds storage.ConnectionCredentials) (*Client[cos.Client], error)
func NewGenericS3Client(ctx context.Context, creds storage.ConnectionCredentials) (*Client[struct{}], error)
```

### Public Surface
```go
func (c *Client[SDK]) Bucket() BucketAPI
func (c *Client[SDK]) Object() ObjectAPI
func (c *Client[SDK]) Security() SecurityAPI
func (c *Client[SDK]) Provider() types.Provider
func (c *Client[SDK]) Capabilities() []types.ProviderCapability

// Vendor SDK access
func (c *Client[SDK]) SDK() SDK
func (c *Client[SDK]) As[T VendorSDK]() (T, bool) // optional escape for mixed/provider-agnostic code

// Optional raw access for rare cases (not primary path)
func (c *Client[SDK]) S3() S3Client
```

### API Naming
- Use singular methods: `Bucket()`, `Object()`, `Security()`.
- Return types use `BucketAPI`, `ObjectAPI`, `SecurityAPI` (no `Driver`/`Wrapper` suffix).
- Domain API keeps existing request/response shapes and error wrapping; do **not** switch to raw S3 types.

## Vendor Wiring (`wireVendor`)
- Switch on `creds.Provider`, build SDK when available, and return domain APIs that wrap/extend the S3 drivers as needed (OSS referer/symlink, COS MAZ, etc.).
- For generic S3 providers, return `struct{}` as SDK and use baseline S3 bucket/object implementations.
- Keep provider-specific behavior inside the APIs; callers remain provider-agnostic.

## Pooling
- `ClientPool` caches `*Client[VendorSDK]` (or concrete `*Client[oss.Client]`, etc.).
- Factory map becomes unnecessary; `NewClient` is the single creation path. A thin helper may remain if needed for tests.

## Compatibility & Escape Hatches
- Main flow uses domain APIs to preserve capability checks, pagination mapping, and localized error handling.
- For rare SDK-specific operations, callers use `SDK()` (typed) or `As[T]()` (safe cast). Raw S3 client available via `S3()` when unavoidable.

## Migration Steps
1) ✅ Introduce `VendorSDK`, `Client[SDK]`, `NewClient`, and the singular `Bucket/Object/Security` APIs.
2) ✅ Refactor OSS/COS wiring into `wireVendor` (reuse existing adapter logic inside).
3) ✅ Update `ClientPool` to cache the new client; remove or thin out the old builder factory.
4) ✅ Adjust `app` wiring to call `NewClient`/new pool and update tests to use concrete `Client[...]` or small local interfaces.
5) Keep domain API contracts stable; only add `S3()`/`SDK()` escape hatches where absolutely necessary.

## Provider Coverage (Sprint 18)
| Provider | SDK Type | API Override | Security |
|----------|----------|--------------|----------|
| AWS | `struct{}` | S3 base | STS ✅ |
| OSS | `*oss.Client` | Referer, Symlink, endpoint fallback | Unimplemented |
| COS | `*cos.Client` | MAZ create, referer | Unimplemented |
| MinIO | `*minio.Client` | S3 base | Unimplemented |
| Qiniu | `*QiniuSDK` | S3 base | Unimplemented |
| R2 | `struct{}` | S3 base | Unimplemented |
| Custom | `struct{}` | S3 base | Unimplemented |

## Notes
- Builder map removed; `NewClient` is the single construction path and powers both pool and factory.
- S3 base client/drivers are injected via lightweight register functions to avoid import cycles.
- Escape hatches: use `SDK()` for native SDKs, `S3()` for rare low-level cases.
- Future: Cloudflare R2 native SDK (requires token/accountID fields), Qiniu native feature coverage beyond S3 compatibility, OSS/COS STS support.

## Package Layout & Wiring (upcoming cleanup)
- Root package keeps orchestration and shared types: `generic_client.go`, `generic_wire.go`, `security.go`, `types*.go`, `s3_bridge.go`.
- Provider specifics move into subpackages:
  - `internal/storage/oss/{sdk.go,bucket_api.go,object_api.go}` (referer/symlink/endpoint fallback decorators).
  - `internal/storage/cos/{sdk.go,bucket_api.go}` (MAZ/referer decorators).
  - `internal/storage/s3` remains the S3 baseline, registered via `RegisterS3APIs`.
- `wireVendor` imports only subpackage exports (`NewSDK/NewBucketAPI/NewObjectAPI`) and composes them over the S3 base.
- Default bucket/object path always uses the S3 API; SDKs are used only for provider-only features.
