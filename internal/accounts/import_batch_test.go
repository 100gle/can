package accounts

import (
	"context"
	"strings"
	"testing"

	"can/internal/types"
)

func TestParseCSV_ValidInput(t *testing.T) {
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
Account A,prod,aws,s3.amazonaws.com,us-east-1,true,443,AKIAEXAMPLE1,secret1
Account B,dev,oss,oss-cn-hangzhou.aliyuncs.com,cn-hangzhou,true,443,LTAIEXAMPLE2,secret2`

	inputs, errs := parseCSV([]byte(csv))

	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %d: %v", len(errs), errs)
	}
	if len(inputs) != 2 {
		t.Fatalf("expected 2 inputs, got %d", len(inputs))
	}

	// Verify first account
	if inputs[0].Name != "Account A" {
		t.Errorf("expected name 'Account A', got '%s'", inputs[0].Name)
	}
	if inputs[0].Tag != "prod" {
		t.Errorf("expected tag 'prod', got '%s'", inputs[0].Tag)
	}
	if inputs[0].Provider != "aws" {
		t.Errorf("expected provider 'aws', got '%s'", inputs[0].Provider)
	}
	if inputs[0].Endpoint != "s3.amazonaws.com" {
		t.Errorf("expected endpoint 's3.amazonaws.com', got '%s'", inputs[0].Endpoint)
	}
	if inputs[0].UseSSL != true {
		t.Errorf("expected useSSL true, got %v", inputs[0].UseSSL)
	}
	if inputs[0].Port != 443 {
		t.Errorf("expected port 443, got %d", inputs[0].Port)
	}

	// Verify second account
	if inputs[1].Name != "Account B" {
		t.Errorf("expected name 'Account B', got '%s'", inputs[1].Name)
	}
	if inputs[1].Provider != "oss" {
		t.Errorf("expected provider 'oss', got '%s'", inputs[1].Provider)
	}
}

func TestParseCSV_MissingRequiredColumn(t *testing.T) {
	csv := `name,tag,provider,endpoint,region,useSSL,port
Account A,prod,aws,s3.amazonaws.com,us-east-1,true,443`

	inputs, errs := parseCSV([]byte(csv))

	if len(inputs) != 0 {
		t.Errorf("expected 0 inputs, got %d", len(inputs))
	}
	if len(errs) == 0 {
		t.Fatal("expected error for missing column")
	}
	if errs[0].Index != 0 {
		t.Errorf("expected file-level error (index 0), got %d", errs[0].Index)
	}
	if !strings.Contains(errs[0].Message, "accesskeyid") {
		t.Errorf("expected error about accesskeyid, got '%s'", errs[0].Message)
	}
}

func TestParseCSV_PartialFailure(t *testing.T) {
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
Good Account,prod,aws,s3.amazonaws.com,us-east-1,true,443,AKIAEXAMPLE,secret
,dev,oss,oss.aliyuncs.com,cn-hangzhou,true,443,LTAI123,secret2
Another Good,staging,cos,cos.ap-beijing.myqcloud.com,ap-beijing,true,443,COS123,secret3`

	inputs, errs := parseCSV([]byte(csv))

	if len(inputs) != 2 {
		t.Fatalf("expected 2 valid inputs, got %d", len(inputs))
	}
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errs))
	}

	// Check error details
	if errs[0].Index != 3 {
		t.Errorf("expected error at line 3, got %d", errs[0].Index)
	}
	if errs[0].Field != "name" {
		t.Errorf("expected error field 'name', got '%s'", errs[0].Field)
	}
}

func TestParseCSV_InvalidPort(t *testing.T) {
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
Account A,prod,aws,s3.amazonaws.com,us-east-1,true,abc,AKIAEXAMPLE,secret`

	inputs, errs := parseCSV([]byte(csv))

	if len(inputs) != 0 {
		t.Errorf("expected 0 valid inputs, got %d", len(inputs))
	}
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errs))
	}
	if errs[0].Field != "port" {
		t.Errorf("expected error field 'port', got '%s'", errs[0].Field)
	}
}

func TestParseCSV_DefaultSSL(t *testing.T) {
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
Account A,prod,aws,s3.amazonaws.com,us-east-1,,443,AKIAEXAMPLE,secret`

	inputs, errs := parseCSV([]byte(csv))

	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %d", len(errs))
	}
	if len(inputs) != 1 {
		t.Fatalf("expected 1 input, got %d", len(inputs))
	}
	if inputs[0].UseSSL != true {
		t.Errorf("expected default useSSL to be true, got %v", inputs[0].UseSSL)
	}
}

func TestParseCSV_EmptyFile(t *testing.T) {
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey`

	inputs, errs := parseCSV([]byte(csv))

	if len(inputs) != 0 {
		t.Errorf("expected 0 inputs, got %d", len(inputs))
	}
	if len(errs) == 0 {
		t.Fatal("expected error for empty file")
	}
}

func TestParseCSV_CJKWithQuotes(t *testing.T) {
	// Test CJK characters in quoted CSV fields (e.g., Chinese names with commas or special chars)
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
"我的「AWS」账户, 测试版",生产环境,aws,s3.amazonaws.com,us-east-1,true,443,AKIAEXAMPLE,secret
"阿里云 OSS (杭州)","开发, 测试环境",oss,oss-cn-hangzhou.aliyuncs.com,cn-hangzhou,true,443,LTAI123,secret2`

	inputs, errs := parseCSV([]byte(csv))

	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %d: %v", len(errs), errs)
	}
	if len(inputs) != 2 {
		t.Fatalf("expected 2 inputs, got %d", len(inputs))
	}

	// Verify CJK content with special characters preserved
	if inputs[0].Name != "我的「AWS」账户, 测试版" {
		t.Errorf("expected CJK name with special chars, got '%s'", inputs[0].Name)
	}
	if inputs[1].Name != "阿里云 OSS (杭州)" {
		t.Errorf("expected parentheses preserved, got '%s'", inputs[1].Name)
	}
	// Verify tag with comma is preserved
	if inputs[1].Tag != "开发, 测试环境" {
		t.Errorf("expected tag with comma preserved, got '%s'", inputs[1].Tag)
	}
}

func TestParseCSV_SkipsCommentRows(t *testing.T) {
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
# This is a comment row explaining provider values
Normal Account,prod,aws,s3.amazonaws.com,us-east-1,true,443,AKIAEXAMPLE,secret
Real Account,prod,aws,s3.amazonaws.com,us-east-1,true,443,AKIAREAL,secretreal`

	inputs, errs := parseCSV([]byte(csv))

	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %d: %v", len(errs), errs)
	}
	// Should skip comment row (starting with #)
	if len(inputs) != 2 {
		t.Fatalf("expected 2 inputs (skipping comment row), got %d", len(inputs))
	}
	if inputs[0].Name != "Normal Account" {
		t.Errorf("expected 'Normal Account', got '%s'", inputs[0].Name)
	}
	if inputs[1].Name != "Real Account" {
		t.Errorf("expected 'Real Account', got '%s'", inputs[1].Name)
	}
}

func TestParseCSV_InvalidProvider(t *testing.T) {
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
Account A,prod,s3,s3.amazonaws.com,us-east-1,true,443,AKIAEXAMPLE,secret
Account B,dev,alibabacloud,oss.aliyuncs.com,cn-hangzhou,true,443,LTAI123,secret2`

	inputs, errs := parseCSV([]byte(csv))

	if len(inputs) != 0 {
		t.Errorf("expected 0 valid inputs due to invalid provider, got %d", len(inputs))
	}
	if len(errs) != 2 {
		t.Fatalf("expected 2 errors, got %d", len(errs))
	}

	// Check error message contains valid provider hint
	if errs[0].Field != "provider" {
		t.Errorf("expected error field 'provider', got '%s'", errs[0].Field)
	}
	if !strings.Contains(errs[0].Message, "aws") || !strings.Contains(errs[0].Message, "oss") {
		t.Errorf("error message should list valid providers, got '%s'", errs[0].Message)
	}
}

func TestParseCSV_ValidProviders(t *testing.T) {
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
AWS Account,prod,aws,s3.amazonaws.com,us-east-1,true,443,AKIA1,secret1
OSS Account,prod,oss,oss.aliyuncs.com,cn-hangzhou,true,443,LTAI1,secret2
COS Account,prod,cos,cos.ap-beijing.myqcloud.com,ap-beijing,true,443,COS1,secret3
R2 Account,prod,r2,r2.cloudflarestorage.com,,true,443,R21,secret4
Qiniu Account,prod,qiniu,qiniu.com,,true,443,QN1,secret5
MinIO Account,prod,minio,minio.example.com,,true,9000,MINIO1,secret6
Custom Account,prod,custom,example.com,,true,443,CUSTOM1,secret7
Empty Provider,prod,,example.com,,true,443,EMPTY1,secret8`

	inputs, errs := parseCSV([]byte(csv))

	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid providers, got %d: %v", len(errs), errs)
	}
	if len(inputs) != 8 {
		t.Fatalf("expected 8 inputs, got %d", len(inputs))
	}
}

func TestParseJSON_ValidArray(t *testing.T) {
	json := `[
		{
			"name": "Account A",
			"tag": "prod",
			"provider": "aws",
			"endpoint": "s3.amazonaws.com",
			"region": "us-east-1",
			"useSSL": true,
			"port": 443,
			"accessKeyId": "AKIAEXAMPLE1",
			"secretAccessKey": "secret1"
		},
		{
			"name": "Account B",
			"tag": "dev",
			"provider": "oss",
			"endpoint": "oss-cn-hangzhou.aliyuncs.com",
			"region": "cn-hangzhou",
			"useSSL": true,
			"port": 443,
			"accessKeyId": "LTAIEXAMPLE2",
			"secretAccessKey": "secret2"
		}
	]`

	inputs, errs := parseJSON([]byte(json))

	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %d: %v", len(errs), errs)
	}
	if len(inputs) != 2 {
		t.Fatalf("expected 2 inputs, got %d", len(inputs))
	}

	if inputs[0].Name != "Account A" {
		t.Errorf("expected name 'Account A', got '%s'", inputs[0].Name)
	}
	if inputs[1].Name != "Account B" {
		t.Errorf("expected name 'Account B', got '%s'", inputs[1].Name)
	}
}

func TestParseJSON_SingleObject(t *testing.T) {
	json := `{
		"name": "Single Account",
		"tag": "test",
		"provider": "aws",
		"endpoint": "s3.amazonaws.com",
		"region": "us-east-1",
		"useSSL": true,
		"port": 443,
		"accessKeyId": "AKIAEXAMPLE",
		"secretAccessKey": "secret"
	}`

	inputs, errs := parseJSON([]byte(json))

	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %d: %v", len(errs), errs)
	}
	if len(inputs) != 1 {
		t.Fatalf("expected 1 input, got %d", len(inputs))
	}
	if inputs[0].Name != "Single Account" {
		t.Errorf("expected name 'Single Account', got '%s'", inputs[0].Name)
	}
}

func TestParseJSON_MissingRequiredField(t *testing.T) {
	json := `[
		{
			"name": "Good Account",
			"endpoint": "s3.amazonaws.com",
			"accessKeyId": "AKIAEXAMPLE",
			"secretAccessKey": "secret"
		},
		{
			"name": "Missing Endpoint",
			"accessKeyId": "AKIAEXAMPLE2",
			"secretAccessKey": "secret2"
		}
	]`

	inputs, errs := parseJSON([]byte(json))

	if len(inputs) != 1 {
		t.Fatalf("expected 1 valid input, got %d", len(inputs))
	}
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errs))
	}
	if errs[0].Field != "endpoint" {
		t.Errorf("expected error field 'endpoint', got '%s'", errs[0].Field)
	}
}

func TestParseJSON_InvalidFormat(t *testing.T) {
	json := `not valid json`

	inputs, errs := parseJSON([]byte(json))

	if len(inputs) != 0 {
		t.Errorf("expected 0 inputs, got %d", len(inputs))
	}
	if len(errs) == 0 {
		t.Fatal("expected error for invalid json")
	}
	if errs[0].Index != 0 {
		t.Errorf("expected file-level error (index 0), got %d", errs[0].Index)
	}
}

func TestParseJSON_InvalidProvider(t *testing.T) {
	json := `[
		{
			"name": "Account A",
			"provider": "amazon-s3",
			"endpoint": "s3.amazonaws.com",
			"accessKeyId": "AKIAEXAMPLE",
			"secretAccessKey": "secret"
		}
	]`

	inputs, errs := parseJSON([]byte(json))

	if len(inputs) != 0 {
		t.Errorf("expected 0 valid inputs, got %d", len(inputs))
	}
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errs))
	}
	if errs[0].Field != "provider" {
		t.Errorf("expected error field 'provider', got '%s'", errs[0].Field)
	}
	if !strings.Contains(errs[0].Message, "aws") {
		t.Errorf("error message should list valid providers, got '%s'", errs[0].Message)
	}
}

func TestParseJSON_CJKCharacters(t *testing.T) {
	json := `[
		{
			"name": "我的「AWS」账户",
			"tag": "生产环境, 测试",
			"provider": "aws",
			"endpoint": "s3.amazonaws.com",
			"region": "us-east-1",
			"accessKeyId": "AKIAEXAMPLE",
			"secretAccessKey": "secret"
		}
	]`

	inputs, errs := parseJSON([]byte(json))

	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %d: %v", len(errs), errs)
	}
	if len(inputs) != 1 {
		t.Fatalf("expected 1 input, got %d", len(inputs))
	}
	if inputs[0].Name != "我的「AWS」账户" {
		t.Errorf("expected CJK name preserved, got '%s'", inputs[0].Name)
	}
	if inputs[0].Tag != "生产环境, 测试" {
		t.Errorf("expected CJK tag with comma preserved, got '%s'", inputs[0].Tag)
	}
}

func TestGenerateCSVTemplate(t *testing.T) {
	template := GenerateCSVTemplate()

	content := string(template)
	if !strings.Contains(content, "name,tag,provider,endpoint,region") {
		t.Error("template should contain header row")
	}
	if !strings.Contains(content, "我的 AWS 账户") {
		t.Error("template should contain example data")
	}
	if !strings.Contains(content, "阿里云 OSS") {
		t.Error("template should contain second example")
	}
	// Verify provider hint comment is included
	if !strings.Contains(content, "# provider") {
		t.Error("template should contain provider hint comment")
	}
	if !strings.Contains(content, "aws") && !strings.Contains(content, "oss") {
		t.Error("template should list valid provider values")
	}
}

func TestGenerateJSONTemplate(t *testing.T) {
	template := GenerateJSONTemplate()

	content := string(template)
	if !strings.Contains(content, `"name"`) {
		t.Error("template should contain name field")
	}
	if !strings.Contains(content, "我的 AWS 账户") {
		t.Error("template should contain example data")
	}
	if !strings.Contains(content, "阿里云 OSS") {
		t.Error("template should contain second example")
	}
}

func TestImportBatchData_CSV(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newTestStore(t), testCipher(t), &fakeDialer{}, NewMemorySessionStore())

	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
Batch Account 1,prod,aws,s3.amazonaws.com,us-east-1,true,443,AKIABATCH1,secret1
Batch Account 2,dev,oss,oss-cn-hangzhou.aliyuncs.com,cn-hangzhou,true,443,LTAIBATCH2,secret2`

	result, err := svc.ImportBatchData(ctx, []byte(csv), "csv")
	if err != nil {
		t.Fatalf("import batch data: %v", err)
	}

	if result.Total != 2 {
		t.Errorf("expected total 2, got %d", result.Total)
	}
	if result.Imported != 2 {
		t.Errorf("expected imported 2, got %d", result.Imported)
	}
	if result.Failed != 0 {
		t.Errorf("expected failed 0, got %d", result.Failed)
	}

	// Verify accounts were created
	accounts, err := svc.ListAccounts(ctx)
	if err != nil {
		t.Fatalf("list accounts: %v", err)
	}
	if len(accounts) != 2 {
		t.Fatalf("expected 2 accounts, got %d", len(accounts))
	}
}

func TestImportBatchData_JSON(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newTestStore(t), testCipher(t), &fakeDialer{}, NewMemorySessionStore())

	json := `[
		{
			"name": "JSON Account 1",
			"tag": "test",
			"provider": "aws",
			"endpoint": "s3.amazonaws.com",
			"region": "us-east-1",
			"useSSL": true,
			"port": 443,
			"accessKeyId": "AKIAJSON1",
			"secretAccessKey": "secretjson1"
		}
	]`

	result, err := svc.ImportBatchData(ctx, []byte(json), "json")
	if err != nil {
		t.Fatalf("import batch data: %v", err)
	}

	if result.Imported != 1 {
		t.Errorf("expected imported 1, got %d", result.Imported)
	}

	accounts, err := svc.ListAccounts(ctx)
	if err != nil {
		t.Fatalf("list accounts: %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("expected 1 account, got %d", len(accounts))
	}
	if accounts[0].Name != "JSON Account 1" {
		t.Errorf("expected name 'JSON Account 1', got '%s'", accounts[0].Name)
	}
}

func TestImportBatchData_SkipsDuplicates(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newTestStore(t), testCipher(t), &fakeDialer{}, NewMemorySessionStore())

	// First, create an existing account
	_, err := svc.CreateAccount(ctx, CreateAccountInput{
		Name:            "Existing Account",
		Tag:             "existing",
		Provider:        types.ProviderAWS,
		Endpoint:        "s3.amazonaws.com",
		AccessKeyID:     "AKIAEXISTING",
		SecretAccessKey: "secretexisting",
		Region:          "us-east-1",
		UseSSL:          true,
		Port:            443,
	})
	if err != nil {
		t.Fatalf("create existing account: %v", err)
	}

	// Try to import a duplicate
	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
Existing Account,dup,aws,s3.amazonaws.com,us-east-1,true,443,AKIADUP,secretdup
New Account,new,aws,s3.us-west-2.amazonaws.com,us-west-2,true,443,AKIANEW,secretnew`

	result, err := svc.ImportBatchData(ctx, []byte(csv), "csv")
	if err != nil {
		t.Fatalf("import batch data: %v", err)
	}

	if result.Total != 2 {
		t.Errorf("expected total 2, got %d", result.Total)
	}
	if result.Imported != 1 {
		t.Errorf("expected imported 1, got %d", result.Imported)
	}
	if result.Skipped != 1 {
		t.Errorf("expected skipped 1, got %d", result.Skipped)
	}

	// Verify we have 2 accounts total (1 existing + 1 new)
	accounts, err := svc.ListAccounts(ctx)
	if err != nil {
		t.Fatalf("list accounts: %v", err)
	}
	if len(accounts) != 2 {
		t.Fatalf("expected 2 accounts total, got %d", len(accounts))
	}
}

func TestImportBatchData_PartialFailure(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newTestStore(t), testCipher(t), &fakeDialer{}, NewMemorySessionStore())

	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
Good Account,prod,aws,s3.amazonaws.com,us-east-1,true,443,AKIAGOOD,secretgood
,bad,aws,s3.amazonaws.com,us-east-1,true,443,AKIABAD,secretbad
Another Good,test,oss,oss-cn-hangzhou.aliyuncs.com,cn-hangzhou,true,443,LTAIGOOD2,secretgood2`

	result, err := svc.ImportBatchData(ctx, []byte(csv), "csv")
	if err != nil {
		t.Fatalf("import batch data: %v", err)
	}

	if result.Total != 3 {
		t.Errorf("expected total 3, got %d", result.Total)
	}
	if result.Imported != 2 {
		t.Errorf("expected imported 2, got %d", result.Imported)
	}
	if result.Failed != 1 {
		t.Errorf("expected failed 1, got %d", result.Failed)
	}
	if len(result.Errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(result.Errors))
	}
}

func TestImportBatchData_UnsupportedFormat(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newTestStore(t), testCipher(t), &fakeDialer{}, NewMemorySessionStore())

	_, err := svc.ImportBatchData(ctx, []byte("data"), "xml")
	if err == nil {
		t.Fatal("expected error for unsupported format")
	}
	if !strings.Contains(err.Error(), "xml") {
		t.Errorf("error should mention unsupported format, got: %v", err)
	}
}

func TestImportBatchData_EmptyFile(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newTestStore(t), testCipher(t), &fakeDialer{}, NewMemorySessionStore())

	_, err := svc.ImportBatchData(ctx, []byte{}, "csv")
	if err == nil {
		t.Fatal("expected error for empty file")
	}
}

func TestImportBatchData_SetsActiveAccount(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newTestStore(t), testCipher(t), &fakeDialer{}, NewMemorySessionStore())

	csv := `name,tag,provider,endpoint,region,useSSL,port,accessKeyId,secretAccessKey
First Account,first,aws,s3.amazonaws.com,us-east-1,true,443,AKIAFIRST,secretfirst`

	_, err := svc.ImportBatchData(ctx, []byte(csv), "csv")
	if err != nil {
		t.Fatalf("import batch data: %v", err)
	}

	// Check that the first created account becomes active
	active, err := svc.ActiveAccount(ctx)
	if err != nil {
		t.Fatalf("active account: %v", err)
	}
	if active == nil {
		t.Fatal("expected active account to be set")
	}
	if active.Name != "First Account" {
		t.Errorf("expected active account 'First Account', got '%s'", active.Name)
	}
}
