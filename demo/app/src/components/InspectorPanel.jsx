import { useScreengridStore } from '../store/useScreengridStore.js';

const TABS = ['evaluation', 'cell', 'grammar'];

export function InspectorPanel() {
  const tab = useScreengridStore((state) => state.inspectorTab);
  const setTab = useScreengridStore((state) => state.setInspectorTab);

  return (
    <section className="inspector">
      <div className="inspector-tabs">
        {TABS.map((item) => (
          <button key={item} type="button" className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {tab === 'evaluation' ? <EvaluationDetails /> : null}
      {tab === 'cell' ? <CellDetails /> : null}
      {tab === 'grammar' ? <GrammarDetails /> : null}
    </section>
  );
}

function EvaluationDetails() {
  const validation = useScreengridStore((state) => state.validation);
  return (
    <div className="inspector-body">
      <h3>Cartographic Checks</h3>
      <p>Warnings are design-knowledge constraints, not syntax errors. They document interpretation risks for publication figures.</p>
      <ul className="check-list">
        {validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        {!validation.warnings.length ? <li>No warnings for the current grammar.</li> : null}
      </ul>
    </div>
  );
}

function CellDetails() {
  const selectedCell = useScreengridStore((state) => state.selectedCell);
  const hoveredCell = useScreengridStore((state) => state.hoveredCell);
  const cell = selectedCell || hoveredCell;
  if (!cell) {
    return (
      <div className="inspector-body empty-state">
        <h3>No cell selected</h3>
        <p>Hover or click a cell to inspect semantic measures, reliability, and comparability metadata.</p>
      </div>
    );
  }
  const fields = Object.entries(cell.measures?.fields || {}).slice(0, 8);
  return (
    <div className="inspector-body">
      <h3>{cell.id}</h3>
      <dl className="fact-grid">
        <div><dt>Records</dt><dd>{cell.records?.count ?? cell.cellData?.length ?? 0}</dd></div>
        <div><dt>Reliability</dt><dd>{cell.reliability?.sampleSizeClass || '-'}</dd></div>
        <div><dt>Cell type</dt><dd>{cell.spatial?.type || '-'}</dd></div>
        <div><dt>Normalisation</dt><dd>{cell.comparability?.normalization || '-'}</dd></div>
      </dl>
      <div className="field-summary-list">
        {fields.map(([name, summary]) => (
          <div className="field-summary" key={name}>
            <strong>{name}</strong>
            <span>{summary.type}</span>
            <p>{summary.type === 'number' ? `mean ${format(summary.mean)} · min ${format(summary.min)} · max ${format(summary.max)}` : `${summary.distinct} categories · mode ${summary.mode}`}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrammarDetails() {
  const spec = useScreengridStore((state) => state.spec);
  const visibleSpec = {
    intent: spec.intent,
    screengrid: spec.screengrid,
    glyph: spec.glyph,
    validation: spec.validation
  };
  return (
    <div className="inspector-body grammar-view">
      <h3>Reproducible Spec</h3>
      <p>The chat edits this grammar through JSON Patch operations. Raw JSON is inspectable, but not the primary authoring surface.</p>
      <pre>{JSON.stringify(visibleSpec, null, 2)}</pre>
    </div>
  );
}

function format(value) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-';
}
