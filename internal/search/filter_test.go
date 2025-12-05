package search

import (
	"testing"
	"time"
)

func TestApplyFilters(t *testing.T) {
	now := time.Now()
	objects := []objectRecord{
		{Key: "docs/readme.txt", Size: 512, LastModified: now.Add(-1 * time.Hour)},
		{Key: "images/logo.png", Size: 2048, LastModified: now.Add(-2 * time.Hour)},
		{Key: "archive/data.zip", Size: 20 * 1024 * 1024, LastModified: now.Add(-24 * time.Hour)},
	}

	tests := []struct {
		name   string
		query  SearchQuery
		expect int
	}{
		{
			name:   "size min filters small",
			query:  SearchQuery{MinSize: 1024},
			expect: 2,
		},
		{
			name:   "size max filters large",
			query:  SearchQuery{MaxSize: 1024},
			expect: 1,
		},
		{
			name:   "file type png",
			query:  SearchQuery{FileTypes: []string{"png"}},
			expect: 1,
		},
		{
			name:   "search text read",
			query:  SearchQuery{SearchText: "read"},
			expect: 1,
		},
		{
			name: "time window",
			query: SearchQuery{
				StartTime: ptrTime(now.Add(-3 * time.Hour)),
				EndTime:   ptrTime(now),
			},
			expect: 2,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := ApplyFilters(objects, &test.query)
			if len(result) != test.expect {
				t.Fatalf("expected %d results, got %d", test.expect, len(result))
			}
		})
	}
}

func ptrTime(value time.Time) *time.Time {
	return &value
}
