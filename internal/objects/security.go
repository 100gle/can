package objects

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// SecurityWarningLevel indicates the severity of a security issue.
type SecurityWarningLevel string

const (
	SecurityLevelInfo    SecurityWarningLevel = "info"
	SecurityLevelWarning SecurityWarningLevel = "warning"
	SecurityLevelError   SecurityWarningLevel = "error"
)

// SecurityWarning represents a specific security concern.
type SecurityWarning struct {
	Level       SecurityWarningLevel `json:"level"`
	Title       string               `json:"title"`
	Description string               `json:"description"`
	Mitigation  string               `json:"mitigation,omitempty"`
}

// LinkSecurityAnalysis provides security assessment for a share link.
type LinkSecurityAnalysis struct {
	Bucket          string            `json:"bucket"`
	Key             string            `json:"key"`
	ExpiresIn       time.Duration     `json:"expiresIn" ts_type:"string"`
	Methods         []string          `json:"methods"`
	Warnings        []SecurityWarning `json:"warnings"`
	Recommendations []string          `json:"recommendations"`
	OverallRisk     string            `json:"overallRisk"` // "low", "medium", "high"
}

// AnalyzeLinkSecurity performs security analysis on link generation parameters.
func (s *Service) AnalyzeLinkSecurity(
	ctx context.Context,
	accountID, bucket, key string,
	methods []string,
	expiresIn time.Duration,
) (LinkSecurityAnalysis, error) {
	bucket = strings.TrimSpace(bucket)
	key = strings.TrimSpace(key)

	if bucket == "" {
		return LinkSecurityAnalysis{}, fmt.Errorf("bucket is required")
	}
	if key == "" {
		return LinkSecurityAnalysis{}, fmt.Errorf("key is required")
	}

	analysis := LinkSecurityAnalysis{
		Bucket:          bucket,
		Key:             key,
		ExpiresIn:       expiresIn,
		Methods:         methods,
		Warnings:        []SecurityWarning{},
		Recommendations: []string{},
		OverallRisk:     "low",
	}

	// Check expiration time
	if expiresIn > 24*time.Hour {
		analysis.Warnings = append(analysis.Warnings, SecurityWarning{
			Level:       SecurityLevelWarning,
			Title:       "Long Expiration Time",
			Description: fmt.Sprintf("Link expires in %v, which is longer than 24 hours.", expiresIn),
			Mitigation:  "Consider using a shorter expiration time to reduce the window of unauthorized access.",
		})
		analysis.OverallRisk = "medium"
	}

	if expiresIn > 7*24*time.Hour {
		analysis.Warnings = append(analysis.Warnings, SecurityWarning{
			Level:       SecurityLevelError,
			Title:       "Excessive Expiration Time",
			Description: fmt.Sprintf("Link expires in %v (maximum allowed is 7 days).", expiresIn),
			Mitigation:  "Shorten the expiration time to comply with best practices and security policies.",
		})
		analysis.OverallRisk = "high"
	}

	// Check for dangerous HTTP methods
	hasDangerousMethods := false
	for _, method := range methods {
		method = strings.ToUpper(strings.TrimSpace(method))
		if method == "PUT" || method == "DELETE" || method == "POST" {
			hasDangerousMethods = true
			break
		}
	}

	if hasDangerousMethods {
		analysis.Warnings = append(analysis.Warnings, SecurityWarning{
			Level:       SecurityLevelWarning,
			Title:       "Write/Delete Methods Enabled",
			Description: "Link allows modifying or deleting operations (PUT, DELETE, POST).",
			Mitigation:  "Only grant write/delete permissions if absolutely necessary. Consider using read-only (GET) links.",
		})
		if analysis.OverallRisk == "low" {
			analysis.OverallRisk = "medium"
		}
	}

	// Build recommendations
	analysis.Recommendations = []string{
		"Share this link only with trusted recipients",
		"Use HTTPS to prevent link interception",
		"Monitor access logs for unusual activity",
	}

	if expiresIn > time.Hour {
		analysis.Recommendations = append(analysis.Recommendations,
			"Consider regenerating the link with a shorter expiration if the file is time-sensitive")
	}

	if len(analysis.Warnings) == 0 {
		analysis.Warnings = append(analysis.Warnings, SecurityWarning{
			Level:       SecurityLevelInfo,
			Title:       "No Security Issues Detected",
			Description: "Link configuration follows security best practices.",
		})
	}

	return analysis, nil
}
