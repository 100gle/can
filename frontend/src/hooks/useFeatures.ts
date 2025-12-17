import { useQuery } from "@tanstack/react-query";
import type { types } from "@wailsjs/go/models";

// Re-export types from Wails for convenience
export type FeatureID = string;
export type ProviderFeature = types.ProviderFeature;

const FEATURES_KEY = (accountId?: string) => ["provider-features", accountId];

/**
 * Hook to fetch and check provider features for an account via TanStack Query.
 * Keeps remote data in the query cache; only derives UI helpers locally.
 */
export function useFeatures(accountId: string | undefined) {
  const query = useQuery({
    queryKey: FEATURES_KEY(accountId),
    queryFn: async () => {
      if (!accountId) return [];
      const { GetProviderFeatures } = await import("@wailsjs/go/app/App");
      const caps = await GetProviderFeatures(accountId);
      return caps ?? [];
    },
    enabled: Boolean(accountId),
    staleTime: 30_000,
    retry: false,
  });

  const features = query.data ?? [];

  const hasFeature = (featureId: FeatureID): boolean => {
    const cap = features.find((c) => c.featureId === featureId);
    return cap?.supported ?? false;
  };

  const getFeature = (featureId: FeatureID): ProviderFeature | undefined => {
    return features.find((c) => c.featureId === featureId);
  };

  const supportedFeatures = features.filter((c) => c.supported);
  const unsupportedFeatures = features.filter((c) => !c.supported);

  return {
    features,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    hasFeature,
    getFeature,
    supportedFeatures,
    unsupportedFeatures,
    refetch: query.refetch,
  };
}
