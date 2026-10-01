/** PROV-08 matching for in-memory lists (UX-04 Recent tab): every whitespace token is in the name or the brand. */
export function matchesFoodQuery(food: { name: string; brand: string | null }, query: string): boolean {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const name = food.name.toLocaleLowerCase();
  const brand = (food.brand ?? '').toLocaleLowerCase();
  return tokens.every((token) => name.includes(token) || brand.includes(token));
}
