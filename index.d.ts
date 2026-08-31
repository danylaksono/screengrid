import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';

export type Position = [longitude: number, latitude: number];
export type RgbaColor = [red: number, green: number, blue: number, alpha: number];
export type ColorScale = (normalizedValue: number) => RgbaColor;

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  w: number;
}

export interface CellDatum<T = unknown> {
  data: T;
  weight: number;
  projectedX?: number;
  projectedY?: number;
  [key: string]: unknown;
}

export interface GridStats {
  totalCells: number;
  cellsWithData: number;
  maxValue: number;
  minValue: number;
  avgValue: number;
  totalValue: number;
}

export interface NormalizationContext {
  max?: number;
  min?: number;
  mean?: number;
  std?: number;
  totalValue?: number;
  cellsWithData?: number;
  [key: string]: unknown;
}

export interface SemanticCell<T = unknown, TCustom = unknown> {
  id?: string;
  col?: number;
  row?: number;
  value?: number;
  spatial?: Record<string, unknown>;
  records?: {
    count?: number;
    denominator?: number;
    rawRefs?: CellDatum<T>[];
    [key: string]: unknown;
  };
  measures?: Record<string, unknown>;
  reliability?: Record<string, unknown>;
  comparability?: Record<string, unknown>;
  custom?: TCustom;
  cellData?: CellDatum<T>[];
  x?: number;
  y?: number;
  cellSize?: number;
  glyphRadius?: number;
  normalizedValue?: number;
  customData?: TCustom;
  zoomLevel?: number;
  isHovered?: boolean;
  grid?: unknown[];
  index?: number | string;
  anchor?: unknown;
  featureId?: string | number;
  props?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AggregationResult<T = unknown, TValue = number, TCustom = unknown> {
  grid: TValue[];
  cellData: CellDatum<T>[][];
  customData?: TCustom[];
  cells?: SemanticCell<T, TCustom>[];
  populatedCells?: SemanticCell<T, TCustom>[];
  cellSemantics?: SemanticCell<T, TCustom>[];
  cols?: number;
  rows?: number;
  width: number;
  height: number;
  cellSizePixels?: number;
  type?: string;
  [key: string]: unknown;
}

export type AggregationFunction<T = unknown, TValue = number> = (
  cellData: CellDatum<T>[]
) => TValue;

export type NormalizationFunction<TValue = number> = (
  grid: TValue[],
  value: number,
  index: number | string,
  context: NormalizationContext
) => number;

export type AggregationFunctionName = 'sum' | 'mean' | 'count' | 'max' | 'min' | string;
export type NormalizationFunctionName =
  | 'max-local'
  | 'max-global'
  | 'z-score'
  | 'percentile'
  | string;

export type AggregationModeName = 'screen-grid' | 'screen-hex' | string;
export type RenderMode = 'screen-grid' | 'feature-anchors';
export type PlacementStrategy =
  | 'centroid'
  | 'polylabel'
  | 'line-sample'
  | 'grid-geo'
  | 'grid-screen'
  | 'point'
  | string;

export interface PlacementConfig {
  strategy: PlacementStrategy;
  spacing?: { meters: number } | { pixels: number };
  partition?: 'union' | 'per-part';
  maxPerFeature?: number;
  minArea?: number;
  minLength?: number;
  jitterPixels?: number;
  zoomAdaptive?: boolean;
  [key: string]: unknown;
}

export interface GeoJSONFeatureLike {
  type: 'Feature';
  geometry?: unknown;
  properties?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface GeoJSONFeatureCollectionLike {
  type: 'FeatureCollection';
  features: GeoJSONFeatureLike[];
  [key: string]: unknown;
}

export type ScreenGridSource =
  | GeoJSONFeatureLike
  | GeoJSONFeatureLike[]
  | GeoJSONFeatureCollectionLike
  | null;

export interface AggregationModeConfig {
  showBackground?: boolean;
  hexSize?: number;
  [key: string]: unknown;
}

export interface GlyphPlugin<T = unknown, TCustom = unknown> {
  init?: (context: { layer: ScreenGridLayerGL<T, number, TCustom>; config: unknown }) => void;
  destroy?: (context: { layer: ScreenGridLayerGL<T, number, TCustom>; config: unknown }) => void;
  draw: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    normalizedValue: number,
    cellInfo: SemanticCell<T, TCustom>,
    config: unknown
  ) => void;
}

export interface ScreenGridLayerOptions<T = unknown, TValue = number, TCustom = unknown> {
  id?: string;
  data?: T[];
  getPosition?: (datum: T) => Position;
  getWeight?: (datum: T) => number;
  cellSizePixels?: number;
  colorScale?: ColorScale;
  onAggregate?: ((gridData: AggregationResult<T, TValue, TCustom>) => void) | null;
  onAfterAggregate?:
    | ((
        cellData: CellDatum<T>[],
        aggregatedValue: TValue,
        index: number | string,
        grid: TValue[] | globalThis.Map<string, TValue>
      ) => TCustom)
    | null;
  onHover?:
    | ((payload: { cell: SemanticCell<T, TCustom> | null; event: MapMouseEvent }) => void)
    | null;
  onClick?:
    | ((payload: { cell: SemanticCell<T, TCustom> | null; event: MapMouseEvent }) => void)
    | null;
  onDrawCell?:
    | ((
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        normalizedValue: number,
        cellInfo: SemanticCell<T, TCustom>
      ) => void)
    | null;
  enableGlyphs?: boolean;
  glyphSize?: number;
  glyph?: string | null;
  glyphConfig?: unknown;
  adaptiveCellSize?: boolean;
  minCellSize?: number;
  maxCellSize?: number;
  zoomBasedSize?: boolean;
  enabled?: boolean;
  aggregationMode?: AggregationModeName;
  aggregationModeConfig?: AggregationModeConfig;
  aggregationFunction?: AggregationFunctionName | AggregationFunction<T, TValue>;
  normalizationFunction?: NormalizationFunctionName | NormalizationFunction<TValue>;
  normalizationContext?: NormalizationContext;
  source?: ScreenGridSource;
  placement?: PlacementConfig | null;
  renderMode?: RenderMode;
  anchorSizePixels?: number | null;
  displaySize?: { width: number; height: number };
  debugLogs?: boolean;
  [key: string]: unknown;
}

export interface TimeSeriesGlyphOptions {
  lineColor?: string;
  pointColor?: string;
  lineWidth?: number;
  pointRadius?: number;
  showPoints?: boolean;
  showArea?: boolean;
  areaColor?: string;
  padding?: number;
}

export class ScreenGridLayerGL<T = unknown, TValue = number, TCustom = unknown> {
  constructor(options?: ScreenGridLayerOptions<T, TValue, TCustom>);
  readonly id: string;
  readonly type: 'custom';
  readonly renderingMode: '2d';
  config: Required<ScreenGridLayerOptions<T, TValue, TCustom>> & Record<string, unknown>;
  map: MapLibreMap | null;
  gl: WebGLRenderingContext | null;
  gridData: AggregationResult<T, TValue, TCustom> | null;

  static density<T = unknown, TValue = number, TCustom = unknown>(
    options?: ScreenGridLayerOptions<T, TValue, TCustom>
  ): ScreenGridLayerGL<T, TValue, TCustom>;
  static hexDensity<T = unknown, TValue = number, TCustom = unknown>(
    options?: ScreenGridLayerOptions<T, TValue, TCustom>
  ): ScreenGridLayerGL<T, TValue, TCustom>;
  static glyphMap<T = unknown, TValue = number, TCustom = unknown>(
    options?: ScreenGridLayerOptions<T, TValue, TCustom>
  ): ScreenGridLayerGL<T, TValue, TCustom>;
  static featureGlyphs<T = unknown, TValue = number, TCustom = unknown>(
    options?: ScreenGridLayerOptions<T, TValue, TCustom>
  ): ScreenGridLayerGL<T, TValue, TCustom>;

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext): void;
  prerender(): void;
  render(): void;
  onRemove(): void;
  setData(data: T[]): void;
  setConfig(updates: Partial<ScreenGridLayerOptions<T, TValue, TCustom>>): void;
  getCellAt(point: ScreenPoint): SemanticCell<T, TCustom> | null;
  getCellsInBounds(bounds: ScreenBounds): SemanticCell<T, TCustom>[];
  getGridStats(): GridStats;

  static drawCircleGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color?: string,
    alpha?: number
  ): void;
  static drawBarGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    values: number[],
    maxValue: number,
    cellSize: number,
    colors?: string[]
  ): void;
  static drawPieGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    values: number[],
    radius: number,
    colors?: string[]
  ): void;
  static drawScatterGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    points: Array<{ weight: number; [key: string]: unknown }>,
    cellSize: number,
    color?: string
  ): void;
  static drawDonutGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    values: number[],
    outerRadius: number,
    innerRadius: number,
    colors?: string[]
  ): void;
  static drawHeatmapGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    normalizedValue: number,
    colorScale: (value: number) => string
  ): void;
  static drawRadialBarGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    values: number[],
    maxValue: number,
    maxRadius: number,
    color?: string
  ): void;
  static drawTimeSeriesGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    timeSeriesData: Array<{ year: number; value: number }>,
    cellSize: number,
    options?: TimeSeriesGlyphOptions
  ): void;
}

export class Aggregator {
  static aggregate<T = unknown, TValue = number, TCustom = unknown>(
    projectedPoints: ProjectedPoint[],
    originalData: T[],
    width: number,
    height: number,
    cellSizePixels: number,
    aggregationFunction?: AggregationFunctionName | AggregationFunction<T, TValue> | null,
    onAfterAggregate?:
      | ((
          cellData: CellDatum<T>[],
          aggregatedValue: TValue,
          index: number,
          grid: TValue[]
        ) => TCustom)
      | null,
    semanticOptions?: Record<string, unknown>
  ): AggregationResult<T, TValue, TCustom>;
  aggregate<T = unknown, TValue = number, TCustom = unknown>(
    projectedPoints: ProjectedPoint[],
    originalData: T[],
    width: number,
    height: number,
    cellSizePixels: number,
    aggregationFunction?: AggregationFunctionName | AggregationFunction<T, TValue> | null,
    onAfterAggregate?:
      | ((
          cellData: CellDatum<T>[],
          aggregatedValue: TValue,
          index: number,
          grid: TValue[]
        ) => TCustom)
      | null,
    semanticOptions?: Record<string, unknown>
  ): AggregationResult<T, TValue, TCustom>;
  static getStats(aggregationResult: AggregationResult): GridStats;
  getStats(aggregationResult: AggregationResult): GridStats;
}

export class Projector {
  constructor(map?: MapLibreMap | null);
  static projectPoints<T = unknown>(
    data: T[],
    getPosition: (datum: T) => Position,
    getWeight: (datum: T) => number,
    map: MapLibreMap
  ): ProjectedPoint[];
  setMap(map: MapLibreMap | null): void;
  project<T = unknown>(
    data: T[],
    getPosition: (datum: T) => Position,
    getWeight: (datum: T) => number
  ): ProjectedPoint[];
}

export class CellQueryEngine<T = unknown, TValue = number, TCustom = unknown> {
  constructor(aggregationResult?: AggregationResult<T, TValue, TCustom> | null);
  static getCellAt<T = unknown, TValue = number, TCustom = unknown>(
    aggregationResult: AggregationResult<T, TValue, TCustom> | null,
    point: ScreenPoint
  ): SemanticCell<T, TCustom> | null;
  static getCellsInBounds<T = unknown, TValue = number, TCustom = unknown>(
    aggregationResult: AggregationResult<T, TValue, TCustom> | null,
    bounds: ScreenBounds
  ): SemanticCell<T, TCustom>[];
  static getCellsAboveThreshold<T = unknown, TValue = number, TCustom = unknown>(
    aggregationResult: AggregationResult<T, TValue, TCustom> | null,
    threshold: number
  ): SemanticCell<T, TCustom>[];
  setAggregationResult(aggregationResult: AggregationResult<T, TValue, TCustom>): void;
  getCellAt(point: ScreenPoint): SemanticCell<T, TCustom> | null;
  getCellsInBounds(bounds: ScreenBounds): SemanticCell<T, TCustom>[];
  getCellsAboveThreshold(threshold: number): SemanticCell<T, TCustom>[];
}

export class GlyphUtilities {
  static drawCircleGlyph: typeof ScreenGridLayerGL.drawCircleGlyph;
  static drawBarGlyph: typeof ScreenGridLayerGL.drawBarGlyph;
  static drawPieGlyph: typeof ScreenGridLayerGL.drawPieGlyph;
  static drawScatterGlyph: typeof ScreenGridLayerGL.drawScatterGlyph;
  static drawDonutGlyph: typeof ScreenGridLayerGL.drawDonutGlyph;
  static drawHeatmapGlyph: typeof ScreenGridLayerGL.drawHeatmapGlyph;
  static drawRadialBarGlyph: typeof ScreenGridLayerGL.drawRadialBarGlyph;
  static drawTimeSeriesGlyph: typeof ScreenGridLayerGL.drawTimeSeriesGlyph;
}

export interface Registry<TFunction> {
  register(name: string, fn: TFunction, options?: { overwrite?: boolean }): void;
  get(name: string | TFunction): TFunction | null;
  has(name: string): boolean;
  list(): string[];
  unregister(name: string): boolean;
  clear(): void;
}

export const AggregationFunctionRegistry: Registry<AggregationFunction>;
export const NormalizationFunctionRegistry: Registry<NormalizationFunction>;
export const GlyphRegistry: {
  register<T = unknown, TCustom = unknown>(
    name: string,
    plugin: GlyphPlugin<T, TCustom>,
    options?: { overwrite?: boolean }
  ): void;
  get<T = unknown, TCustom = unknown>(name: string): GlyphPlugin<T, TCustom> | undefined;
  has(name: string): boolean;
  list(): string[];
  unregister(name: string): boolean;
  clear(): void;
};

export const AggregationFunctions: {
  sum: AggregationFunction;
  mean: AggregationFunction;
  count: AggregationFunction;
  max: AggregationFunction;
  min: AggregationFunction;
};
export const NormalizationFunctions: {
  maxLocal: NormalizationFunction;
  maxGlobal: NormalizationFunction;
  zScore: NormalizationFunction;
  percentile: NormalizationFunction;
};

export function groupBy<T = unknown>(
  cellData: CellDatum<T>[],
  keyExtractor: keyof T | string | ((item: CellDatum<T>) => unknown),
  valueExtractor?: keyof T | string | ((item: CellDatum<T>) => number) | null,
  aggregator?: (values: number[]) => number
): globalThis.Map<unknown, number>;
export function extractAttributes<T = unknown>(
  cellData: CellDatum<T>[],
  extractors: Record<string, keyof T | string | ((item: CellDatum<T>) => unknown)>
): Record<string, unknown>;
export function computeStats<T = unknown>(
  cellData: CellDatum<T>[],
  valueExtractor?: keyof T | string | ((item: CellDatum<T>) => number) | null
): { mean: number; std: number; min: number; max: number; count: number; sum: number };
export function groupByTime<T = unknown>(
  cellData: CellDatum<T>[],
  timeExtractor: keyof T | string | ((item: CellDatum<T>) => unknown),
  valueExtractor?: keyof T | string | ((item: CellDatum<T>) => number) | null,
  period?: 'year' | 'month' | 'day' | 'hour' | string,
  aggregator?: (values: number[]) => number
): Array<{ time: unknown; value: number }>;

export const SemanticCellSummarizer: unknown;
export const PlacementEngine: unknown;
export const PlacementValidator: unknown;
export const PlacementStrategyRegistry: unknown;
export const GeometryUtils: unknown;
export const CanvasManager: unknown;
export const Renderer: unknown;
export const EventBinder: unknown;
export const EventHandlers: unknown;
export const ConfigManager: unknown;
export const AggregationModeRegistry: unknown;
export const ScreenGridMode: unknown;
export const ScreenHexMode: unknown;
export const Legend: unknown;
export const LegendDataExtractor: unknown;
export const LegendRenderers: unknown;
export const Logger: unknown;
export function setDebug(enabled: boolean): void;

// ---------------------------------------------------------------------------
// Grammar: declarative spec validation and compilation (src/grammar/)
// JSON Schema contracts live in src/grammar/schemas/.
// ---------------------------------------------------------------------------

/** Current Screengrid spec format version implemented by this library. */
export const SPEC_VERSION: string;

export interface SpecParameter {
  name: string;
  label?: string;
  /** [min, max], min < max */
  domain: [number, number];
  default: number;
  step?: number;
  description?: string;
}

export interface DerivedTerm {
  field: string;
  /** Constant weight or a reference to a declared parameter. */
  weight?: number | { param: string };
  /** "global" rescales to [0,1] via the dataset profile's min/max before weighting. */
  normalize?: 'none' | 'global';
  /** Invert after normalization (1 - v), for cost-like criteria. */
  invert?: boolean;
}

export interface DenominatorSpec {
  type: 'none' | 'count' | 'field' | 'area' | 'external';
  field?: string;
  value?: number;
  description?: string;
}

export interface DerivedMeasure {
  name: string;
  op: 'weighted-sum' | 'ratio' | 'difference';
  aggregate?: 'mean' | 'sum';
  terms?: DerivedTerm[];
  numerator?: DerivedTerm;
  denominator?: DenominatorSpec;
  description?: string;
}

/**
 * Declarative Screengrid specification. Structural contract:
 * src/grammar/schemas/screengrid-spec.schema.json. Cross-field and cartographic
 * rules are enforced by validateSpec.
 */
export interface ScreengridSpec {
  version: string;
  datasetProfile: Record<string, unknown> & {
    rowCount: number;
    fields: Array<Record<string, unknown> & { name: string; type: string; missingCount?: number }>;
    coordinateCandidates: Array<{ x: string; y: string; coordinateSystem: 'lonlat' | 'xy'; confidence: number }>;
  };
  intent: {
    task: 'density' | 'composition' | 'profile-comparison' | 'temporal-trend' | 'anomaly' | 'uncertainty' | 'flow-balance' | 'suitability';
    audience?: string;
    comparison?: 'within-cell' | 'across-cells' | 'across-viewports' | 'across-zoom';
    question?: string;
  };
  parameters?: SpecParameter[];
  screengrid: Record<string, unknown> & {
    coordinateSystem: 'lonlat' | 'xy';
    coordinateFields: { x: string; y: string };
    aggregationMode: 'screen-grid' | 'screen-hex';
    aggregation: { function: string; field?: string | null; measure?: string; ref?: string };
    derivedMeasures?: DerivedMeasure[];
    cellSizePixels: number;
    normalization: 'max-local' | 'max-global' | 'z-score' | 'percentile';
  };
  glyph: Record<string, unknown>;
  validation?: Record<string, unknown>;
  interaction: Record<string, unknown>;
}

export interface SpecValidationResult {
  valid: boolean;
  errors: string[];
  /** Cartographic validation output: renders, but may mislead for the stated intent. */
  warnings: string[];
  /** "partial" when the spec uses the custom-function escape hatch. */
  checkability: 'full' | 'partial';
}

/** Validate a spec: structural references plus cartographic design-knowledge rules. */
export function validateSpec(spec: ScreengridSpec): SpecValidationResult;

export function validateAssistantProposal(proposal: unknown): { valid: boolean; errors: string[] };

/** Resolve declared parameters with runtime overrides, clamped to each domain. */
export function resolveParameters(
  spec: ScreengridSpec,
  overrides?: Record<string, number>
): Record<string, number>;

/**
 * Compile a derived measure into an aggregation function usable as
 * ScreenGridLayerGL's aggregationFunction (receives the cell's records).
 */
export function compileDerivedMeasure(
  spec: ScreengridSpec,
  measureName: string,
  parameterOverrides?: Record<string, number>
): (records: CellDatum[]) => number;

/**
 * A DOM-free description of the legend a spec implies. The library renders no
 * markup; applications turn this into whatever their page needs. `normalizationNote`
 * is the honesty line — what the scaling actually means, in words, for a caption.
 */
export interface CompiledLegend {
  enabled: boolean;
  title: string | null;
  kind: 'sequential' | 'categorical' | 'measures';
  palette: string;
  categories: string[] | null;
  measures: string[] | null;
  normalization: string;
  normalizationNote: string;
  viewportNote: string;
}

/** The executable visual half of a spec: palette, glyph callback, legend. */
export interface CompiledGlyph {
  enableGlyphs: boolean;
  showBackground: boolean;
  glyphSize: number;
  colorScale: (v: number) => [number, number, number, number];
  onAggregate?: (result: unknown) => void;
  onDrawCell?: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    normalizedValue: number,
    cell: Record<string, unknown>
  ) => void;
  legend: CompiledLegend;
}

export interface CompiledSpec {
  /** ScreenGridLayerGL constructor options (data not included). */
  layerOptions: Record<string, unknown> & {
    aggregationMode: string;
    cellSizePixels: number;
    normalizationFunction: string;
    aggregationFunction: string | ((records: CellDatum[]) => number);
    getPosition: (d: Record<string, unknown>) => [number, number];
    getWeight: () => number;
    colorScale?: (v: number) => [number, number, number, number];
    enableGlyphs?: boolean;
    showBackground?: boolean;
    glyphSize?: number;
    onDrawCell?: CompiledGlyph['onDrawCell'];
    onAggregate?: (result: unknown) => void;
  };
  parameters: Record<string, number>;
  checkability: 'full' | 'partial';
  /** null when compiled with `{ glyph: false }`. */
  legend: CompiledLegend | null;
  /** The compiled visual half; absent when compiled with `{ glyph: false }`. */
  glyph?: CompiledGlyph;
}

/**
 * Compile a spec into executable layer options — both the analytical half
 * (aggregation, cell size, normalization, positions) and the visual half
 * (colour scale, glyph callback, legend). Pass `{ glyph: false }` to emit the
 * analytical half alone.
 */
export function compileSpec(
  spec: ScreengridSpec,
  options?: {
    parameters?: Record<string, number>;
    customFunctions?: Record<string, (records: CellDatum[]) => number>;
    glyph?: boolean;
    glyphSize?: number;
    onAggregate?: (result: unknown) => void;
  }
): CompiledSpec;

/** Compile only the `glyph` block of a spec into render options. */
export function compileGlyph(
  spec: ScreengridSpec,
  options?: { glyphSize?: number; onAggregate?: (result: unknown) => void }
): CompiledGlyph;

/** Build a `colorScale` from one of the grammar's palette names. */
export function colorScaleFromPalette(
  palette: string,
  options?: { opacity?: number; floor?: number }
): (v: number) => [number, number, number, number];

/** The discrete, colour-blind-aware palette used for categorical encodings. */
export const CATEGORICAL_COLORS: string[];
