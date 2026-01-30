import { Slider } from "@heroui/react";
import { Check, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export interface RangeSliderProps {
  className?: string;
  defaultMax: number;
  defaultMin: number;
  formatValue?: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onRangeChange: (min: number, max: number) => void;
  step?: number;
}

export function RangeSlider({
  className,
  defaultMax,
  defaultMin,
  formatValue = (v) => v.toString(),
  label,
  max,
  min,
  onRangeChange,
  step = 1,
}: RangeSliderProps): React.ReactElement {
  // Temporary state for slider (before confirmation)
  const [tempRange, setTempRange] = useState<[number, number]>([
    defaultMin,
    defaultMax,
  ]);
  // Confirmed state
  const [confirmedRange, setConfirmedRange] = useState<[number, number]>([
    defaultMin,
    defaultMax,
  ]);
  // Track if there are pending changes
  const [hasChanges, setHasChanges] = useState(false);

  // Update temp range when defaults change (e.g., when data changes)
  useEffect(() => {
    setTempRange([defaultMin, defaultMax]);
    setConfirmedRange([defaultMin, defaultMax]);
  }, [defaultMin, defaultMax]);

  const handleSliderChange = useCallback((value: number | number[]) => {
    if (Array.isArray(value) && value.length === 2) {
      setTempRange([value[0], value[1]]);
      setHasChanges(true);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    setConfirmedRange(tempRange);
    onRangeChange(tempRange[0], tempRange[1]);
    setHasChanges(false);
  }, [tempRange, onRangeChange]);

  const handleReset = useCallback(() => {
    setTempRange([defaultMin, defaultMax]);
    setConfirmedRange([defaultMin, defaultMax]);
    onRangeChange(defaultMin, defaultMax);
    setHasChanges(false);
  }, [defaultMin, defaultMax, onRangeChange]);

  const isDefault =
    confirmedRange[0] === defaultMin && confirmedRange[1] === defaultMax;

  return (
    <div
      className={[
        "flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10",
        className ?? "",
      ].join(" ")}
    >
      <span className="text-xs text-gray-400 whitespace-nowrap min-w-[60px]">
        {label}:
      </span>
      <div className="flex-1">
        <Slider
          classNames={{
            base: "gap-3",
            filler: "bg-gradient-to-r from-purple-500 to-indigo-500",
            thumb: "bg-white shadow-md",
            track: "bg-white/20",
          }}
          defaultValue={[defaultMin, defaultMax]}
          formatOptions={{ maximumFractionDigits: 0 }}
          maxValue={max}
          minValue={min}
          onChange={handleSliderChange}
          showTooltip
          size="sm"
          step={step}
          value={tempRange}
        />
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-300 min-w-[100px]">
        <span className="font-mono">{formatValue(tempRange[0])}</span>
        <span className="text-gray-500">–</span>
        <span className="font-mono">{formatValue(tempRange[1])}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          className={[
            "p-1.5 rounded-lg border transition-colors",
            hasChanges
              ? "bg-black/40 backdrop-blur-md border-green-500/50 text-green-400 hover:border-green-400 hover:text-green-300"
              : "bg-black/40 backdrop-blur-md border-white/10 text-gray-500 cursor-not-allowed",
          ].join(" ")}
          disabled={!hasChanges}
          onClick={handleConfirm}
          title="Apply filter"
          type="button"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          className={[
            "p-1.5 rounded-lg border transition-colors",
            isDefault && !hasChanges
              ? "bg-black/40 backdrop-blur-md border-white/10 text-gray-500 cursor-not-allowed"
              : "bg-black/40 backdrop-blur-md border-white/10 text-gray-400 hover:border-white/30 hover:text-white",
          ].join(" ")}
          disabled={isDefault && !hasChanges}
          onClick={handleReset}
          title="Reset to default"
          type="button"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
