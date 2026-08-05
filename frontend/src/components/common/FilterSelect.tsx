import { ChevronDown } from "lucide-react";

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
}

export function FilterSelect({ label, value, options, allLabel, onChange }: FilterSelectProps) {
  return (
    <label className="select-field">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "All" ? allLabel : option === "BUY" ? "Buys" : option === "SELL" ? "Sells" : option}
          </option>
        ))}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}
