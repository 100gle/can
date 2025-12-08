package system

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const defaultPingTimeout = 5 * time.Second

// PingEndpoint performs a lightweight HEAD/GET request to verify reachability of the provided endpoint.
// It never returns an error; callers should inspect the PingResult fields for details.
func (s *Service) PingEndpoint(ctx context.Context, target string, timeout time.Duration) PingResult {
	now := time.Now()
	result := PingResult{
		URL:       strings.TrimSpace(target),
		Method:    http.MethodHead,
		CheckedAt: now,
		Reason:    "uninitialized",
	}
	endpoint := strings.TrimSpace(target)
	if endpoint == "" {
		result.Error = "endpoint is required"
		result.Reason = "missing_endpoint"
		return result
	}
	if !strings.Contains(endpoint, "://") {
		endpoint = "https://" + endpoint
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		result.Error = fmt.Sprintf("invalid endpoint: %v", err)
		result.Reason = "invalid_endpoint"
		return result
	}
	result.URL = endpoint
	if host := parsed.Hostname(); host != "" {
		if ips, lookupErr := net.LookupIP(host); lookupErr == nil && len(ips) > 0 {
			result.ResolvedIP = ips[0].String()
		}
	}
	if timeout <= 0 {
		timeout = defaultPingTimeout
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	client := s.httpClient
	if client == nil {
		client = &http.Client{Timeout: timeout}
	}

	result = s.performPing(ctx, client, endpoint, result)
	if result.Method == http.MethodHead &&
		(result.StatusCode == http.StatusMethodNotAllowed || result.StatusCode == http.StatusNotImplemented) {
		// Some providers reject HEAD; retry with GET once.
		result.Method = http.MethodGet
		result = s.performPing(ctx, client, endpoint, result)
	}
	return result
}

func (s *Service) performPing(ctx context.Context, client *http.Client, endpoint string, result PingResult) PingResult {
	req, err := http.NewRequestWithContext(ctx, result.Method, endpoint, nil)
	start := time.Now()
	if err != nil {
		result.Error = fmt.Sprintf("构建网络检测请求失败: %v", err)
		result.Reason = "request_build_failed"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}
	resp, err := client.Do(req)
	result.LatencyMs = time.Since(start).Milliseconds()
	if err != nil {
		result.Error = err.Error()
		result.Reason = classifyPingError(err)
		result.Online = false
		return result
	}
	defer resp.Body.Close()
	result.StatusCode = resp.StatusCode
	result.Error = ""
	result.Reason = "ok"
	result.Online = resp.StatusCode > 0 && resp.StatusCode < 500
	if !result.Online {
		result.Reason = fmt.Sprintf("http_%d", resp.StatusCode)
		result.Error = http.StatusText(resp.StatusCode)
	}
	return result
}

func classifyPingError(err error) string {
	if err == nil {
		return "ok"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return "timeout"
		}
		return "network_error"
	}
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return "dns_error"
	}
	return "request_failed"
}
