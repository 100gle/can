package accounts

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
	"testing"

	"can/internal/providers"
	"can/internal/security"
	"can/internal/types"
)

func TestServiceExportImportRoundTrip(t *testing.T) {
	ctx := context.Background()
	cipher := testCipher(t)
	svc := NewService(NewMemoryStore(), cipher, providers.NewStubDialer(), NewMemorySessionStore())

	if _, err := svc.CreateAccount(ctx, CreateAccountInput{
		Name:            "Account A",
		Tag:             "primary",
		Provider:        types.ProviderAWS,
		Endpoint:        "https://s3.amazonaws.com",
		AccessKeyID:     "AKIA-A",
		SecretAccessKey: "secret-a",
		Region:          "us-east-1",
		UseSSL:          true,
		Port:            443,
	}); err != nil {
		t.Fatalf("create account A: %v", err)
	}
	if _, err := svc.CreateAccount(ctx, CreateAccountInput{
		Name:            "Account B",
		Tag:             "backup",
		Provider:        types.ProviderOSS,
		Endpoint:        "https://oss-cn-hangzhou.aliyuncs.com",
		AccessKeyID:     "LTAI-B",
		SecretAccessKey: "secret-b",
		Region:          "cn-hangzhou",
		UseSSL:          true,
		Port:            443,
	}); err != nil {
		t.Fatalf("create account B: %v", err)
	}

	exportData, err := svc.ExportData(ctx)
	if err != nil {
		t.Fatalf("export data: %v", err)
	}
	if exportData.Count != 2 {
		t.Fatalf("expected 2 accounts exported, got %d", exportData.Count)
	}

	dest := NewService(NewMemoryStore(), cipher, providers.NewStubDialer(), NewMemorySessionStore())
	result, err := dest.ImportData(ctx, exportData.Blob)
	if err != nil {
		t.Fatalf("import data: %v", err)
	}
	if result.Imported != 2 {
		t.Fatalf("expected 2 imported, got %d", result.Imported)
	}
	if result.Skipped != 0 || result.Failed != 0 {
		t.Fatalf("expected 0 skipped/failed, got skipped=%d failed=%d", result.Skipped, result.Failed)
	}

	accounts, err := dest.ListAccounts(ctx)
	if err != nil {
		t.Fatalf("list accounts: %v", err)
	}
	if len(accounts) != 2 {
		t.Fatalf("expected 2 accounts after import, got %d", len(accounts))
	}
	expectedTags := map[string]string{"Account A": "primary", "Account B": "backup"}
	for _, account := range accounts {
		expectedTag, ok := expectedTags[account.Name]
		if !ok {
			t.Fatalf("unexpected account imported: %s", account.Name)
		}
		if account.Tag != expectedTag {
			t.Fatalf("account %s expected tag %s, got %s", account.Name, expectedTag, account.Tag)
		}
	}
}

func TestImportSkipsDuplicates(t *testing.T) {
	ctx := context.Background()
	cipher := testCipher(t)
	exporter := NewService(NewMemoryStore(), cipher, providers.NewStubDialer(), NewMemorySessionStore())
	input := CreateAccountInput{
		Name:            "Duplicate",
		Tag:             "dup",
		Provider:        types.ProviderCOS,
		Endpoint:        "https://cos.ap-beijing.myqcloud.com",
		AccessKeyID:     "COS-A",
		SecretAccessKey: "secret-cos",
		Region:          "ap-beijing",
		UseSSL:          true,
		Port:            443,
	}
	if _, err := exporter.CreateAccount(ctx, input); err != nil {
		t.Fatalf("create exporter account: %v", err)
	}
	exportData, err := exporter.ExportData(ctx)
	if err != nil {
		t.Fatalf("export data: %v", err)
	}

	importer := NewService(NewMemoryStore(), cipher, providers.NewStubDialer(), NewMemorySessionStore())
	if _, err := importer.CreateAccount(ctx, input); err != nil {
		t.Fatalf("seed importer account: %v", err)
	}
	result, err := importer.ImportData(ctx, exportData.Blob)
	if err != nil {
		t.Fatalf("import data: %v", err)
	}
	if result.Imported != 0 {
		t.Fatalf("expected 0 imported, got %d", result.Imported)
	}
	if result.Skipped != 1 {
		t.Fatalf("expected 1 skipped, got %d", result.Skipped)
	}
	if len(result.Issues) == 0 {
		t.Fatalf("expected issues describing skip")
	}
}

func TestImportRejectsInvalidPayload(t *testing.T) {
	ctx := context.Background()
	cipher := testCipher(t)
	svc := NewService(NewMemoryStore(), cipher, providers.NewStubDialer(), NewMemorySessionStore())
	if _, err := svc.ImportData(ctx, []byte("not-json")); err == nil {
		t.Fatalf("expected error for invalid payload")
	}
}

func TestSQLiteStorePersistsData(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	dsn := filepath.Join(root, "accounts.db")
	store, err := NewSQLiteStore(dsn)
	if err != nil {
		t.Fatalf("new sqlite store: %v", err)
	}
	svc := NewService(store, testCipher(t), providers.NewStubDialer(), NewMemorySessionStore())
	if _, err := svc.CreateAccount(ctx, CreateAccountInput{
		Name:            "SQLite Account",
		Provider:        types.ProviderAWS,
		Endpoint:        "https://s3.amazonaws.com",
		AccessKeyID:     "AKIA-SQLITE",
		SecretAccessKey: "sqlite-secret",
		Region:          "us-east-1",
		UseSSL:          true,
		Port:            443,
	}); err != nil {
		t.Fatalf("create account: %v", err)
	}
	records, err := svc.ListAccounts(ctx)
	if err != nil {
		t.Fatalf("list accounts: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 account, got %d", len(records))
	}
	if records[0].Name != "SQLite Account" {
		t.Fatalf("unexpected account name: %s", records[0].Name)
	}
}

func TestActiveAccountPersistsViaSessionStore(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()
	sessionStore := NewMemorySessionStore()
	cipher := testCipher(t)
	dialer := providers.NewStubDialer()

	svc := NewService(store, cipher, dialer, sessionStore)
	account, err := svc.CreateAccount(ctx, CreateAccountInput{
		Name:            "Primary",
		Provider:        types.ProviderAWS,
		Endpoint:        "https://s3.amazonaws.com",
		AccessKeyID:     "AKIA-PRIMARY",
		SecretAccessKey: "secret",
		Region:          "us-east-1",
		UseSSL:          true,
		Port:            443,
	})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	if _, err := svc.SetActiveAccount(ctx, account.ID); err != nil {
		t.Fatalf("set active account: %v", err)
	}

	// Simulate a new service instance (e.g., application restart).
	svcReloaded := NewService(store, cipher, dialer, sessionStore)
	active, err := svcReloaded.ActiveAccount(ctx)
	if err != nil {
		t.Fatalf("active account: %v", err)
	}
	if active == nil || active.ID != account.ID {
		t.Fatalf("expected active account %s, got %#v", account.ID, active)
	}
}

func TestServiceActiveAccountConcurrentAccess(t *testing.T) {
	ctx := context.Background()
	svc := NewService(NewMemoryStore(), testCipher(t), providers.NewStubDialer(), NewMemorySessionStore())
	accA, err := svc.CreateAccount(ctx, CreateAccountInput{
		Name:            "Concurrent-A",
		Provider:        types.ProviderAWS,
		Endpoint:        "https://s3.amazonaws.com",
		AccessKeyID:     "AKIA-CONCURRENT-A",
		SecretAccessKey: "secret-a",
		Region:          "us-east-1",
		UseSSL:          true,
		Port:            443,
	})
	if err != nil {
		t.Fatalf("create account A: %v", err)
	}
	accB, err := svc.CreateAccount(ctx, CreateAccountInput{
		Name:            "Concurrent-B",
		Provider:        types.ProviderOSS,
		Endpoint:        "https://oss-cn-hangzhou.aliyuncs.com",
		AccessKeyID:     "LTAI-CONCURRENT-B",
		SecretAccessKey: "secret-b",
		Region:          "cn-hangzhou",
		UseSSL:          true,
		Port:            443,
	})
	if err != nil {
		t.Fatalf("create account B: %v", err)
	}

	recordError := func(ch chan<- error, err error) {
		if err == nil {
			return
		}
		select {
		case ch <- err:
		default:
		}
	}

	errCh := make(chan error, 8)
	var wg sync.WaitGroup
	ids := []string{accA.ID, accB.ID}
	wg.Add(3)
	go func() {
		defer wg.Done()
		for i := 0; i < 200; i++ {
			if _, err := svc.SetActiveAccount(ctx, ids[i%len(ids)]); err != nil {
				recordError(errCh, fmt.Errorf("set active: %w", err))
				return
			}
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 200; i++ {
			if _, err := svc.ActiveAccount(ctx); err != nil {
				recordError(errCh, fmt.Errorf("active account: %w", err))
				return
			}
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			label := fmt.Sprintf("Temp-%d", i)
			temp, err := svc.CreateAccount(ctx, CreateAccountInput{
				Name:            label,
				Provider:        types.ProviderCustom,
				Endpoint:        "https://example.com",
				AccessKeyID:     fmt.Sprintf("TEMP-%d", i),
				SecretAccessKey: fmt.Sprintf("secret-%d", i),
				Region:          "auto",
				UseSSL:          true,
				Port:            443,
			})
			if err != nil {
				recordError(errCh, fmt.Errorf("create temp: %w", err))
				return
			}
			if _, err := svc.SetActiveAccount(ctx, temp.ID); err != nil {
				recordError(errCh, fmt.Errorf("activate temp: %w", err))
				return
			}
			if err := svc.DeleteAccount(ctx, temp.ID); err != nil {
				recordError(errCh, fmt.Errorf("delete temp: %w", err))
				return
			}
		}
	}()
	wg.Wait()
	close(errCh)
	for err := range errCh {
		if err != nil {
			t.Fatalf("concurrent operations failed: %v", err)
		}
	}
	if _, err := svc.ActiveAccount(ctx); err != nil {
		t.Fatalf("final active lookup failed: %v", err)
	}
}

func testCipher(t *testing.T) security.Cipher {
	t.Helper()
	key := []byte("01234567890123456789012345678901")
	cipher, err := security.NewAESCipher(key)
	if err != nil {
		t.Fatalf("new aes cipher: %v", err)
	}
	return cipher
}
