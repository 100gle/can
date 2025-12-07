package objects

import (
	"context"
	"testing"
	"time"
)

func TestAnalyzeLinkSecurityNoIssues(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)

	analysis, err := svc.AnalyzeLinkSecurity(
		context.Background(),
		accountID,
		"docs",
		"report.pdf",
		[]string{"GET"},
		1*time.Hour,
	)
	if err != nil {
		t.Fatalf("analyze link security: %v", err)
	}

	if analysis.OverallRisk != "low" {
		t.Fatalf("expected low risk, got %s", analysis.OverallRisk)
	}

	if len(analysis.Warnings) != 1 || analysis.Warnings[0].Level != SecurityLevelInfo {
		t.Fatalf("expected 1 info warning, got %d warnings", len(analysis.Warnings))
	}
}

func TestAnalyzeLinkSecurityLongExpiration(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)

	analysis, err := svc.AnalyzeLinkSecurity(
		context.Background(),
		accountID,
		"docs",
		"file.txt",
		[]string{"GET"},
		48*time.Hour, // 2 days
	)
	if err != nil {
		t.Fatalf("analyze link security: %v", err)
	}

	if analysis.OverallRisk == "low" {
		t.Fatalf("expected elevated risk for long expiration")
	}

	foundWarning := false
	for _, w := range analysis.Warnings {
		if w.Title == "Long Expiration Time" {
			foundWarning = true
			break
		}
	}
	if !foundWarning {
		t.Fatal("expected warning about long expiration time")
	}
}

func TestAnalyzeLinkSecurityExcessiveExpiration(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)

	analysis, err := svc.AnalyzeLinkSecurity(
		context.Background(),
		accountID,
		"docs",
		"sensitive.doc",
		[]string{"GET"},
		10*24*time.Hour, // 10 days
	)
	if err != nil {
		t.Fatalf("analyze link security: %v", err)
	}

	if analysis.OverallRisk != "high" {
		t.Fatalf("expected high risk for excessive expiration, got %s", analysis.OverallRisk)
	}

	foundError := false
	for _, w := range analysis.Warnings {
		if w.Level == SecurityLevelError && w.Title == "Excessive Expiration Time" {
			foundError = true
			break
		}
	}
	if !foundError {
		t.Fatal("expected error-level warning about excessive expiration")
	}
}

func TestAnalyzeLinkSecurityDangerousMethods(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)

	tests := []struct {
		methods       []string
		expectWarning bool
	}{
		{[]string{"GET"}, false},
		{[]string{"HEAD"}, false},
		{[]string{"GET", "HEAD"}, false},
		{[]string{"PUT"}, true},
		{[]string{"DELETE"}, true},
		{[]string{"POST"}, true},
		{[]string{"GET", "PUT"}, true},
	}

	for _, tt := range tests {
		analysis, err := svc.AnalyzeLinkSecurity(
			context.Background(),
			accountID,
			"docs",
			"file.bin",
			tt.methods,
			1*time.Hour,
		)
		if err != nil {
			t.Fatalf("analyze link security with methods %v: %v", tt.methods, err)
		}

		foundWarning := false
		for _, w := range analysis.Warnings {
			if w.Title == "Write/Delete Methods Enabled" {
				foundWarning = true
				break
			}
		}

		if foundWarning != tt.expectWarning {
			t.Errorf("methods %v: expected warning=%v, got warning=%v", tt.methods, tt.expectWarning, foundWarning)
		}
	}
}

func TestAnalyzeLinkSecurityRecommendations(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)

	analysis, err := svc.AnalyzeLinkSecurity(
		context.Background(),
		accountID,
		"docs",
		"report.pdf",
		[]string{"GET"},
		2*time.Hour,
	)
	if err != nil {
		t.Fatalf("analyze link security: %v", err)
	}

	if len(analysis.Recommendations) == 0 {
		t.Fatal("expected security recommendations")
	}

	// Should have basic recommendations
	hasHTTPSRec := false
	for _, rec := range analysis.Recommendations {
		if rec == "Use HTTPS to prevent link interception" {
			hasHTTPSRec = true
			break
		}
	}
	if !hasHTTPSRec {
		t.Fatal("expected HTTPS recommendation")
	}
}

func TestAnalyzeLinkSecurityValidatesInputs(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)
	ctx := context.Background()

	if _, err := svc.AnalyzeLinkSecurity(ctx, accountID, "", "key", []string{"GET"}, time.Hour); err == nil {
		t.Fatal("expected error when bucket is empty")
	}

	if _, err := svc.AnalyzeLinkSecurity(ctx, accountID, "bucket", "", []string{"GET"}, time.Hour); err == nil {
		t.Fatal("expected error when key is empty")
	}
}
