import { ScreenGridLayerGL } from '../../../src/index.js';

const PALETTES = {
  ember: [[82, 33, 26], [190, 90, 54], [238, 176, 93]],
  viridis: [[68, 1, 84], [33, 145, 140], [253, 231, 37]],
  ocean: [[18, 53, 79], [38, 117, 150], [137, 207, 190]],
  slate: [[35, 42, 49], [99, 116, 126], [207, 219, 213]],
  categorical: [[38, 109, 85], [191, 90, 54], [45, 103, 145], [128, 86, 157], [207, 157, 57]]
};

export class ScreengridRenderer {
  constructor(map) {
    this.map = map;
    this.layer = null;
  }

  render(rows, spec) {
    if (!rows.length || !spec.screengrid.coordinateFields.x || !spec.screengrid.coordinateFields.y) return;

    const options = this.createLayerOptions(rows, spec);
    if (this.layer && this.map.getLayer(this.layer.id)) {
      this.layer.setConfig(options);
      this.layer.setData(rows);
    } else {
      this.layer = new ScreenGridLayerGL({ id: 'screengrid-copilot-layer', ...options });
      this.map.addLayer(this.layer);
    }
    this.map.triggerRepaint();
  }

  createLayerOptions(rows, spec) {
    return {
      data: rows,
      aggregationMode: spec.screengrid.aggregationMode,
      aggregationFunction: spec.screengrid.aggregation.function,
      cellSizePixels: spec.screengrid.cellSizePixels,
      normalizationFunction: spec.screengrid.normalization,
      getPosition: (row) => [Number(row[spec.screengrid.coordinateFields.x]), Number(row[spec.screengrid.coordinateFields.y])],
      getWeight: (row) => getWeight(row, spec),
      colorScale: (value) => colorForValue(value, spec.glyph.palette, 0.82),
      enableGlyphs: spec.glyph.type !== 'heatmap',
      glyphSize: 0.82,
      showBackground: spec.glyph.type === 'heatmap',
      onDrawCell: spec.glyph.type === 'heatmap' ? null : (ctx, x, y, normalizedValue, cellInfo) => {
        drawSpecGlyph(ctx, x, y, normalizedValue, cellInfo, spec);
      },
      onHover: shouldHandleHover(spec) ? (payload) => {
        window.dispatchEvent(new CustomEvent('screengrid-cell-hover', { detail: payload }));
      } : null,
      onClick: shouldHandleClick(spec) ? (payload) => {
        window.dispatchEvent(new CustomEvent('screengrid-cell-click', { detail: payload }));
      } : null
    };
  }

  fit(rows, spec) {
    const xField = spec.screengrid.coordinateFields.x;
    const yField = spec.screengrid.coordinateFields.y;
    const points = rows
      .map((row) => [Number(row[xField]), Number(row[yField])])
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (!points.length) return;
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    this.map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], {
      padding: 80,
      maxZoom: 13
    });
  }
}

function shouldHandleHover(spec) {
  return spec.interaction?.hover || (spec.interaction?.tooltip?.enabled && spec.interaction.tooltip.trigger !== 'click');
}

function shouldHandleClick(spec) {
  return spec.interaction?.click || spec.interaction?.selection || spec.interaction?.tooltip?.trigger === 'click';
}

function getWeight(row, spec) {
  const aggregation = spec.screengrid.aggregation;
  if (aggregation.function === 'count') return 1;
  const value = Number(row[aggregation.field]);
  return Number.isFinite(value) ? value : 0;
}

function drawSpecGlyph(ctx, x, y, normalizedValue, cellInfo, spec) {
  const radius = Math.max(4, (cellInfo.glyphRadius || cellInfo.cellSize * 0.35) * sizeFactor(cellInfo, spec));
  const centerX = x;
  const centerY = y;
  const color = cssColor(colorForCell(cellInfo, spec, normalizedValue));
  const values = spec.glyph.type === 'bar'
    ? valuesForMeasures(cellInfo, spec)
    : valuesForSegments(cellInfo, spec);

  ctx.save();
  ctx.globalAlpha = opacityForCell(cellInfo, spec, normalizedValue);

  if (spec.glyph.type === 'circle') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (spec.glyph.type === 'ring') {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, radius * 0.22);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(2, radius * 0.26), 0, Math.PI * 2);
    ctx.fill();
  } else if (spec.glyph.type === 'bar') {
    drawBars(ctx, centerX, centerY, radius, values, spec);
  } else if (spec.glyph.type === 'pie') {
    drawPie(ctx, centerX, centerY, radius, values, spec);
  } else if (spec.glyph.type === 'custom') {
    drawCustomGlyph(ctx, centerX, centerY, radius, cellInfo, spec);
  }

  ctx.restore();
}

function sizeFactor(cellInfo, spec) {
  const field = spec.glyph.channels?.size?.field;
  if (!field || field === 'count') return 0.6 + Math.sqrt(Math.max(cellInfo.cellData?.length || 1, 1)) * 0.12;
  const values = (cellInfo.cellData || []).map((item) => Number(item.data[field])).filter(Number.isFinite);
  if (!values.length) return 0.8;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const normalized = normalizeByProfile(mean, field, spec);
  return Math.max(0.45, Math.min(1.15, 0.45 + Math.sqrt(normalized) * 0.7));
}

function opacityForCell(cellInfo, spec, normalizedValue) {
  if (spec.glyph.channels?.opacity?.field === 'count') return Math.max(0.35, Math.min(0.95, normalizedValue));
  const field = spec.glyph.channels?.opacity?.field;
  const values = (cellInfo.cellData || []).map((item) => Number(item.data[field])).filter(Number.isFinite);
  if (!values.length) return 0.88;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.max(0.25, Math.min(0.95, 0.25 + normalizeByProfile(mean, field, spec) * 0.7));
}

function colorForCell(cellInfo, spec, normalizedValue) {
  const field = spec.glyph.channels?.color?.field;
  if (!field || field === 'count') return colorForValue(normalizedValue, spec.glyph.palette, 0.9);

  const values = (cellInfo.cellData || []).map((item) => item.data[field]).filter((value) => value !== null && value !== undefined);
  if (!values.length) return colorForValue(normalizedValue, spec.glyph.palette, 0.9);
  if (typeof values[0] === 'number') {
    const mean = values.reduce((sum, value) => sum + Number(value), 0) / values.length;
    return colorForValue(normalizeByProfile(mean, field, spec), spec.glyph.palette, 0.9);
  }
  const key = String(mode(values));
  return PALETTES.categorical[hashString(key) % PALETTES.categorical.length].concat(230);
}

function valuesForSegments(cellInfo, spec) {
  const field = spec.glyph.channels?.segments?.field || spec.glyph.channels?.color?.field;
  if (!field) return [cellInfo.cellData?.length || 1];
  const counts = new Map();
  (cellInfo.cellData || []).forEach((item) => {
    const key = String(item.data[field] ?? 'unknown');
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.values()).slice(0, 6);
}

function valuesForMeasures(cellInfo, spec) {
  const measures = spec.glyph.channels?.measures || [];
  if (!measures.length) return valuesForSegments(cellInfo, spec);
  return measures.map((measure) => aggregateField(cellInfo.cellData || [], measure.field, measure.aggregate || 'mean'));
}

function drawBars(ctx, x, y, radius, values, spec) {
  const max = Math.max(...values, 1);
  if (!values.length) return;
  const width = Math.max(3, (radius * 1.8) / values.length);
  values.forEach((value, index) => {
    const height = (value / max) * radius * 1.8;
    const color = PALETTES[spec.glyph.palette]?.[index % PALETTES[spec.glyph.palette].length] || PALETTES.ember[1];
    ctx.fillStyle = cssColor(color.concat(225));
    ctx.fillRect(x - radius + index * width, y + radius - height, width * 0.72, height);
  });
}

function aggregateField(cellData, field, op) {
  const values = cellData.map((item) => Number(item.data[field])).filter(Number.isFinite);
  if (!values.length) return 0;
  if (op === 'sum') return values.reduce((sum, value) => sum + value, 0);
  if (op === 'min') return Math.min(...values);
  if (op === 'max') return Math.max(...values);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeByProfile(value, field, spec) {
  const profile = spec.datasetProfile.fields.find((item) => item.name === field);
  if (!profile || profile.min === null || profile.max === null || profile.max === profile.min) return 0.5;
  return Math.max(0, Math.min(1, (value - profile.min) / (profile.max - profile.min)));
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

function drawCustomGlyph(ctx, x, y, radius, cellInfo, spec) {
  const custom = spec.glyph.custom;
  if (!custom?.marks?.length) return;

  custom.marks.forEach((mark) => {
    if (mark.mark === 'ring') {
      drawCustomRing(ctx, x, y, radius, mark);
    } else if (custom.layout === 'cartesian-mini' && mark.mark === 'line') {
      drawCustomLine(ctx, x, y, radius, cellInfo, spec, mark);
    } else if (custom.layout === 'cartesian-mini' && mark.mark === 'point') {
      drawCustomPoints(ctx, x, y, radius, cellInfo, spec, mark);
    } else if (custom.layout === 'radial' && mark.mark === 'wedge') {
      drawCustomWedges(ctx, x, y, radius, cellInfo, spec, mark);
    }
  });
}

function drawCustomLine(ctx, x, y, radius, cellInfo, spec, mark) {
  const series = seriesForMark(cellInfo, spec, mark);
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

function drawCustomPoints(ctx, x, y, radius, cellInfo, spec, mark) {
  const series = seriesForMark(cellInfo, spec, mark);
  if (!series.length) return;
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

function drawCustomWedges(ctx, x, y, radius, cellInfo, spec, mark) {
  const series = seriesForMark(cellInfo, spec, mark);
  if (!series.length) return;
  const step = (Math.PI * 2) / series.length;
  const palette = PALETTES[spec.glyph.palette] || PALETTES.categorical;

  ctx.save();
  ctx.globalAlpha *= mark.opacity ?? 0.85;
  series.forEach((item, index) => {
    const start = -Math.PI / 2 + index * step;
    const end = start + step * 0.86;
    const wedgeRadius = Math.max(radius * 0.16, radius * item.normalized);
    const color = mark.fill
      ? mark.fill
      : cssColor(palette[index % palette.length].concat(220));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, wedgeRadius, start, end);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function drawCustomRing(ctx, x, y, radius, mark) {
  ctx.save();
  ctx.strokeStyle = mark.stroke || '#1e2421';
  ctx.lineWidth = mark.lineWidth || 1;
  ctx.globalAlpha *= mark.opacity ?? 0.35;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function seriesForMark(cellInfo, spec, mark) {
  const fields = resolveMarkFields(spec, mark);
  const values = fields.map((field) => aggregateField(cellInfo.cellData || [], field, mark.data?.aggregate || 'mean'));
  const domain = domainForFields(fields, spec, values, spec.glyph.custom?.domain || 'global');
  return fields.map((field, index) => ({
    field,
    value: values[index],
    normalized: normalizeToDomain(values[index], domain)
  }));
}

function resolveMarkFields(spec, mark) {
  if (Array.isArray(mark.data?.fields) && mark.data.fields.length) return orderFields(mark.data.fields, mark.data.order);
  const pattern = mark.data?.fieldPattern;
  if (!pattern) return [];
  const matcher = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`);
  const fields = spec.datasetProfile.fields
    .filter((field) => field.type === 'number' && matcher.test(field.name))
    .map((field) => field.name);
  return orderFields(fields, mark.data?.order);
}

function orderFields(fields, order = 'given') {
  if (order === 'temporal') {
    return [...fields].sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
  }
  if (order === 'lexical') return [...fields].sort();
  return fields;
}

function domainForFields(fields, spec, values, modeName) {
  if (modeName === 'local') return [Math.min(...values, 0), Math.max(...values, 1)];
  const profiles = fields
    .map((field) => spec.datasetProfile.fields.find((item) => item.name === field))
    .filter(Boolean);
  const mins = profiles.map((profile) => profile.min).filter((value) => value !== null);
  const maxes = profiles.map((profile) => profile.max).filter((value) => value !== null);
  return [Math.min(...mins, ...values, 0), Math.max(...maxes, ...values, 1)];
}

function normalizeToDomain(value, [min, max]) {
  if (!Number.isFinite(value) || max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function glyphBox(x, y, radius) {
  const size = radius * 1.7;
  return {
    x: x - size / 2,
    y: y - size / 2,
    width: size,
    height: size
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function mode(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash) + value.charCodeAt(i);
  return Math.abs(hash);
}
