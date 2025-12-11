import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionStore } from "@/state/session";

export function SessionSecurityCard() {
  const idleTimeoutMinutes = useSessionStore((state) => state.idleTimeoutMinutes);
  const lockStrategy = useSessionStore((state) => state.lockStrategy);
  const setIdleTimeout = useSessionStore((state) => state.setIdleTimeout);
  const setLockStrategy = useSessionStore((state) => state.setLockStrategy);

  const handleIdleTimeoutChange = (value: string) => {
    setIdleTimeout(Number(value));
  };

  const handleLockStrategyChange = (value: "lock" | "logout") => {
    setLockStrategy(value);
  };

  const idleTimeoutLabel = idleTimeoutMinutes === 0 ? "从不" : `${idleTimeoutMinutes} 分钟`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>会话安全</CardTitle>
          <CardDescription className="text-xs">
            配置空闲锁屏/自动注销策略，保护控制台无人值守时的安全
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="idle-timeout">空闲时长</Label>
          <Select value={String(idleTimeoutMinutes)} onValueChange={handleIdleTimeoutChange}>
            <SelectTrigger id="idle-timeout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 分钟</SelectItem>
              <SelectItem value="60">1 小时</SelectItem>
              <SelectItem value="0">从不</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            当前策略：{idleTimeoutLabel} 无操作后触发。
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lock-strategy">触发后操作</Label>
          <Select value={lockStrategy} onValueChange={handleLockStrategyChange}>
            <SelectTrigger id="lock-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lock">锁屏，手动解锁后继续</SelectItem>
              <SelectItem value="logout">自动注销并刷新应用</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            推荐选择"锁屏"，只有在高敏环境下才使用"自动注销"。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
