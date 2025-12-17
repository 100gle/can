package system

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const releasesEndpoint = "https://api.github.com/repos/100gle/can/releases/latest"

type githubRelease struct {
	TagName    string    `json:"tag_name"`
	HTMLURL    string    `json:"html_url"`
	Body       string    `json:"body"`
	Published  time.Time `json:"published_at"`
	Prerelease bool      `json:"prerelease"`
	Draft      bool      `json:"draft"`
}

// CheckForUpdates queries GitHub Releases for the latest tag and compares it with the current version.
func (s *Service) CheckForUpdates(ctx context.Context, currentVersion string) (UpdateInfo, error) {
	info := UpdateInfo{
		CurrentVersion: currentVersion,
	}
	version := strings.TrimSpace(strings.TrimPrefix(currentVersion, "v"))
	if version == "" || version == "dev" {
		return info, nil
	}
	client := s.httpClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, releasesEndpoint, nil)
	if err != nil {
		return info, fmt.Errorf("构建更新请求失败: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "can-desktop-app")

	resp, err := client.Do(req)
	if err != nil {
		return info, fmt.Errorf("检查更新失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return info, fmt.Errorf("GitHub API 返回错误状态: %s", resp.Status)
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return info, fmt.Errorf("解析更新信息失败: %w", err)
	}
	latest := strings.TrimSpace(strings.TrimPrefix(release.TagName, "v"))
	info.LatestVersion = latest
	info.ReleaseURL = release.HTMLURL
	info.ReleaseNotes = release.Body
	info.PublishedAt = release.Published
	if latest == "" {
		return info, nil
	}
	if release.Draft || release.Prerelease {
		info.IsPrerelease = true
	}

	if compareSemVer(latest, version) > 0 {
		info.UpdateAvailable = true
	}
	return info, nil
}

func compareSemVer(a, b string) int {
	aparts := parseSemVer(a)
	bparts := parseSemVer(b)
	maxLen := len(aparts)
	if len(bparts) > maxLen {
		maxLen = len(bparts)
	}
	for i := 0; i < maxLen; i++ {
		var ai, bi int
		if i < len(aparts) {
			ai = aparts[i]
		}
		if i < len(bparts) {
			bi = bparts[i]
		}
		if ai > bi {
			return 1
		}
		if ai < bi {
			return -1
		}
	}
	return 0
}

func parseSemVer(ver string) []int {
	parts := strings.Split(ver, ".")
	result := make([]int, 0, len(parts))
	for _, part := range parts {
		value := 0
		for _, r := range part {
			if r < '0' || r > '9' {
				break
			}
			value = value*10 + int(r-'0')
		}
		result = append(result, value)
	}
	return result
}
