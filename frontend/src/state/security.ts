import {
  GetBucketCORS,
  GetBucketEncryption,
  GetBucketPolicy,
  GetBucketVersioning,
} from "@wailsjs/go/app/App";
import { config } from "@wailsjs/go/models";
import { create } from "zustand";

// Security check severity levels
export type SecuritySeverity = "critical" | "warning" | "info" | "pass";

// Individual security check result
export interface SecurityCheckResult {
  id: string;
  bucketName: string;
  checkType: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  recommendation?: string;
  canAutoFix?: boolean;
}

// Bucket security status summary
export interface BucketSecurityStatus {
  bucketName: string;
  encryption: {
    enabled: boolean;
    algorithm?: string;
    kmsKeyId?: string;
  };
  versioning: {
    status: string; // "Enabled" | "Suspended" | ""
  };
  policy: {
    hasPolicy: boolean;
    hasPublicAccess?: boolean;
  };
  cors: {
    hasRules: boolean;
    ruleCount: number;
  };
  overallScore: SecuritySeverity;
  loading: boolean;
  error?: string;
}

interface SecurityState {
  // Per-bucket security status
  bucketStatuses: Map<string, BucketSecurityStatus>;
  // Security check results
  checkResults: SecurityCheckResult[];
  // Scanning state
  isScanning: boolean;
  scanProgress: number;
  scanTotal: number;
  // Error state
  error: string | null;
}

interface SecurityActions {
  loadBucketSecurityStatus: (accountId: string, bucketName: string) => Promise<void>;
  loadAllBucketsSecurityStatus: (accountId: string, bucketNames: string[]) => Promise<void>;
  runSecurityCheck: (accountId: string, bucketNames: string[]) => Promise<void>;
  clearCheckResults: () => void;
  reset: () => void;
}

const initialState: SecurityState = {
  bucketStatuses: new Map(),
  checkResults: [],
  isScanning: false,
  scanProgress: 0,
  scanTotal: 0,
  error: null,
};

// Helper to calculate overall security score
function calculateOverallScore(status: Partial<BucketSecurityStatus>): SecuritySeverity {
  // Critical: No encryption OR public policy
  if (!status.encryption?.enabled) return "critical";
  if (status.policy?.hasPublicAccess) return "critical";

  // Warning: No versioning
  if (status.versioning?.status !== "Enabled") return "warning";

  return "pass";
}

// Helper to run security checks on a bucket
function runBucketChecks(bucketName: string, status: BucketSecurityStatus): SecurityCheckResult[] {
  const results: SecurityCheckResult[] = [];

  // Encryption check
  if (!status.encryption.enabled) {
    results.push({
      id: `${bucketName}-encryption`,
      bucketName,
      checkType: "encryption",
      title: "未启用默认加密",
      description: `存储桶 ${bucketName} 未配置服务端加密。数据可能以明文存储。`,
      severity: "critical",
      recommendation: "建议启用 SSE-S3 或 SSE-KMS 加密以保护静态数据。",
      canAutoFix: true,
    });
  } else {
    results.push({
      id: `${bucketName}-encryption`,
      bucketName,
      checkType: "encryption",
      title: "已启用默认加密",
      description: `存储桶使用 ${status.encryption.algorithm || "SSE"} 加密。`,
      severity: "pass",
    });
  }

  // Versioning check
  if (status.versioning.status !== "Enabled") {
    results.push({
      id: `${bucketName}-versioning`,
      bucketName,
      checkType: "versioning",
      title: "未启用版本控制",
      description: `存储桶 ${bucketName} ${status.versioning.status === "Suspended" ? "已暂停" : "未启用"}版本控制。`,
      severity: "warning",
      recommendation: "建议启用版本控制以防止意外删除或覆盖文件。",
      canAutoFix: true,
    });
  } else {
    results.push({
      id: `${bucketName}-versioning`,
      bucketName,
      checkType: "versioning",
      title: "已启用版本控制",
      description: "存储桶已启用版本控制，可防止意外删除。",
      severity: "pass",
    });
  }

  // Policy check (basic - just check if policy exists)
  if (status.policy.hasPolicy) {
    if (status.policy.hasPublicAccess) {
      results.push({
        id: `${bucketName}-policy`,
        bucketName,
        checkType: "policy",
        title: "检测到公开访问策略",
        description: `存储桶 ${bucketName} 的访问策略可能允许匿名访问。`,
        severity: "critical",
        recommendation: "请检查并限制 Bucket Policy 中的 Principal 设置。",
      });
    } else {
      results.push({
        id: `${bucketName}-policy`,
        bucketName,
        checkType: "policy",
        title: "已配置访问策略",
        description: "存储桶已配置访问策略。",
        severity: "pass",
      });
    }
  } else {
    results.push({
      id: `${bucketName}-policy`,
      bucketName,
      checkType: "policy",
      title: "未配置访问策略",
      description: "存储桶使用默认 ACL 控制访问。",
      severity: "info",
    });
  }

  // CORS check
  if (status.cors.hasRules && status.cors.ruleCount > 0) {
    results.push({
      id: `${bucketName}-cors`,
      bucketName,
      checkType: "cors",
      title: "已配置 CORS 规则",
      description: `存储桶配置了 ${status.cors.ruleCount} 条 CORS 规则。`,
      severity: "info",
      recommendation: "请确保 CORS 规则仅允许必要的来源访问。",
    });
  }

  return results;
}

export const useSecurityStore = create<SecurityState & SecurityActions>((set, get) => ({
  ...initialState,

  loadBucketSecurityStatus: async (accountId: string, bucketName: string) => {
    const currentStatuses = get().bucketStatuses;
    const newStatuses = new Map(currentStatuses);

    // Set loading state
    newStatuses.set(bucketName, {
      bucketName,
      encryption: { enabled: false },
      versioning: { status: "" },
      policy: { hasPolicy: false },
      cors: { hasRules: false, ruleCount: 0 },
      overallScore: "info",
      loading: true,
    });
    set({ bucketStatuses: newStatuses });

    try {
      // Fetch all security-related configs in parallel
      const [encryption, versioning, policy, cors] = await Promise.allSettled([
        GetBucketEncryption(accountId, bucketName),
        GetBucketVersioning(accountId, bucketName),
        GetBucketPolicy(accountId, bucketName),
        GetBucketCORS(accountId, bucketName),
      ]);

      const status: BucketSecurityStatus = {
        bucketName,
        encryption: {
          enabled: encryption.status === "fulfilled" ? encryption.value.enabled : false,
          algorithm: encryption.status === "fulfilled" ? encryption.value.algorithm : undefined,
          kmsKeyId: encryption.status === "fulfilled" ? encryption.value.kmsKeyId : undefined,
        },
        versioning: {
          status: versioning.status === "fulfilled" ? versioning.value.status : "",
        },
        policy: {
          hasPolicy: policy.status === "fulfilled" && Boolean(policy.value?.statement?.length),
          hasPublicAccess: policy.status === "fulfilled" ? checkPublicAccess(policy.value) : false,
        },
        cors: {
          hasRules: cors.status === "fulfilled" && Boolean(cors.value?.rules?.length),
          ruleCount: cors.status === "fulfilled" && cors.value?.rules ? cors.value.rules.length : 0,
        },
        overallScore: "info",
        loading: false,
      };

      status.overallScore = calculateOverallScore(status);

      const updatedStatuses = new Map(get().bucketStatuses);
      updatedStatuses.set(bucketName, status);
      set({ bucketStatuses: updatedStatuses });
    } catch (error) {
      const errorStatuses = new Map(get().bucketStatuses);
      errorStatuses.set(bucketName, {
        bucketName,
        encryption: { enabled: false },
        versioning: { status: "" },
        policy: { hasPolicy: false },
        cors: { hasRules: false, ruleCount: 0 },
        overallScore: "critical",
        loading: false,
        error: error instanceof Error ? error.message : "加载失败",
      });
      set({ bucketStatuses: errorStatuses });
    }
  },

  loadAllBucketsSecurityStatus: async (accountId: string, bucketNames: string[]) => {
    set({ isScanning: true, scanProgress: 0, scanTotal: bucketNames.length });

    for (let i = 0; i < bucketNames.length; i++) {
      await get().loadBucketSecurityStatus(accountId, bucketNames[i]);
      set({ scanProgress: i + 1 });
    }

    set({ isScanning: false });
  },

  runSecurityCheck: async (accountId: string, bucketNames: string[]) => {
    set({ isScanning: true, scanProgress: 0, scanTotal: bucketNames.length, checkResults: [] });

    const allResults: SecurityCheckResult[] = [];

    for (let i = 0; i < bucketNames.length; i++) {
      await get().loadBucketSecurityStatus(accountId, bucketNames[i]);
      const status = get().bucketStatuses.get(bucketNames[i]);
      if (status && !status.loading) {
        const results = runBucketChecks(bucketNames[i], status);
        allResults.push(...results);
      }
      set({ scanProgress: i + 1, checkResults: allResults });
    }

    set({ isScanning: false });
  },

  clearCheckResults: () => {
    set({ checkResults: [] });
  },

  reset: () => {
    set(initialState);
  },
}));

// Helper to check if policy allows public access
function checkPublicAccess(policy: config.BucketPolicy | null): boolean {
  if (!policy?.statement?.length) return false;

  return policy.statement.some((stmt) => {
    // Check for Allow effect with public principal
    if (stmt.effect?.toLowerCase() !== "allow") return false;

    const principal = stmt.principal;
    if (principal === "*") return true;
    if (typeof principal === "object" && principal !== null) {
      const aws = (principal as Record<string, unknown>)["AWS"];
      if (aws === "*") return true;
      if (Array.isArray(aws) && aws.includes("*")) return true;
    }
    return false;
  });
}

// Singleton store instance for direct access
export const securityStore = {
  loadBucketSecurityStatus: (accountId: string, bucketName: string) =>
    useSecurityStore.getState().loadBucketSecurityStatus(accountId, bucketName),
  loadAllBucketsSecurityStatus: (accountId: string, bucketNames: string[]) =>
    useSecurityStore.getState().loadAllBucketsSecurityStatus(accountId, bucketNames),
  runSecurityCheck: (accountId: string, bucketNames: string[]) =>
    useSecurityStore.getState().runSecurityCheck(accountId, bucketNames),
  clearCheckResults: () => useSecurityStore.getState().clearCheckResults(),
  reset: () => useSecurityStore.getState().reset(),
};
