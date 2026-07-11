import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { ScreenGridLayerGL } from '../../../../src/index.js';
import { useScreengridStore } from '../store/useScreengridStore.js';
import { drawSpecGlyph } from '../lib/glyphRenderer.js';

export function MapCanvas() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [mapStatus, setMapStatus] = useState('initialising');
  const [useFallback, setUseFallback] = useState(false);
  const rows = useScreengridStore((state) => state.rows);
  const spec = useScreengridStore((state) => state.spec);
  const setHoveredCell = useScreengridStore((state) => state.setHoveredCell);
  const setSelectedCell = useScreengridStore((state) => state.setSelectedCell);
  const fallbackPoints = useMemo(() => projectFallbackPoints(rows, spec), [rows, spec]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    let map = null;
    let canvasCheck = null;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: 'OpenStreetMap contributors'
            }
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.62, 'raster-saturation': -0.35 } }]
        },
        center: [-0.11, 51.51],
        zoom: 11
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;
      map.on('error', (event) => {
        setMapStatus(event.error?.message || 'MapLibre reported an error.');
        setUseFallback(true);
      });
      map.once('load', () => {
        map.resize();
        setMapStatus('ready');
      });
      canvasCheck = window.setTimeout(() => {
        if (!containerRef.current?.querySelector('.maplibregl-canvas')) {
          setMapStatus('MapLibre canvas did not attach; showing non-WebGL fallback.');
          setUseFallback(true);
        }
      }, 1200);
    } catch (error) {
      setMapStatus(error.message);
      setUseFallback(true);
    }
    return () => {
      if (canvasCheck) window.clearTimeout(canvasCheck);
      layerRef.current = null;
      mapRef.current = null;
      if (map) map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    function renderLayer() {
      if (!rows.length) return;
      map.resize();
      const options = createLayerOptions(rows, spec, setHoveredCell, setSelectedCell);
      if (layerRef.current && map.getLayer(layerRef.current.id)) {
        layerRef.current.setConfig(options);
        layerRef.current.setData(rows);
      } else {
        layerRef.current = new ScreenGridLayerGL({ id: 'screengrid-research-layer', ...options });
        map.addLayer(layerRef.current);
      }
      fitRows(map, rows, spec);
      map.triggerRepaint();
    }

    if (map.loaded()) renderLayer();
    else map.once('load', renderLayer);
    return undefined;
  }, [rows, spec, setHoveredCell, setSelectedCell]);

  return (
    <div className="map-stage">
      <div className="map-header">
        <div>
          <h2>{spec.intent.question || 'Semantic gridded glyphmap'}</h2>
          <p>{spec.interaction.explanation}</p>
        </div>
        <span>{spec.glyph.type}</span>
      </div>
      <div ref={containerRef} className="map-canvas">
        {useFallback ? (
          <FallbackMap
            points={fallbackPoints}
            status={mapStatus}
            glyphType={spec.glyph.type}
            onPointSelect={setSelectedCell}
          />
        ) : null}
      </div>
    </div>
  );
}

function FallbackMap({ points, status, glyphType, onPointSelect }) {
  return (
    <div className="fallback-map" role="img" aria-label="Projected fallback map">
      <div className="fallback-grid" />
      <div className="fallback-watermark">non-WebGL fallback · {glyphType}</div>
      <div className="fallback-status">{status}</div>
      {points.map((point) => (
        <button
          type="button"
          key={point.id}
          className="fallback-point"
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: `${point.size}px`,
            height: `${point.size}px`,
            background: point.color
          }}
          title={`${point.label}: ${point.count} record(s)`}
          onClick={() => onPointSelect(point.cell)}
        />
      ))}
    </div>
  );
}

function createLayerOptions(rows, spec, setHoveredCell, setSelectedCell) {
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
    aggregationModeConfig: { showBackground: spec.glyph.type === 'heatmap' },
    onDrawCell: spec.glyph.type === 'heatmap' ? null : (ctx, x, y, normalizedValue, cell) => {
      drawSpecGlyph(ctx, x, y, normalizedValue, cell, spec);
    },
    onHover: (payload) => setHoveredCell(payload.cell),
    onClick: (payload) => setSelectedCell(payload.cell)
  };
}

function fitRows(map, rows, spec) {
  const xField = spec.screengrid.coordinateFields.x;
  const yField = spec.screengrid.coordinateFields.y;
  const points = rows
    .map((row) => [Number(row[xField]), Number(row[yField])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!points.length) return;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], {
    padding: 88,
    maxZoom: 13,
    duration: 420
  });
}

function getWeight(row, spec) {
  const aggregation = spec.screengrid.aggregation;
  if (aggregation.function === 'count') return 1;
  const value = Number(row[aggregation.field]);
  return Number.isFinite(value) ? value : 0;
}

function colorForValue(value, paletteName, alpha = 1) {
  const palettes = {
    ember: [[82, 33, 26], [190, 90, 54], [238, 176, 93]],
    viridis: [[68, 1, 84], [33, 145, 140], [253, 231, 37]],
    ocean: [[18, 53, 79], [38, 117, 150], [137, 207, 190]],
    slate: [[35, 42, 49], [99, 116, 126], [207, 219, 213]],
    categorical: [[38, 109, 85], [191, 90, 54], [45, 103, 145], [128, 86, 157], [207, 157, 57]]
  };
  const palette = palettes[paletteName] || palettes.ember;
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

function projectFallbackPoints(rows, spec) {
  const xField = spec.screengrid.coordinateFields.x;
  const yField = spec.screengrid.coordinateFields.y;
  const valid = rows
    .map((row, index) => ({
      row,
      index,
      x: Number(row[xField]),
      y: Number(row[yField])
    }))
    .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));
  if (!valid.length) return [];

  const minX = Math.min(...valid.map((item) => item.x));
  const maxX = Math.max(...valid.map((item) => item.x));
  const minY = Math.min(...valid.map((item) => item.y));
  const maxY = Math.max(...valid.map((item) => item.y));
  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;

  return valid.map((item) => {
    const value = getWeight(item.row, spec);
    const normalized = Math.max(0.16, Math.min(1, value / Math.max(...valid.map((entry) => getWeight(entry.row, spec)), 1)));
    const fieldSummaries = Object.fromEntries(Object.entries(item.row).map(([field, raw]) => {
      const number = Number(raw);
      if (Number.isFinite(number)) {
        return [field, { type: 'number', mean: number, min: number, max: number, sum: number, missing: 0 }];
      }
      return [field, { type: 'category', mode: raw, distinct: raw == null ? 0 : 1, categories: raw == null ? [] : [{ value: String(raw), count: 1 }] }];
    }));
    return {
      id: item.row.id ?? item.index,
      label: item.row.name || item.row.place || item.row.sensor || `Record ${item.index + 1}`,
      x: 8 + ((item.x - minX) / xSpan) * 84,
      y: 92 - ((item.y - minY) / ySpan) * 84,
      size: 13 + normalized * 22,
      color: cssColor(colorForValue(normalized, spec.glyph.palette, 0.82)),
      count: 1,
      cell: {
        id: `fallback:${item.index}`,
        records: { count: 1, denominator: 1, rawRefs: [{ data: item.row, weight: value }] },
        measures: { count: 1, weight: value, fields: fieldSummaries },
        reliability: { sampleSize: 1, sampleSizeClass: 'low', warnings: ['fallback-single-record'] },
        comparability: { normalization: spec.screengrid.normalization, viewportDependent: false, validAcrossZoom: true },
        spatial: { type: 'fallback-point', centroid: { x: item.x, y: item.y } },
        cellData: [{ data: item.row, weight: value }]
      }
    };
  });
}

function cssColor(rgba) {
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${(rgba[3] ?? 255) / 255})`;
}
