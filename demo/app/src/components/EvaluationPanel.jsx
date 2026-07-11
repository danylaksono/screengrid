import { useScreengridStore } from '../store/useScreengridStore.js';

export function EvaluationPanel() {
  const spec = useScreengridStore((state) => state.spec);
  const validation = useScreengridStore((state) => state.validation);
  const selectedCell = useScreengridStore((state) => state.selectedCell);
  const hoveredCell = useScreengridStore((state) => state.hoveredCell);
  const cell = selectedCell || hoveredCell;

  return (
    <section className="evaluation-strip">
      <div className="evaluation-card primary">
        <span>Intent</span>
        <strong>{spec.intent.task}</strong>
        <p>{spec.intent.question}</p>
      </div>
      <div className="evaluation-card">
        <span>Comparability</span>
        <strong>{comparabilityText(spec)}</strong>
        <p>{spec.screengrid.normalization} · {spec.screengrid.aggregationMode}</p>
      </div>
      <div className="evaluation-card warnings">
        <span>Validation</span>
        <strong>{validation.valid ? `${validation.warnings.length} warning(s)` : 'Invalid grammar'}</strong>
        <ul>
          {(validation.valid ? validation.warnings : validation.errors).slice(0, 3).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div className="evaluation-card">
        <span>Cell Probe</span>
        <strong>{cell ? cell.reliability?.sampleSizeClass || 'semantic cell' : 'Hover or click map'}</strong>
        <p>{cell ? `${cell.records?.count ?? cell.cellData?.length ?? 0} records · ${cell.comparability?.normalization || spec.screengrid.normalization}` : 'Semantic cells expose measures, reliability, and provenance.'}</p>
      </div>
    </section>
  );
}

function comparabilityText(spec) {
  if (['max-global', 'z-score'].includes(spec.screengrid.normalization)) return 'Cross-cell';
  if (spec.intent.comparison === 'within-cell') return 'Within-cell';
  return 'Local pattern';
}
