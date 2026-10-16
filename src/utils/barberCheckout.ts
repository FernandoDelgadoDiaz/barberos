/**
 * Availability of product-step actions. A service is enough to proceed
 * without a product; a product-only sale is also legitimate.
 */
export function getProductsStepAvailability(services: number, products: number) {
  const hasService = services > 0
  const hasProduct = products > 0
  return {
    canSkipProducts: hasService && !hasProduct,
    canContinueWithProducts: hasProduct,
    canConfirm: hasService || hasProduct,
  }
}
