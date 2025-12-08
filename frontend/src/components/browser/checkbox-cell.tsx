import { Checkbox } from "@/components/ui/checkbox";

interface CheckboxCellProps {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean | "indeterminate") => void;
  onClick?: (e: React.MouseEvent) => void;
  ariaLabel?: string;
}

export function CheckboxCell({ checked, onCheckedChange, onClick, ariaLabel }: CheckboxCellProps) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className="translate-y-[2px]"
      onClick={onClick}
    />
  );
}
