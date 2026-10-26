/** Lower case, "&" and apostrophes dropped, anything else that is not a letter or digit as a space. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’&]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Finds the first brand whose name or alias appears as whole words in `name`. Order of `brands` decides ties. */
export function matcher<B extends { name: string; aliases: string[] }>(brands: B[]): (name: string) => B | null {
  const words = brands.map((brand) => ({ brand, words: [brand.name, ...brand.aliases].map((n) => ` ${normalise(n)} `) }));
  return (name) => {
    const padded = ` ${normalise(name)} `;
    for (const m of words) if (m.words.some((w) => padded.includes(w))) return m.brand;
    return null;
  };
}
