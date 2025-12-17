package validation

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
)

var (
	// validate is the global validator instance
	validate *validator.Validate
)

func init() {
	validate = validator.New()

	// Register custom validators
	_ = validate.RegisterValidation("bucket-name", func(fl validator.FieldLevel) bool {
		return ValidateBucketName(fl.Field().String()) == nil
	})
	_ = validate.RegisterValidation("object-key", func(fl validator.FieldLevel) bool {
		return ValidateObjectKey(fl.Field().String()) == nil
	})
}

// ValidateStruct validates a struct using the validator tags
func ValidateStruct(s any) error {
	if err := validate.Struct(s); err != nil {
		// Format validation errors into a user-friendly message
		return formatValidationError(err)
	}
	return nil
}

// formatValidationError converts validation errors into readable messages
func formatValidationError(err error) error {
	if err == nil {
		return nil
	}

	var messages []string

	// Check if it's a validation error
	if validationErrs, ok := err.(validator.ValidationErrors); ok {
		for _, fieldErr := range validationErrs {
			message := formatFieldError(fieldErr)
			messages = append(messages, message)
		}
	} else {
		// If it's not a validation error, return as is
		return err
	}

	if len(messages) == 0 {
		return err
	}

	return fmt.Errorf("validation failed: %s", strings.Join(messages, "; "))
}

// formatFieldError formats a single field validation error
func formatFieldError(err validator.FieldError) string {
	field := err.Field()
	tag := err.Tag()

	switch tag {
	case "required":
		return fmt.Sprintf("%s is required", field)
	case "min":
		return fmt.Sprintf("%s must be at least %s characters", field, err.Param())
	case "max":
		return fmt.Sprintf("%s must be at most %s characters", field, err.Param())
	case "email":
		return fmt.Sprintf("%s must be a valid email address", field)
	case "url":
		return fmt.Sprintf("%s must be a valid URL", field)
	case "oneof":
		return fmt.Sprintf("%s must be one of: %s", field, err.Param())
	default:
		return fmt.Sprintf("%s failed validation (%s)", field, tag)
	}
}

// ValidateBucketName validates that a bucket name is valid according to S3 naming rules
func ValidateBucketName(name string) error {
	if strings.TrimSpace(name) != name {
		return fmt.Errorf("bucket name cannot contain leading or trailing spaces")
	}
	if name == "" {
		return fmt.Errorf("bucket name cannot be empty")
	}
	if len(name) > 63 {
		return fmt.Errorf("bucket name cannot exceed 63 characters")
	}
	if strings.Contains(name, " ") {
		return fmt.Errorf("bucket name cannot contain spaces")
	}
	if name != strings.ToLower(name) {
		return fmt.Errorf("bucket name must be lowercase")
	}
	// Additional rules can be added here (e.g., no uppercase, no underscores, etc.)
	return nil
}

// ValidateObjectKey validates that an object key is valid
func ValidateObjectKey(key string) error {
	if strings.TrimSpace(key) != key {
		return fmt.Errorf("object key cannot contain leading or trailing spaces")
	}
	if key == "" {
		return fmt.Errorf("object key cannot be empty")
	}
	if len(key) > 1024 {
		return fmt.Errorf("object key must be less than 1024 characters")
	}
	return nil
}
