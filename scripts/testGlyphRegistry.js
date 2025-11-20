import { GlyphRegistry } from '../src/glyphs/GlyphRegistry.js';
import '../src/glyphs/PublicTransportGlyph.js';

console.log('Registered glyphs:', GlyphRegistry.list());

const glyph = GlyphRegistry.get('public-transport');
console.log('public-transport found:', !!glyph);
console.log('glyph keys:', Object.keys(glyph || {}));

if (glyph && typeof glyph.draw === 'function') {
  console.log('draw is function');
} else {
  console.log('draw missing or not function');
}
