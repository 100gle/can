package system

import (
	"net/http"
	"time"
)

type Service struct {
	httpClient *http.Client
}

func NewService() *Service {
	return &Service{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}
