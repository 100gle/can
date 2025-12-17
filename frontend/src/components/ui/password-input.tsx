import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export interface PasswordInputProps extends React.ComponentProps<"input"> {
  showToggle?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showToggle = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const { t } = useTranslation("common");

    return (
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={ref}
          {...props}
        />
        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            aria-label={
              showPassword ? t("component.passwordInput.hide") : t("component.passwordInput.show")
            }
          >
            {showPassword ? (
              <Eye className="h-4 w-4 text-muted-foreground transition-colors hover:text-foreground" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground transition-colors hover:text-foreground" />
            )}
          </Button>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
