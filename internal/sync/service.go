package sync

import (
	"context"
	"errors"
	"sync"
)

// service implements the Service interface.
// intended to be expanded in future tasks.
type service struct {
	mu    sync.RWMutex
	rules map[string]*SyncRule
}

func NewService() Service {
	return &service{
		rules: make(map[string]*SyncRule),
	}
}

func (s *service) CreateRule(ctx context.Context, rule *SyncRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if rule.ID == "" {
		return errors.New("rule id required")
	}
	s.rules[rule.ID] = rule
	return nil
}

func (s *service) UpdateRule(ctx context.Context, rule *SyncRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.rules[rule.ID]; !ok {
		return errors.New("rule not found")
	}
	s.rules[rule.ID] = rule
	return nil
}

func (s *service) DeleteRule(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.rules, id)
	return nil
}

func (s *service) ListRules(ctx context.Context) ([]*SyncRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*SyncRule, 0, len(s.rules))
	for _, r := range s.rules {
		list = append(list, r)
	}
	return list, nil
}

func (s *service) GetRule(ctx context.Context, id string) (*SyncRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.rules[id]
	if !ok {
		return nil, errors.New("rule not found")
	}
	return r, nil
}

func (s *service) StartSync(ctx context.Context, ruleID string) (*SyncTask, error) {
	return nil, errors.New("not implemented")
}

func (s *service) StopSync(ctx context.Context, ruleID string) error {
	return errors.New("not implemented")
}

func (s *service) ListTasks(ctx context.Context, ruleID string) ([]*SyncTask, error) {
	return nil, errors.New("not implemented")
}
