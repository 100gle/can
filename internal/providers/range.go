package providers

import (
	"strconv"
	"strings"
)

// buildHTTPRange renders a HTTP Range header based on the provided offsets.
func buildHTTPRange(start, end *int64) string {
	if (start == nil || *start < 0) && (end == nil || *end < 0) {
		return ""
	}
	var builder strings.Builder
	builder.WriteString("bytes=")
	if start != nil && *start >= 0 {
		builder.WriteString(strconv.FormatInt(*start, 10))
	}
	builder.WriteString("-")
	if end != nil && *end >= 0 {
		builder.WriteString(strconv.FormatInt(*end, 10))
	}
	return builder.String()
}
