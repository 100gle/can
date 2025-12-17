package storage

import (
	"can/internal/types"
	"errors"
)

var ErrUnsupportedFeature = errors.New("feature not supported for this provider")

type Feature uint64

const (
	FeatureMAZ Feature = 1 << iota
	FeatureCOZ
	FeatureReferer
	FeatureSymlink
)

type ProviderFeatureFlag struct {
	Provider types.Provider
	Flags    Feature
}

var ProviderFeatureFlags = []ProviderFeatureFlag{
	{Provider: types.ProviderCOS, Flags: FeatureMAZ | FeatureCOZ},
	{Provider: types.ProviderOSS, Flags: FeatureReferer | FeatureSymlink},
}

func HasFeature(flags Feature, f Feature) bool {
	return flags&f != 0
}

func providerFeatures(provider types.Provider) Feature {
	for _, entry := range ProviderFeatureFlags {
		if entry.Provider == provider {
			return entry.Flags
		}
	}
	return 0
}
