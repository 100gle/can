package objects

import "strings"

type mutationContext struct {
	requestID string
	origin    string
}

// MutationOption allows callers to customise mutation behaviour (idempotency, origin).
type MutationOption func(*mutationContext)

// WithMutationOptions converts a MutationOptions payload to a MutationOption.
func WithMutationOptions(opts MutationOptions) MutationOption {
	return func(ctx *mutationContext) {
		if ctx == nil {
			return
		}
		ctx.requestID = strings.TrimSpace(opts.RequestID)
		ctx.origin = strings.TrimSpace(opts.Origin)
	}
}

// WithRequestID sets the idempotency token for the mutation.
func WithRequestID(requestID string) MutationOption {
	return func(ctx *mutationContext) {
		if ctx != nil {
			ctx.requestID = strings.TrimSpace(requestID)
		}
	}
}

// WithOrigin annotates the mutation source (e.g. "offline-queue").
func WithOrigin(origin string) MutationOption {
	return func(ctx *mutationContext) {
		if ctx != nil {
			ctx.origin = strings.TrimSpace(origin)
		}
	}
}

func applyMutationOptions(opts []MutationOption) mutationContext {
	ctx := mutationContext{}
	for _, opt := range opts {
		if opt != nil {
			opt(&ctx)
		}
	}
	return ctx
}
