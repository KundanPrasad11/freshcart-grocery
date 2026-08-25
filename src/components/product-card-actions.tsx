"use client";

import Link from "next/link";
import { QuantityStepper } from "@/components/quantity-stepper";

type ProductCardActionsProps = {
  addedQuantity: number;
  isSignedIn: boolean;
  onAdd: () => void;
  onRemove: () => void;
};

export function ProductCardActions({
  addedQuantity,
  isSignedIn,
  onAdd,
  onRemove,
}: ProductCardActionsProps) {
  if (!isSignedIn) {
    return (
      <Link className="add" href="/auth">
        Sign in
      </Link>
    );
  }

  if (!addedQuantity) {
    return (
      <button className="add" type="button" onClick={onAdd}>
        Add +
      </button>
    );
  }

  return (
    <QuantityStepper
      compact
      quantity={addedQuantity}
      label="Product quantity"
      onDecrease={onRemove}
      onIncrease={onAdd}
    />
  );
}
