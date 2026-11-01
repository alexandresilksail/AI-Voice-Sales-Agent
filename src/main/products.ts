import raw from '../data/products.json';
import type { CatalogProduct, Product } from '../shared/types';
export const catalog: readonly CatalogProduct[] = raw.map(p => Object.freeze({...p, currency: 'USD' as const, specifications: Object.freeze(Object.fromEntries(Object.entries(p.specifications) as [string,string][]))}));
for (const p of catalog) {
  if (![p.originalPriceCents,p.targetPriceCents,p.minimumPriceCents].every(Number.isSafeInteger) || p.minimumPriceCents <= 0 || p.minimumPriceCents > p.targetPriceCents || p.targetPriceCents > p.originalPriceCents) throw new Error('Invalid catalog pricing: ' + p.id);
}
export function getProduct(id: string): CatalogProduct { const product = catalog.find(p => p.id === id); if (!product) throw new Error('Choose a product from the catalog.'); return product; }
export function publicProduct(product: CatalogProduct): Product { const {targetPriceCents: _target, minimumPriceCents: _minimum, ...safe} = product; return safe; }
export const publicCatalog = () => catalog.map(publicProduct);
