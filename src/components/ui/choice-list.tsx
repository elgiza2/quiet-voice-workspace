import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function ChoiceList({ label, value, options, onChange, disabled }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between" role="combobox" aria-label={label} aria-expanded={open} disabled={disabled}>
      <span className="min-w-0 truncate">{options.find(o => o.value === value)?.label || options[0]?.label}</span><ChevronDown />
    </Button></PopoverTrigger>
    <PopoverContent className="z-[10050] max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-lg p-1" align="start">
      <div role="listbox" aria-label={label}>{options.map(o => <Button key={o.value} variant="ghost" role="option" aria-selected={o.value === value} className="w-full justify-between rounded-sm text-start" onClick={() => { onChange(o.value); setOpen(false); }}>{o.label}{value === o.value && <Check />}</Button>)}</div>
    </PopoverContent>
  </Popover>;
}