"use client";

type QuantityStepperProps = {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
  label: string;
};

export function QuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
  compact = false,
  label,
}: QuantityStepperProps) {
  return (
    <div className={`quantity${compact ? " quantity-compact" : ""}`} aria-label={label}>
      <button type="button" onClick={onDecrease} aria-label="Remove one">
        −
      </button>
      <span>{quantity}</span>
      <button type="button" onClick={onIncrease} aria-label="Add one">
        +
      </button>
    </div>
  );
}
