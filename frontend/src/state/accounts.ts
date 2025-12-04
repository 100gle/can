import { useSyncExternalStore } from "react"
import { ActiveAccount, ListAccounts, SetActiveAccount, SupportedProviders, TestAccountConnection } from "../../wailsjs/go/main/App"
import type { accounts as AccountModels, types as ProviderModels } from "../../wailsjs/go/models"
import { isBridgeAvailable } from "@/lib/bridge"

type WailsAccount = AccountModels.Account

export type AccountModel = Omit<WailsAccount, "convertValues"> & {
  convertValues?: WailsAccount["convertValues"]
}
export type ProviderMetadata = ProviderModels.ProviderMetadata

export type ConnectionProbe = {
  status: "idle" | "running" | "ok" | "error"
  message?: string
  checkedAt?: string
}

export type AccountsState = {
  accounts: AccountModel[]
  providers: ProviderMetadata[]
  loading: boolean
  error?: string
  activeAccountId?: string
  connectionProbe: ConnectionProbe
}

type Listener = () => void

const clone = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const normalizeAccount = (record: AccountModels.Account | AccountModel | null | undefined): AccountModel | null => {
  if (!record) return null
  return { ...(record as AccountModel) }
}

const normalizeAccountList = (records: AccountModels.Account[]): AccountModel[] => {
  return records.map((record) => normalizeAccount(record)!).filter(Boolean)
}
const FALLBACK_ACCOUNTS: AccountModel[] = [
  {
    id: "seed-aws",
    name: "AWS 主账户",
    provider: "aws",
    providerLabel: "AWS S3",
    endpoint: "https://s3.amazonaws.com",
    region: "us-east-1",
    useSSL: true,
    port: 443,
    accessKeyPreview: "AKIA***99",
    hasSecret: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "seed-oss",
    name: "阿里云杭州",
    provider: "oss",
    providerLabel: "Aliyun OSS",
    endpoint: "https://oss-cn-hangzhou.aliyuncs.com",
    region: "cn-hangzhou",
    useSSL: true,
    port: 443,
    accessKeyPreview: "LTAI***11",
    hasSecret: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const FALLBACK_PROVIDERS: ProviderMetadata[] = [
  { id: "aws", label: "AWS S3", description: "Amazon S3 Regions & GovCloud" },
  { id: "oss", label: "Aliyun OSS", description: "Object Storage Service" },
  { id: "cos", label: "Tencent COS", description: "Tencent Cloud Object Storage" },
  { id: "r2", label: "Cloudflare R2", description: "Durable object storage" },
]

const initialState: AccountsState = {
  accounts: [],
  providers: [],
  loading: false,
  activeAccountId: undefined,
  connectionProbe: { status: "idle" },
}

class AccountsStore {
  private state: AccountsState = initialState
  private listeners = new Set<Listener>()
  private hydration?: Promise<void>

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = () => this.state

  private setState = (partial: Partial<AccountsState>) => {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((listener) => listener())
  }

  bootstrap = () => {
    if (!this.hydration) {
      this.hydration = this.refresh()
    }
    return this.hydration
  }

  refresh = async () => {
    this.setState({ loading: true, error: undefined })
    const useBridge = isBridgeAvailable()
    try {
      let accounts: AccountModel[] = []
      let providers: ProviderMetadata[] = []
      let active: AccountModel | null = null

      if (useBridge) {
        const [rawAccounts, providerPayload, activePayload] = await Promise.all([
          ListAccounts(),
          SupportedProviders(),
          ActiveAccount(),
        ])
        accounts = normalizeAccountList(rawAccounts)
        providers = providerPayload
        active = normalizeAccount(activePayload as AccountModels.Account | null)
      } else {
        accounts = clone(FALLBACK_ACCOUNTS)
        providers = clone(FALLBACK_PROVIDERS)
        active = accounts[0] ?? null
      }

      const activeAccountId = (active ? active.id : undefined) ?? accounts[0]?.id
      this.setState({
        accounts,
        providers,
        activeAccountId,
        loading: false,
        error: undefined,
        connectionProbe: activeAccountId ? { status: "idle" } : this.state.connectionProbe,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载账户失败"
      this.setState({ loading: false, error: message })
    }
  }

  setActiveAccount = async (accountId: string) => {
    if (this.state.activeAccountId === accountId) return
    const useBridge = isBridgeAvailable()
    try {
      this.setState({ loading: true, error: undefined })
      if (useBridge) {
        await SetActiveAccount(accountId)
      }
      this.setState({ activeAccountId: accountId, loading: false, connectionProbe: { status: "idle" } })
    } catch (error) {
      const message = error instanceof Error ? error.message : "切换账户失败"
      this.setState({ loading: false, error: message })
    }
  }

  testConnection = async (accountId: string) => {
    const useBridge = isBridgeAvailable()
    this.setState({ connectionProbe: { status: "running" } })
    try {
      const result = useBridge
        ? await TestAccountConnection(accountId)
        : {
            accountId,
            provider: this.state.accounts.find((item) => item.id === accountId)?.provider ?? "aws",
            status: "ok",
            message: "示例数据 · 连接稳定",
            checkedAt: new Date().toISOString(),
          }
      this.setState({
        connectionProbe: {
          status: result.status === "ok" ? "ok" : "error",
          message: result.message,
          checkedAt: result.checkedAt,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "连接测试失败"
      this.setState({ connectionProbe: { status: "error", message } })
    }
  }
}

export const accountsStore = new AccountsStore()

export const useAccountsStore = <T,>(selector: (state: AccountsState) => T): T => {
  return useSyncExternalStore(accountsStore.subscribe, () => selector(accountsStore.getState()))
}
