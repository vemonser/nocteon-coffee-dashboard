// shared/utils/css-var.ts
export function getCssVarColor(varName: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName.replace('--color-', '--'))
    .trim();
}