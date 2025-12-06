import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CreateMigrationJob, ListAccounts, StartMigrationJob } from "@wailsjs/go/main/App";
import { accounts, migration } from "@wailsjs/go/models";
import { useEffect, useState } from "react";

// Define local types if models aren't generated yet or to be safe
interface WizardState {
  step: number;
}

export function MigrationWizard() {
  const [step, setStep] = useState(1);
  const [accountsList, setAccountsList] = useState<accounts.Account[]>([]);
  
  // Form State
  const [sourceId, setSourceId] = useState("");
  const [sourceBucket, setSourceBucket] = useState("");
  const [sourcePrefix, setSourcePrefix] = useState("");
  
  const [destId, setDestId] = useState("");
  const [destBucket, setDestBucket] = useState("");
  const [destPrefix, setDestPrefix] = useState("");
  
  const [deleteSource, setDeleteSource] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  
  // Job State
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [stats, setStats] = useState<migration.MigrationStats | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const accs = await ListAccounts();
      setAccountsList(accs);
    } catch (err) {
      window.alert("Failed to load accounts");
    }
  };

  const handleCreateJob = async () => {
    if (!sourceId || !sourceBucket || !destId || !destBucket) {
      window.alert("Please fill in all required fields");
      return;
    }

    try {
        // Construct inputs matching Go structs
        const source: migration.EndpointInfo = {
            account_id: sourceId,
            bucket_name: sourceBucket,
            prefix: sourcePrefix,
        };
        const dest: migration.EndpointInfo = {
            account_id: destId,
            bucket_name: destBucket,
            prefix: destPrefix,
        };
        const options: migration.MigrationOptions = {
            delete_source: deleteSource,
            overwrite: overwrite,
            max_concurrency: 5,
        };

        const job = await CreateMigrationJob(source, dest, options);
        setJobId(job.id);
        setStatus(job.status);
        setStep(3);
        window.alert("Migration Job Created");
        
        // Auto start?
        await StartMigrationJob(job.id);
        setStatus("running"); // Optimistic update, ideally verify with polling or events
    } catch (err) {
        console.error(err);
        window.alert("Failed to create migration job");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Migration Wizard - Step {step}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-medium border-b pb-2">Source</h3>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select onValueChange={setSourceId} value={sourceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsList.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.provider})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bucket Name</Label>
                  <Input value={sourceBucket} onChange={(e) => setSourceBucket(e.target.value)} placeholder="my-source-bucket" />
                </div>
                <div className="space-y-2">
                  <Label>Prefix (Optional)</Label>
                  <Input value={sourcePrefix} onChange={(e) => setSourcePrefix(e.target.value)} placeholder="folders/to/move/" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium border-b pb-2">Destination</h3>
                 <div className="space-y-2">
                  <Label>Account</Label>
                  <Select onValueChange={setDestId} value={destId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsList.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.provider})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bucket Name</Label>
                  <Input value={destBucket} onChange={(e) => setDestBucket(e.target.value)} placeholder="my-dest-bucket" />
                </div>
                <div className="space-y-2">
                  <Label>Prefix (Optional)</Label>
                  <Input value={destPrefix} onChange={(e) => setDestPrefix(e.target.value)} placeholder="destination/folder/" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
             <div className="space-y-4 max-w-md mx-auto">
                <h3 className="font-medium">Configuration</h3>
                <div className="flex items-center space-x-2">
                    <Checkbox id="delSrc" checked={deleteSource} onCheckedChange={(c) => setDeleteSource(!!c)} />
                    <Label htmlFor="delSrc">Delete Source Files (Move)</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="overwrite" checked={overwrite} onCheckedChange={(c) => setOverwrite(!!c)} />
                    <Label htmlFor="overwrite">Overwrite Existing Files at Destination</Label>
                </div>
             </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
                <div className="text-xl font-bold">Migration {status}</div>
                {/* Placeholder for real stats */}
                <Progress value={0} className="w-full" />
                <p className="text-muted-foreground">Job ID: {jobId}</p>
                <div className="grid grid-cols-2 gap-4 text-left p-4 bg-muted rounded-md">
                     <div>Processed: {stats?.processed_objects || 0}</div>
                     <div>Total Objects: {stats?.total_objects || 0}</div>
                     {/* Add more stats here */}
                </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {step > 1 && step < 3 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          {step === 1 && <Button onClick={() => setStep(2)}>Next: Configure</Button>}
          {step === 2 && <Button onClick={handleCreateJob}>Start Migration</Button>}
          {step === 3 && <Button variant="outline" onClick={() => { setStep(1); setJobId(""); }}>Start New Migration</Button>}
        </CardFooter>
      </Card>
    </div>
  );
}
