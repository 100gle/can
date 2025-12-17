package storage

import (
	"fmt"
	"strconv"
)

// Range represents an HTTP byte range for partial content requests.
type Range struct {
	Start *int64
	End   *int64
}

// NewRange creates a Range from optional start and end offsets.
func NewRange(start, end *int64) Range {
	return Range{Start: start, End: end}
}

// IsValid returns true if at least one bound is set and non-negative.
func (r Range) IsValid() bool {
	return (r.Start != nil && *r.Start >= 0) || (r.End != nil && *r.End >= 0)
}

// Header returns the HTTP Range header value, e.g., "bytes=0-1023".
// Returns empty string if no valid range is specified.
func (r Range) Header() string {
	if !r.IsValid() {
		return ""
	}
	startStr, endStr := "", ""
	if r.Start != nil && *r.Start >= 0 {
		startStr = strconv.FormatInt(*r.Start, 10)
	}
	if r.End != nil && *r.End >= 0 {
		endStr = strconv.FormatInt(*r.End, 10)
	}
	return fmt.Sprintf("bytes=%s-%s", startStr, endStr)
}
