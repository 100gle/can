import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams } from "@tanstack/react-router";
import { CreateBucketSnapshot } from "@wailsjs/go/main/App";
import { Camera } from "lucide-react";
import { useState } from "react";

export function SnapshotPanel() {
  const { accountId, bucketId } = useParams({ from: "/accounts/$accountId/buckets/$bucketId/settings" });
  const [loading, setLoading] = useState(false);

  const handleCreateSnapshot = async () => {
    if (!accountId || !bucketId) return;
    setLoading(true);
    try {
      await CreateBucketSnapshot(accountId, bucketId);
      window.alert("Snapshot created successfully");
    } catch (err) {
      window.alert("Failed to create snapshot: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Bucket Snapshots
          </CardTitle>
          <CardDescription>
            Create a metadata snapshot of all objects in this bucket. This allows you to track changes over time or restore deleted file references.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="bg-muted/50 p-4 rounded-md text-sm text-neutral-600 dark:text-neutral-400">
               Snapshots capture the state of your bucket (object keys, sizes, hashes) at a point in time. 
               They do not duplicate the actual data, making them lightweight and fast.
            </div>
            <div className="flex justify-end">
                <Button onClick={handleCreateSnapshot} disabled={loading}>
                    {loading ? "Creating..." : "Create New Snapshot"}
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* List of snapshots could go here in future iterations */}
    </div>
  );
}
