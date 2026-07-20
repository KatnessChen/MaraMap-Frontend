"use client";

import { useState, useEffect, useRef } from "react";
import { ComboOption, getLabel, getValue } from "@/utils/locationData";

// Free-text-or-pick combobox used by the admin post forms for
// continent / country / city selection. Typing filters the list but the
// raw text is still accepted, so locations not in LOCATION_DATA can be entered.
export default function Combobox({ options, value, onChange, placeholder, hasError }: {
  options: ComboOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim() === ""
    ? options
    : options.filter(o => getLabel(o).includes(value) || getValue(o).includes(value));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full bg-white border-2 p-3 font-sans text-base focus:outline-none focus:border-brand shadow-sm ${hasError ? "border-brand" : "border-line"}`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-line shadow-xl max-h-52 overflow-y-auto mt-0.5">
          {filtered.map((opt, i) => (
            <li
              key={i}
              onMouseDown={() => { onChange(getValue(opt)); setOpen(false); }}
              className={`px-4 py-2.5 font-sans text-sm cursor-pointer hover:bg-ink/5 ${getValue(opt) === value ? "bg-brand/5 text-brand font-bold" : "text-ink"}`}
            >
              {getLabel(opt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
