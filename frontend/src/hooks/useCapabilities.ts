import { isDesktopMode } from "@/lib/bridge";
import type { types } from "@wailsjs/go/models";
import { useCallback, useEffect, useState } from "react";

// Re-export types from Wails for convenience
export type FeatureID = string;
export type ProviderCapability = types.ProviderCapability;

interface CapabilitiesState {
  capabilities: ProviderCapability[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and check provider capabilities for an account.
 * Returns capability information and helper methods.
 */
export function useCapabilities(accountId: string | undefined) {
  const [state, setState] = useState<CapabilitiesState>({
    capabilities: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!accountId || !isDesktopMode()) {
      setState({ capabilities: [], loading: false, error: null });
      return;
    }

    const loadCapabilities = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { GetProviderCapabilities } = await import("@wailsjs/go/app/App");
        const caps = await GetProviderCapabilities(accountId);
        setState({
          capabilities: caps ?? [],
          loading: false,
          error: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load capabilities";
        setState({ capabilities: [], loading: false, error: message });
      }
    };

    void loadCapabilities();
  }, [accountId]);

  /**
   * Check if a specific feature is supported by the provider.
   */
  const hasCapability = useCallback(
    (featureId: FeatureID): boolean => {
      const cap = state.capabilities.find((c) => c.featureId === featureId);
      return cap?.supported ?? false;
    },
    [state.capabilities],
  );

  /**
   * Get the capability details for a specific feature.
   */
  const getCapability = useCallback(
    (featureId: FeatureID): ProviderCapability | undefined => {
      return state.capabilities.find((c) => c.featureId === featureId);
    },
    [state.capabilities],
  );

  /**
   * Get all supported capabilities.
   */
  const supportedCapabilities = state.capabilities.filter((c) => c.supported);

  /**
   * Get all unsupported capabilities.
   */
  const unsupportedCapabilities = state.capabilities.filter((c) => !c.supported);

  return {
    ...state,
    hasCapability,
    getCapability,
    supportedCapabilities,
    unsupportedCapabilities,
  };
}
