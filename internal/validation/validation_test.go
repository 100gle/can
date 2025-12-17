package validation

import (
	"strings"
	"testing"
)

func TestValidateBucketNameRelaxedBounds(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"single char ok", "a", false},
		{"empty", "", true},
		{"uppercase rejected", "Abc", true},
		{"contains space", "abc def", true},
		{"too long", strings.Repeat("a", 64), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBucketName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateBucketName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}
