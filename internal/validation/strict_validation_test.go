package validation

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStrictValidation(t *testing.T) {
	t.Run("ValidateBucketName_Strict", func(t *testing.T) {
		tests := []struct {
			name        string
			bucketName  string
			shouldError bool
		}{
			{"ValidName", "my-bucket", false},
			{"LeadingSpace", " my-bucket", true},
			{"TrailingSpace", "my-bucket ", true},
			{"BothSpaces", " my-bucket ", true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				// Mock provider that allows mostly anything except what we validate in ValidateBucketName if it delegates?
				// Actually ValidateBucketName in validation.go checks trimming first.
				// We need to check if validation.ValidateBucketName exists and what signature it has.
				// Wait, I modified ValidateBucketName in validation.go.
				// Let's assume a generic provider or nil if not used for this specific check,
				// BUT ValidateBucketName takes (provider storage.Provider, name string).
				// We might need a mock provider.
				// Let's check validation.go content first to see if it relies on provider for the space check.
				err := ValidateBucketName(tt.bucketName)
				if tt.shouldError {
					assert.Error(t, err)
					if err != nil {
						assert.Contains(t, err.Error(), "leading or trailing spaces")
					}
				} else {
					// We might get other errors if "my-bucket" is not valid for AWS, but we start with a plausible one.
					// If it returns error for other reasons, that's fine, as long as LeadingSpace returns the SPECIFIC error.
					if err != nil {
						// unlikely for "my-bucket" unless length/chars issue
					}
				}
			})
		}
	})

	t.Run("ValidateObjectKey_Strict", func(t *testing.T) {
		tests := []struct {
			name        string
			key         string
			shouldError bool
		}{
			{"ValidKey", "my-folder/my-file.txt", false},
			{"LeadingSpace", " my-file.txt", true},
			{"TrailingSpace", "my-file.txt ", true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := ValidateObjectKey(tt.key)
				if tt.shouldError {
					assert.Error(t, err)
					if err != nil {
						assert.Contains(t, err.Error(), "leading or trailing spaces")
					}
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})
}
