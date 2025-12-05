package search

import (
	"path"
	"strings"
)

// ApplyFilters enforces size/time/type/tag restrictions on the provided objects.
func ApplyFilters(objects []objectRecord, query *SearchQuery) []objectRecord {
	if query == nil {
		return append([]objectRecord(nil), objects...)
	}
	filtered := make([]objectRecord, 0, len(objects))
	lowerSearch := strings.ToLower(strings.TrimSpace(query.SearchText))
	for _, object := range objects {
		if query.MinSize > 0 && object.Size < query.MinSize {
			continue
		}
		if query.MaxSize > 0 && object.Size > query.MaxSize {
			continue
		}
		if query.StartTime != nil && object.LastModified.Before(*query.StartTime) {
			continue
		}
		if query.EndTime != nil && object.LastModified.After(*query.EndTime) {
			continue
		}
		if len(query.FileTypes) > 0 && !matchesFileType(object.Key, query.FileTypes) {
			continue
		}
		if len(query.Tags) > 0 && !containsTags(object.Tags, query.Tags) {
			continue
		}
		if lowerSearch != "" && !strings.Contains(strings.ToLower(object.Key), lowerSearch) {
			continue
		}
		filtered = append(filtered, object)
	}
	return filtered
}

func matchesFileType(key string, filters []string) bool {
	extension := strings.ToLower(strings.TrimPrefix(path.Ext(key), "."))
	if extension == "" {
		return false
	}
	for _, filter := range filters {
		target := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(filter), "."))
		if target == "" {
			continue
		}
		if extension == target {
			return true
		}
	}
	return false
}

func containsTags(actual, desired map[string]string) bool {
	if len(desired) == 0 {
		return true
	}
	if len(actual) == 0 {
		return false
	}
	for key, value := range desired {
		if actual[key] != value {
			return false
		}
	}
	return true
}
