package accounts

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"can/internal/types"
	"can/internal/validation"
)

// validProviders lists all valid provider values for batch import.
var validProviders = []string{"aws", "oss", "cos", "r2", "qiniu", "minio", "custom"}

// isValidProvider checks if the given provider string is a known provider.
func isValidProvider(provider string) bool {
	normalized := strings.ToLower(strings.TrimSpace(provider))
	for _, p := range validProviders {
		if normalized == p {
			return true
		}
	}
	return false
}

// providerHint returns a hint string listing all valid providers.
func providerHint() string {
	return strings.Join(validProviders, ", ")
}

// parseCSV parses CSV format account data.
// CSV format requires header row: name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
// Rows starting with # are treated as comments and skipped.
func parseCSV(data []byte) ([]BatchImportInput, []BatchImportError) {
	reader := csv.NewReader(bytes.NewReader(data))
	// Allow variable number of fields per record (for comment rows)
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil {
		return nil, []BatchImportError{{Index: 0, Message: fmt.Sprintf("CSV 解析失败: %v", err)}}
	}
	if len(records) < 2 {
		return nil, []BatchImportError{{Index: 0, Message: "CSV 文件为空或只有表头"}}
	}

	// Parse header to build column name to index mapping
	header := records[0]
	colIndex := make(map[string]int)
	for i, col := range header {
		colIndex[strings.TrimSpace(strings.ToLower(col))] = i
	}

	// Validate required columns
	requiredCols := []string{"name", "endpoint", "accesskeyid", "secretaccesskey"}
	for _, col := range requiredCols {
		if _, ok := colIndex[col]; !ok {
			return nil, []BatchImportError{{Index: 0, Message: fmt.Sprintf("缺少必需列: %s", col)}}
		}
	}

	var inputs []BatchImportInput
	var parseErrors []BatchImportError

	for i, row := range records[1:] {
		lineNum := i + 2 // Line number starts from 2 (skip header)

		// Skip comment rows (first column starts with #)
		if len(row) > 0 && strings.HasPrefix(strings.TrimSpace(row[0]), "#") {
			continue
		}

		input, parseErr := parseCSVRow(row, colIndex, lineNum)
		if parseErr != nil {
			parseErrors = append(parseErrors, *parseErr)
			continue
		}
		inputs = append(inputs, input)
	}

	return inputs, parseErrors
}

func parseCSVRow(row []string, colIndex map[string]int, lineNum int) (BatchImportInput, *BatchImportError) {
	getValue := func(col string) string {
		if idx, ok := colIndex[col]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
		return ""
	}

	input := BatchImportInput{
		Name:            getValue("name"),
		Tag:             getValue("tag"),
		Provider:        getValue("provider"),
		Endpoint:        getValue("endpoint"),
		Region:          getValue("region"),
		AccessKeyID:     getValue("accesskeyid"),
		SecretAccessKey: getValue("secretaccesskey"),
	}

	// Parse useSSL
	if sslStr := getValue("usessl"); sslStr != "" {
		input.UseSSL = strings.ToLower(sslStr) == "true" || sslStr == "1"
	} else {
		input.UseSSL = true // Default to SSL enabled
	}

	// Parse port
	if portStr := getValue("port"); portStr != "" {
		port, err := strconv.Atoi(portStr)
		if err != nil {
			return input, &BatchImportError{Index: lineNum, Name: input.Name, Field: "port", Message: "端口必须是数字"}
		}
		input.Port = port
	}

	// Validate required fields
	if input.Name == "" {
		return input, &BatchImportError{Index: lineNum, Field: "name", Message: "账户名称不能为空"}
	}
	if input.Endpoint == "" {
		return input, &BatchImportError{Index: lineNum, Name: input.Name, Field: "endpoint", Message: "Endpoint 不能为空"}
	}
	if input.AccessKeyID == "" {
		return input, &BatchImportError{Index: lineNum, Name: input.Name, Field: "accessKeyId", Message: "Access Key ID 不能为空"}
	}
	if input.SecretAccessKey == "" {
		return input, &BatchImportError{Index: lineNum, Name: input.Name, Field: "secretAccessKey", Message: "Secret Access Key 不能为空"}
	}

	// Validate via struct tags (for any additional rules)
	if err := validation.ValidateStruct(input); err != nil {
		return input, &BatchImportError{Index: lineNum, Name: input.Name, Field: "struct", Message: err.Error()}
	}

	// Validate provider if specified
	if input.Provider != "" && !isValidProvider(input.Provider) {
		return input, &BatchImportError{
			Index:   lineNum,
			Name:    input.Name,
			Field:   "provider",
			Message: fmt.Sprintf("无效的 provider '%s'，有效值: %s", input.Provider, providerHint()),
		}
	}

	return input, nil
}

// parseJSON parses JSON format account data.
func parseJSON(data []byte) ([]BatchImportInput, []BatchImportError) {
	// Try to parse as array
	var inputs []BatchImportInput
	if err := json.Unmarshal(data, &inputs); err == nil {
		return validateJSONInputs(inputs)
	}

	// Try to parse as single object
	var single BatchImportInput
	if err := json.Unmarshal(data, &single); err == nil {
		return validateJSONInputs([]BatchImportInput{single})
	}

	return nil, []BatchImportError{{Index: 0, Message: "JSON 解析失败: 格式不正确"}}
}

func validateJSONInputs(inputs []BatchImportInput) ([]BatchImportInput, []BatchImportError) {
	var valid []BatchImportInput
	var parseErrors []BatchImportError

	for i, input := range inputs {
		lineNum := i + 1

		if input.Name == "" {
			parseErrors = append(parseErrors, BatchImportError{Index: lineNum, Field: "name", Message: "账户名称不能为空"})
			continue
		}
		if input.Endpoint == "" {
			parseErrors = append(parseErrors, BatchImportError{Index: lineNum, Name: input.Name, Field: "endpoint", Message: "Endpoint 不能为空"})
			continue
		}
		if input.AccessKeyID == "" {
			parseErrors = append(parseErrors, BatchImportError{Index: lineNum, Name: input.Name, Field: "accessKeyId", Message: "Access Key ID 不能为空"})
			continue
		}
		if input.SecretAccessKey == "" {
			parseErrors = append(parseErrors, BatchImportError{Index: lineNum, Name: input.Name, Field: "secretAccessKey", Message: "Secret Access Key 不能为空"})
			continue
		}

		if err := validation.ValidateStruct(input); err != nil {
			parseErrors = append(parseErrors, BatchImportError{Index: lineNum, Name: input.Name, Field: "struct", Message: err.Error()})
			continue
		}

		// Validate provider if specified
		if input.Provider != "" && !isValidProvider(input.Provider) {
			parseErrors = append(parseErrors, BatchImportError{
				Index:   lineNum,
				Name:    input.Name,
				Field:   "provider",
				Message: fmt.Sprintf("无效的 provider '%s'，有效值: %s", input.Provider, providerHint()),
			})
			continue
		}

		// Set default values
		if !input.UseSSL && input.Port == 0 {
			input.UseSSL = true
		}

		valid = append(valid, input)
	}

	return valid, parseErrors
}

// ImportBatchData batch imports account data from CSV or JSON.
func (s *Service) ImportBatchData(ctx context.Context, data []byte, format string) (BatchImportResult, error) {
	if len(data) == 0 {
		return BatchImportResult{}, errors.New("导入文件为空")
	}

	var inputs []BatchImportInput
	var parseErrors []BatchImportError

	switch strings.ToLower(format) {
	case "csv":
		inputs, parseErrors = parseCSV(data)
	case "json":
		inputs, parseErrors = parseJSON(data)
	default:
		return BatchImportResult{}, fmt.Errorf("不支持的文件格式: %s", format)
	}

	// If entire file parsing failed
	if len(inputs) == 0 && len(parseErrors) > 0 && parseErrors[0].Index == 0 {
		return BatchImportResult{
			Total:  0,
			Failed: 1,
			Errors: parseErrors,
		}, nil
	}

	// Get existing accounts for deduplication
	existing, err := s.store.List(ctx)
	if err != nil {
		return BatchImportResult{}, err
	}
	dedupe := make(map[string]struct{}, len(existing))
	for _, acc := range existing {
		dedupe[accountKey(acc.Name, acc.Endpoint, acc.Provider)] = struct{}{}
	}

	result := BatchImportResult{
		Total:  len(inputs) + len(parseErrors),
		Failed: len(parseErrors),
		Errors: parseErrors,
	}

	var firstCreated string
	for i, item := range inputs {
		provider := types.ParseProvider(item.Provider)
		key := accountKey(item.Name, item.Endpoint, provider)

		if _, exists := dedupe[key]; exists {
			result.Skipped++
			result.Errors = append(result.Errors, BatchImportError{
				Index:   i + 1,
				Name:    item.Name,
				Message: fmt.Sprintf("账户 %s 已存在，已跳过", item.Name),
			})
			continue
		}

		input := CreateAccountInput{
			Name:            item.Name,
			Tag:             item.Tag,
			Provider:        provider,
			Endpoint:        item.Endpoint,
			AccessKeyID:     item.AccessKeyID,
			SecretAccessKey: item.SecretAccessKey,
			Region:          item.Region,
			UseSSL:          item.UseSSL,
			Port:            item.Port,
		}

		if err := validation.ValidateStruct(input); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, BatchImportError{
				Index:   i + 1,
				Name:    item.Name,
				Message: fmt.Sprintf("校验失败: %v", err),
			})
			continue
		}

		account, err := s.CreateAccount(ctx, input)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, BatchImportError{
				Index:   i + 1,
				Name:    item.Name,
				Message: fmt.Sprintf("导入失败: %v", err),
			})
			continue
		}

		dedupe[key] = struct{}{}
		result.Imported++
		if firstCreated == "" {
			firstCreated = account.ID
		}
	}

	// Auto-set first created account as active
	if s.activeID == "" && firstCreated != "" {
		s.activeID = firstCreated
	}

	return result, nil
}

// GenerateCSVTemplate generates a CSV template for batch import.
func GenerateCSVTemplate() []byte {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write header
	_ = writer.Write([]string{
		"name", "tag", "provider", "endpoint", "region",
		"useSSL", "port", "accessKeyId", "secretAccessKey",
	})

	// Write comment row to show valid provider values
	_ = writer.Write([]string{
		"# provider 可选值: " + providerHint(),
		"", "", "", "",
		"", "", "", "",
	})

	// Write example data
	_ = writer.Write([]string{
		"我的 AWS 账户", "生产环境", "aws", "s3.amazonaws.com", "us-east-1",
		"true", "443", "AKIAIOSFODNN7EXAMPLE", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
	})
	_ = writer.Write([]string{
		"阿里云 OSS", "开发环境", "oss", "oss-cn-hangzhou.aliyuncs.com", "cn-hangzhou",
		"true", "443", "LTAI5tExample", "ExampleSecretKey123",
	})

	writer.Flush()
	return buf.Bytes()
}

// GenerateJSONTemplate generates a JSON template for batch import.
func GenerateJSONTemplate() []byte {
	template := []BatchImportInput{
		{
			Name:            "我的 AWS 账户",
			Tag:             "生产环境",
			Provider:        "aws",
			Endpoint:        "s3.amazonaws.com",
			Region:          "us-east-1",
			UseSSL:          true,
			Port:            443,
			AccessKeyID:     "AKIAIOSFODNN7EXAMPLE",
			SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		},
		{
			Name:            "阿里云 OSS",
			Tag:             "开发环境",
			Provider:        "oss",
			Endpoint:        "oss-cn-hangzhou.aliyuncs.com",
			Region:          "cn-hangzhou",
			UseSSL:          true,
			Port:            443,
			AccessKeyID:     "LTAI5tExample",
			SecretAccessKey: "ExampleSecretKey123",
		},
	}

	data, _ := json.MarshalIndent(template, "", "  ")
	return data
}
