package providers

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"

	"github.com/aws/smithy-go"
)

// WrapS3Error normalises SDK errors into user-friendly messages.
func WrapS3Error(action string, err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("%s: 请求超时", action)
	}
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		code := apiErr.ErrorCode()
		message := apiErr.ErrorMessage()
		if message == "" {
			message = apiErr.Error()
		}
		switch strings.ToLower(code) {
		case "accessdenied", "invalidaccesskeyid", "signaturedoesnotmatch", "authfailure":
			return fmt.Errorf("%s: 认证失败 (%s)", action, code)
		case "nosuchbucket":
			return fmt.Errorf("%s: 存储桶不存在", action)
		}
		return fmt.Errorf("%s: %s", action, message)
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return fmt.Errorf("%s: 网络超时", action)
		}
		return fmt.Errorf("%s: 网络错误: %v", action, netErr)
	}
	return fmt.Errorf("%s: %w", action, err)
}
