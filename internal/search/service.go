package search

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"mime"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"can/internal/accounts"
	"can/internal/providers"
)

const (
	defaultSearchLimit = 100
	maxSearchLimit     = 1000
	maxObjectsScanned  = 10000
	maxExportRows      = 5000
)

// Service provides high-level object search and export utilities.
type Service struct {
	accounts     *accounts.Service
	pool         providers.ClientPool
	savedQueries SavedQueryStore
}

type listTask struct {
	prefix string
	marker string
}

// NewService constructs a search service instance.
func NewService(accounts *accounts.Service, pool providers.ClientPool, store SavedQueryStore) *Service {
	if store == nil {
		store = NewMemorySavedQueryStore()
	}
	return &Service{
		accounts:     accounts,
		pool:         pool,
		savedQueries: store,
	}
}

// SearchObjects performs prefix/keyword search with optional filtering across buckets.
func (s *Service) SearchObjects(ctx context.Context, accountID string, query *SearchQuery) (*SearchResponse, error) {
	var response SearchResponse
	if strings.TrimSpace(accountID) == "" {
		return &response, errors.New("account id is required")
	}
	if query == nil {
		query = &SearchQuery{}
	}
	pageLimit := normalizeLimit(query.Limit)
	offset := query.Offset
	if offset < 0 {
		offset = 0
	}
	query.Offset = offset
	query.Limit = pageLimit
	client, err := s.client(ctx, accountID)
	if err != nil {
		return &response, err
	}
	buckets, err := s.resolveBuckets(ctx, client, query.Bucket)
	if err != nil {
		return &response, err
	}
	if len(buckets) == 0 {
		return &SearchResponse{Results: []*SearchResult{}, Total: 0, HasMore: false, NextOffset: offset}, nil
	}
	driver := client.Objects()
	needed := offset + pageLimit
	buffer := pageLimit
	maxInspect := needed + buffer
	if maxInspect > maxObjectsScanned {
		maxInspect = maxObjectsScanned
	}
	if maxInspect < pageLimit {
		maxInspect = pageLimit
	}
	tagsRequired := len(query.Tags) > 0
	var (
		collected   []objectRecord
		total       int64
		inspected   int
		hasMoreData bool
	)
	for _, bucket := range buckets {
		pending := []listTask{{prefix: query.Prefix}}
		visitedDirs := make(map[string]struct{})
		for len(pending) > 0 {
			if inspected >= maxInspect {
				hasMoreData = true
				break
			}
			idx := len(pending) - 1
			task := pending[idx]
			pending = pending[:idx]
			result, err := driver.ListObjects(ctx, providers.ListObjectsInput{
				Bucket: bucket,
				Prefix: task.prefix,
				Limit:  1000,
				Marker: task.marker,
			})
			if err != nil {
				return nil, fmt.Errorf("list objects for bucket %s: %w", bucket, err)
			}
			var (
				directories []string
				descriptors []providers.ObjectDescriptor
			)
			for _, descriptor := range result.Objects {
				if descriptor.IsDir {
					key := strings.TrimSpace(descriptor.Key)
					if key != "" {
						directories = append(directories, key)
					}
					continue
				}
				descriptors = append(descriptors, descriptor)
			}
			inspected += len(descriptors)
			batch := convertDescriptors(bucket, descriptors)
			if tagsRequired {
				s.populateTags(ctx, driver, bucket, batch)
			}
			filtered := ApplyFilters(batch, query)
			total += int64(len(filtered))
			collected = append(collected, filtered...)
			if len(collected) >= needed+buffer {
				hasMoreData = true
				break
			}
			for i := len(directories) - 1; i >= 0; i-- {
				dir := directories[i]
				if _, seen := visitedDirs[dir]; seen {
					continue
				}
				visitedDirs[dir] = struct{}{}
				pending = append(pending, listTask{prefix: dir})
			}
			if result.Truncated {
				marker := strings.TrimSpace(result.NextMarker)
				if marker == "" {
					hasMoreData = true
					break
				}
				pending = append(pending, listTask{prefix: task.prefix, marker: marker})
			}
		}
		if hasMoreData && len(collected) >= needed {
			break
		}
	}
	if len(collected) == 0 {
		return &SearchResponse{
			Results:    []*SearchResult{},
			Total:      total,
			HasMore:    hasMoreData,
			NextOffset: offset,
		}, nil
	}
	sortRecords(collected, query)
	page := paginate(collected, offset, pageLimit)
	results := make([]*SearchResult, 0, len(page))
	for _, record := range page {
		record := record
		results = append(results, &SearchResult{
			Key:          record.Key,
			Bucket:       record.Bucket,
			Size:         record.Size,
			LastModified: record.LastModified,
			ETag:         record.ETag,
			ContentType:  record.ContentType,
			StorageClass: record.StorageClass,
			Tags:         record.Tags,
			Score:        scoreRecord(record, query),
		})
	}
	nextOffset := offset + len(results)
	if !hasMoreData && nextOffset >= len(collected) {
		hasMoreData = false
	}
	if int64(nextOffset) < total {
		hasMoreData = true
	}
	response = SearchResponse{
		Results:    results,
		Total:      total,
		HasMore:    hasMoreData,
		NextOffset: nextOffset,
	}
	return &response, nil
}

// ExportSearchResults serialises the search output into CSV or JSON blobs.
func (s *Service) ExportSearchResults(ctx context.Context, accountID string, query *SearchQuery, format string) ([]byte, error) {
	if query == nil {
		query = &SearchQuery{}
	}
	format = strings.ToLower(strings.TrimSpace(format))
	switch format {
	case "csv":
		return s.exportCSV(ctx, accountID, query)
	case "json":
		return s.exportJSON(ctx, accountID, query)
	default:
		return nil, fmt.Errorf("unsupported export format %q", format)
	}
}

func (s *Service) exportCSV(ctx context.Context, accountID string, query *SearchQuery) ([]byte, error) {
	buffer := &bytes.Buffer{}
	writer := csv.NewWriter(buffer)
	if err := writer.Write([]string{"Key", "Bucket", "Size", "LastModified", "ContentType", "StorageClass"}); err != nil {
		return nil, err
	}
	if err := s.iterateAll(ctx, accountID, query, func(result *SearchResult) error {
		row := []string{
			result.Key,
			result.Bucket,
			strconv.FormatInt(result.Size, 10),
			result.LastModified.Format(time.RFC3339),
			result.ContentType,
			result.StorageClass,
		}
		return writer.Write(row)
	}); err != nil {
		return nil, err
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func (s *Service) exportJSON(ctx context.Context, accountID string, query *SearchQuery) ([]byte, error) {
	results := make([]*SearchResult, 0, 128)
	if err := s.iterateAll(ctx, accountID, query, func(result *SearchResult) error {
		results = append(results, result)
		return nil
	}); err != nil {
		return nil, err
	}
	return json.MarshalIndent(results, "", "  ")
}

func (s *Service) iterateAll(ctx context.Context, accountID string, query *SearchQuery, fn func(*SearchResult) error) error {
	offset := 0
	rows := 0
	for rows < maxExportRows {
		pageQuery := *query
		pageQuery.Offset = offset
		pageQuery.Limit = maxSearchLimit
		result, err := s.SearchObjects(ctx, accountID, &pageQuery)
		if err != nil {
			return err
		}
		if len(result.Results) == 0 {
			break
		}
		for _, item := range result.Results {
			if err := fn(item); err != nil {
				return err
			}
			rows++
			if rows >= maxExportRows {
				return nil
			}
		}
		if !result.HasMore || result.NextOffset <= offset {
			break
		}
		offset = result.NextOffset
	}
	return nil
}

func (s *Service) client(ctx context.Context, accountID string) (providers.StorageClient, error) {
	if s.pool == nil {
		return nil, errors.New("storage client pool not configured")
	}
	supplier := func(ctx context.Context) (providers.ConnectionCredentials, error) {
		return s.accounts.ConnectionCredentials(ctx, accountID)
	}
	client, _, err := s.pool.Get(ctx, accountID, supplier)
	if err != nil {
		return nil, err
	}
	return client, nil
}

func (s *Service) resolveBuckets(ctx context.Context, client providers.StorageClient, requested string) ([]string, error) {
	if bucket := strings.TrimSpace(requested); bucket != "" {
		return []string{bucket}, nil
	}
	list, err := client.Buckets().ListBuckets(ctx)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(list))
	for _, bucket := range list {
		if bucket.Name != "" {
			names = append(names, bucket.Name)
		}
	}
	return names, nil
}

func (s *Service) populateTags(ctx context.Context, driver providers.ObjectDriver, bucket string, records []objectRecord) {
	for i := range records {
		tags, err := driver.GetObjectTags(ctx, bucket, records[i].Key)
		if err != nil {
			if errors.Is(err, providers.ErrUnsupportedCapability) {
				return
			}
			continue
		}
		records[i].Tags = tags
	}
}

func normalizeLimit(limit int) int {
	if limit <= 0 {
		return defaultSearchLimit
	}
	if limit > maxSearchLimit {
		return maxSearchLimit
	}
	return limit
}

func convertDescriptors(bucket string, descriptors []providers.ObjectDescriptor) []objectRecord {
	records := make([]objectRecord, 0, len(descriptors))
	for _, descriptor := range descriptors {
		if descriptor.IsDir {
			continue
		}
		contentType := descriptor.ContentType
		if contentType == "" {
			contentType = detectContentType(descriptor.Key)
		}
		records = append(records, objectRecord{
			Key:          descriptor.Key,
			Bucket:       bucket,
			Size:         descriptor.Size,
			LastModified: descriptor.LastModified,
			ETag:         descriptor.ETag,
			ContentType:  contentType,
			StorageClass: descriptor.StorageClass,
		})
	}
	return records
}

func detectContentType(key string) string {
	if ext := strings.ToLower(path.Ext(key)); ext != "" {
		if ctype := mime.TypeByExtension(ext); ctype != "" {
			return ctype
		}
	}
	return "application/octet-stream"
}

func sortRecords(records []objectRecord, query *SearchQuery) {
	sortBy := strings.ToLower(strings.TrimSpace(query.SortBy))
	if sortBy == "" {
		sortBy = "name"
	}
	desc := strings.ToLower(strings.TrimSpace(query.SortOrder)) == "desc"
	less := func(i, j int) bool {
		switch sortBy {
		case "size":
			if records[i].Size == records[j].Size {
				return records[i].Key < records[j].Key
			}
			return records[i].Size < records[j].Size
		case "time":
			if records[i].LastModified.Equal(records[j].LastModified) {
				return records[i].Key < records[j].Key
			}
			return records[i].LastModified.Before(records[j].LastModified)
		case "type":
			if records[i].ContentType == records[j].ContentType {
				return records[i].Key < records[j].Key
			}
			return records[i].ContentType < records[j].ContentType
		case "bucket":
			if records[i].Bucket == records[j].Bucket {
				return records[i].Key < records[j].Key
			}
			return records[i].Bucket < records[j].Bucket
		case "score":
			if scoreRecord(records[i], query) == scoreRecord(records[j], query) {
				return records[i].Key < records[j].Key
			}
			return scoreRecord(records[i], query) < scoreRecord(records[j], query)
		default:
			return records[i].Key < records[j].Key
		}
	}
	sort.SliceStable(records, func(i, j int) bool {
		if desc {
			return !less(i, j)
		}
		return less(i, j)
	})
}

func paginate(records []objectRecord, offset, limit int) []objectRecord {
	if offset >= len(records) {
		return []objectRecord{}
	}
	end := offset + limit
	if end > len(records) {
		end = len(records)
	}
	return records[offset:end]
}

func scoreRecord(record objectRecord, query *SearchQuery) float64 {
	var score float64
	lowerKey := strings.ToLower(record.Key)
	search := strings.ToLower(strings.TrimSpace(query.SearchText))
	if search != "" {
		if strings.HasPrefix(lowerKey, search) {
			score += 1.0
		} else if strings.Contains(lowerKey, search) {
			score += 0.5
		}
	}
	if prefix := strings.TrimSpace(query.Prefix); prefix != "" && strings.HasPrefix(record.Key, prefix) {
		score += 0.25
	}
	return score
}

// SaveQuery persists a search query configuration with the given name.
func (s *Service) SaveQuery(ctx context.Context, name string, query *SearchQuery) (*SavedQuery, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("name is required")
	}
	if query == nil {
		return nil, errors.New("query is required")
	}
	saved := &SavedQuery{
		Name:  name,
		Query: query,
	}
	if err := s.savedQueries.Create(ctx, saved); err != nil {
		return nil, err
	}
	return saved, nil
}

// ListSavedQueries returns all saved search queries.
func (s *Service) ListSavedQueries(ctx context.Context) ([]*SavedQuery, error) {
	return s.savedQueries.List(ctx)
}

// DeleteSavedQuery removes a saved query by ID.
func (s *Service) DeleteSavedQuery(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return errors.New("id is required")
	}
	return s.savedQueries.Delete(ctx, id)
}

// UpdateSavedQuery updates an existing saved query's name and/or query configuration.
func (s *Service) UpdateSavedQuery(ctx context.Context, id string, name string, query *SearchQuery) (*SavedQuery, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("id is required")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("name is required")
	}
	if query == nil {
		return nil, errors.New("query is required")
	}
	existing, err := s.savedQueries.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	existing.Name = name
	existing.Query = query
	if err := s.savedQueries.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}
