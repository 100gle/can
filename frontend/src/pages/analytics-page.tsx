import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { GetAnalyticsSummary } from "../../wailsjs/go/main/App";
import { analytics } from "../../wailsjs/go/models";

export function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("all");
  const [data, setData] = useState<analytics.AnalyticsSummary | null>(null);

  const loadData = async (p: string) => {
    setLoading(true);
    try {
      const result = await GetAnalyticsSummary(p);
      setData(result);
    } catch (err) {
      console.error("Failed to load analytics summary", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(provider);
  }, [provider]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <div className="w-[200px]">
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue placeholder="Select Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="aws">AWS S3</SelectItem>
              <SelectItem value="oss">Aliyun OSS</SelectItem>
              <SelectItem value="cos">Tencent COS</SelectItem>
              <SelectItem value="r2">Cloudflare R2</SelectItem>
              <SelectItem value="minio">MinIO</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost (Est.)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data ? formatCurrency(data.costMonth.totalCost) : "$0.00"}</div>
                <p className="text-xs text-muted-foreground">
                  Current month estimation
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Traffic</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data ? formatBytes(data.trafficMonth.uploadBytes + data.trafficMonth.downloadBytes) : "0 B"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload + Download
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data ? data.trafficMonth.requestCount.toLocaleString() : "0"}</div>
                <p className="text-xs text-muted-foreground">
                  API Operations
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Traffic Distribution</CardTitle>
                 <CardDescription>Upload vs Download usage.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                {data && (
                  <div className="space-y-4 p-4">
                     <div className="flex items-center gap-4">
                        <div className="w-24 text-sm font-medium">Upload</div>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500" 
                            style={{ width: `${Math.min(100, (data.trafficMonth.uploadBytes / (data.trafficMonth.uploadBytes + data.trafficMonth.downloadBytes || 1)) * 100)}%` }}
                          />
                        </div>
                        <div className="w-20 text-sm text-right">{formatBytes(data.trafficMonth.uploadBytes)}</div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="w-24 text-sm font-medium">Download</div>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500" 
                            style={{ width: `${Math.min(100, (data.trafficMonth.downloadBytes / (data.trafficMonth.uploadBytes + data.trafficMonth.downloadBytes || 1)) * 100)}%` }}
                          />
                        </div>
                        <div className="w-20 text-sm text-right">{formatBytes(data.trafficMonth.downloadBytes)}</div>
                     </div>
                  </div>
                )}
              </CardContent>
            </Card>
             <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <CardDescription>Estimated cost by category.</CardDescription>
              </CardHeader>
              <CardContent>
                  {data && (
                  <div className="space-y-4">
                     <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-sm">Storage</span>
                        <span className="font-medium">{formatCurrency(data.costMonth.storageCost)}</span>
                     </div>
                     <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-sm">Traffic</span>
                        <span className="font-medium">{formatCurrency(data.costMonth.trafficCost)}</span>
                     </div>
                     <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-sm">Requests</span>
                        <span className="font-medium">{formatCurrency(data.costMonth.requestCost)}</span>
                     </div>
                     <div className="flex justify-between items-center pt-2">
                        <span className="font-bold">Total</span>
                        <span className="font-bold text-lg">{formatCurrency(data.costMonth.totalCost)}</span>
                     </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
