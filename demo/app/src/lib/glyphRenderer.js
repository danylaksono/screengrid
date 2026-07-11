const PALETTES = {
  ember: [[82, 33, 26], [190, 90, 54], [238, 176, 93]],
  viridis: [[68, 1, 84], [33, 145, 140], [253, 231, 37]],
  ocean: [[18, 53, 79], [38, 117, 150], [137, 207, 190]],
  slate: [[35, 42, 49], [99, 116, 126], [207, 219, 213]],
  categorical: [[38, 109, 85], [191, 90, 54], [45, 103, 145], [128, 86, 157], [207, 157, 57]]
};

export function drawSpecGlyph(ctx, x, y, normalizedValue, cell, spec) {
  const radius = Math.max(4, (cell.glyphRadius || cell.cellSize * 0.35) * sizeFactor(cell, spec));
  const color = cssColor(colorForCell(cell, spec, normalizedValue));
  const values = spec.glyph.type === 'bar' ? valuesForMeasures(cell, spec) : valuesForSegments(cell, spec);

  ctx.save();
  ctx.globalAlpha = opacityForCell(cell, spec, normalizedValue);

  if (spec.glyph.type === 'circle') drawCircle(ctx, x, y, radius, color);
  else if (spec.glyph.type === 'ring') drawRing(ctx, x, y, radius, color);
  else if (spec.glyph.type === 'bar') drawBars(ctx, x, y, radius, values, spec);
  else if (spec.glyph.type === 'pie') drawPie(ctx, x, y, radius, values, spec);
  else if (spec.glyph.type === 'custom') drawCustomGlyph(ctx, x, y, radius, cell, spec);

  if (cell.reliability?.sampleSizeClass === 'low') {
    ctx.strokeStyle = 'rgba(16, 22, 19, 0.68)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCircle(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawRing(ctx, x, y, radius, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, radius * 0.22);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(2, radius * 0.26), 0, Math.PI * 2);
  ctx.fill();
}

function drawBars(ctx, x, y, radius, values, spec) {
  const max = Math.max(...values, 1);
  const width = Math.max(3, (radius * 1.8) / Math.max(values.length, 1));
  values.forEach((value, index) => {
    const height = (value / max) * radius * 1.8;
    const color = PALETTES[spec.glyph.palette]?.[index % PALETTES[spec.glyph.palette].length] || PALETTES.ember[1];
    ctx.fillStyle = cssColor(color.concat(225));
    ctx.fillRect(x - radius + index * width, y + radius - height, width * 0.72, height);
  });
}

function drawPie(ctx, x, y, radius, values, spec) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  let start = -Math.PI / 2;
  values.forEach((value, index) => {
    const end = start + (value / total) * Math.PI * 2;
    const color = PALETTES[spec.glyph.palette]?.[index % PALETTES[spec.glyph.palette].length] || PALETTES.categorical[index % PALETTES.categorical.length];
    ctx.fillStyle = cssColor(color.concat(225));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, start, end);
    ctx.closePath();
    ctx.fill();
    start = end;
  });
}

function drawCustomGlyph(ctx, x, y, radius, cell, spec) {
  const custom = spec.glyph.custom;
  if (!custom?.marks?.length) return;
  custom.marks.forEach((mark) => {
    if (mark.mark === 'ring') drawCustomRing(ctx, x, y, radius, mark);
    else if (custom.layout === 'cartesian-mini' && mark.mark === 'line') drawCustomLine(ctx, x, y, radius, cell, spec, mark);
    else if (custom.layout === 'cartesian-mini' && mark.mark === 'point') drawCustomPoints(ctx, x, y, radius, cell, spec, mark);
    else if (custom.layout === 'radial' && mark.mark === 'wedge') drawCustomWedges(ctx, x, y, radius, cell, spec, mark);
  });
}

function drawCustomLine(ctx, x, y, radius, cell, spec, mark) {
  const series = seriesForMark(cell, spec, mark);
  if (series.length < 2) return;
  const box = glyphBox(x, y, radius);
  ctx.save();
  ctx.strokeStyle = mark.stroke || '#266d55';
  ctx.lineWidth = mark.lineWidth || 2;
  ctx.globalAlpha *= mark.opacity ?? 1;
  ctx.beginPath();
  series.forEach((item, index) => {
    const px = box.x + (index / (series.length - 1)) * box.width;
    const py = box.y + box.height - item.normalized * box.height;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}

function drawCustomPoints(ctx, x, y, radius, cell, spec, mark) {
  const series = seriesForMark(cell, spec, mark);
  const box = glyphBox(x, y, radius);
  ctx.save();
  ctx.fillStyle = mark.fill || '#bf5a36';
  ctx.globalAlpha *= mark.opacity ?? 1;
  series.forEach((item, index) => {
    const px = box.x + (series.length === 1 ? 0.5 : index / (series.length - 1)) * box.width;
    const py = box.y + box.height - item.normalized * box.height;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.5, radius * 0.08), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawCustomWedges(ctx, x, y, radius, cell, spec, mark) {
  const series = seriesForMark(cell, spec, mark);
  const step = (Math.PI * 2) / Math.max(series.length, 1);
  const palette = PALETTES[spec.glyph.palette] || PALETTES.categorical;
  ctx.save();
  ctx.globalAlpha *= mark.opacity ?? 0.85;
  series.forEach((item, index) => {
    const start = -Math.PI / 2 + index * step;
    const end = start + step * 0.86;
    const wedgeRadius = Math.max(radius * 0.16, radius * item.normalized);
    ctx.fillStyle = mark.fill || cssColor(palette[index % palette.length].concat(220));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, wedgeRadius, start, end);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function drawCustomRing(ctx, x, y, radius, mark) {
  ctx.strokeStyle = mark.stroke || '#1e2421';
  ctx.lineWidth = mark.lineWidth || 1;
  ctx.globalAlpha *= mark.opacity ?? 0.35;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function sizeFactor(cell, spec) {
  const field = spec.glyph.channels?.size?.field;
  if (!field || field === 'count') return 0.6 + Math.sqrt(Math.max(cell.records?.count || 1, 1)) * 0.12;
  const mean = cell.measures?.fields?.[field]?.mean;
  if (!Number.isFinite(mean)) return 0.8;
  return Math.max(0.45, Math.min(1.15, 0.45 + Math.sqrt(normalizeByProfile(mean, field, spec)) * 0.7));
}

function opacityForCell(cell, spec, normalizedValue) {
  const field = spec.glyph.channels?.opacity?.field;
  if (!field || field === 'count') return Math.max(0.35, Math.min(0.95, normalizedValue));
  const mean = cell.measures?.fields?.[field]?.mean;
  if (!Number.isFinite(mean)) return 0.88;
  return Math.max(0.25, Math.min(0.95, 0.25 + normalizeByProfile(mean, field, spec) * 0.7));
}

function colorForCell(cell, spec, normalizedValue) {
  const field = spec.glyph.channels?.color?.field;
  if (!field || field === 'count') return colorForValue(normalizedValue, spec.glyph.palette, 0.9);
  const summary = cell.measures?.fields?.[field];
  if (!summary) return colorForValue(normalizedValue, spec.glyph.palette, 0.9);
  if (summary.type === 'number') return colorForValue(normalizeByProfile(summary.mean, field, spec), spec.glyph.palette, 0.9);
  return PALETTES.categorical[hashString(String(summary.mode)) % PALETTES.categorical.length].concat(230);
}

function valuesForSegments(cell, spec) {
  const field = spec.glyph.channels?.segments?.field || spec.glyph.channels?.color?.field;
  const summary = cell.measures?.fields?.[field];
  if (!summary?.categories) return [cell.records?.count || 1];
  return summary.categories.slice(0, 6).map((item) => item.count);
}

function valuesForMeasures(cell, spec) {
  const measures = spec.glyph.channels?.measures || [];
  if (!measures.length) return valuesForSegments(cell, spec);
  return measures.map((measure) => cell.measures?.fields?.[measure.field]?.[measure.aggregate || 'mean'] ?? 0);
}

function seriesForMark(cell, spec, mark) {
  const fields = resolveMarkFields(spec, mark);
  const values = fields.map((field) => cell.measures?.fields?.[field]?.[mark.data?.aggregate || 'mean'] ?? 0);
  const domain = domainForFields(fields, spec, values, spec.glyph.custom?.domain || 'global');
  return fields.map((field, index) => ({ field, value: values[index], normalized: normalizeToDomain(values[index], domain) }));
}

function resolveMarkFields(spec, mark) {
  if (Array.isArray(mark.data?.fields) && mark.data.fields.length) return orderFields(mark.data.fields, mark.data.order);
  return [];
}

function orderFields(fields, order = 'given') {
  if (order === 'temporal') return [...fields].sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
  if (order === 'lexical') return [...fields].sort();
  return fields;
}

function domainForFields(fields, spec, values, modeName) {
  if (modeName === 'local') return [Math.min(...values, 0), Math.max(...values, 1)];
  const profiles = fields.map((field) => spec.datasetProfile.fields.find((item) => item.name === field)).filter(Boolean);
  const mins = profiles.map((profile) => profile.min).filter((value) => value !== null);
  const maxes = profiles.map((profile) => profile.max).filter((value) => value !== null);
  return [Math.min(...mins, ...values, 0), Math.max(...maxes, ...values, 1)];
}

function normalizeByProfile(value, field, spec) {
  const profile = spec.datasetProfile.fields.find((item) => item.name === field);
  if (!profile || profile.min === null || profile.max === null || profile.max === profile.min) return 0.5;
  return normalizeToDomain(value, [profile.min, profile.max]);
}

function normalizeToDomain(value, [min, max]) {
  if (!Number.isFinite(value) || max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function glyphBox(x, y, radius) {
  const size = radius * 1.7;
  return { x: x - size / 2, y: y - size / 2, width: size, height: size };
}

function colorForValue(value, paletteName, alpha = 1) {
  const palette = PALETTES[paletteName] || PALETTES.ember;
  if (paletteName === 'categorical') return palette[Math.floor(value * palette.length) % palette.length].concat(Math.round(alpha * 255));
  const clamped = Math.max(0, Math.min(1, value));
  const a = palette[0];
  const b = palette[Math.min(palette.length - 1, Math.floor(clamped * (palette.length - 1)) + 1)];
  const t = clamped * (palette.length - 1) % 1;
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(alpha * 255)
  ];
}

function cssColor(rgba) {
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${(rgba[3] ?? 255) / 255})`;
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash) + value.charCodeAt(i);
  return Math.abs(hash);
}
