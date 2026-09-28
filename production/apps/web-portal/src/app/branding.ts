export const PRODUCT_BRAND = {
  productName: 'INNO.One',
  productNamePrefix: 'INNO.',
  productNameEmphasis: 'One',
  compactMark: 'I1',
  browserTitle: 'INNO.One',
} as const;

export const BRAND_TOKEN_DEFINITIONS = [
  { id: 'primary', label: 'Primary', cssVariable: '--ds-primary' },
  { id: 'primary-hover', label: 'Primary hover', cssVariable: '--ds-primary-hover' },
  { id: 'primary-soft', label: 'Primary soft', cssVariable: '--ds-primary-soft' },
  { id: 'background', label: 'Workspace background', cssVariable: '--ds-bg' },
  { id: 'surface', label: 'Surface', cssVariable: '--ds-surface' },
  { id: 'text', label: 'Primary text', cssVariable: '--ds-text' },
] as const;

export const BRAND_FONT_TOKEN = {
  id: 'font',
  label: 'UI font stack',
  cssVariable: '--ds-font',
} as const;

export function applyProductDocumentBrand() {
  document.title = PRODUCT_BRAND.browserTitle;
}

export function readBrandCssVariable(cssVariable: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVariable)
    .trim();
}
