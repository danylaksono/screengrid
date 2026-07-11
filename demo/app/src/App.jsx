import { useMemo, useState } from 'react';
import { CASE_STUDIES } from './lib/demoData.js';
import { useScreengridStore } from './store/useScreengridStore.js';
import { MapCanvas } from './components/MapCanvas.jsx';
import { ChatComposer } from './components/ChatComposer.jsx';
import { EvaluationPanel } from './components/EvaluationPanel.jsx';
import { InspectorPanel } from './components/InspectorPanel.jsx';

export function App() {
  const rows = useScreengridStore((state) => state.rows);
  const sourceName = useScreengridStore((state) => state.sourceName);
  const spec = useScreengridStore((state) => state.spec);
  const activeCaseId = useScreengridStore((state) => state.activeCaseId);
  const loadCase = useScreengridStore((state) => state.loadCase);
  const loadFile = useScreengridStore((state) => state.loadFile);
  const [uploadError, setUploadError] = useState('');

  const summary = useMemo(() => {
    const fields = spec.datasetProfile.fields.length;
    const warnings = useScreengridStore.getState().validation.warnings.length;
    return { fields, warnings };
  }, [spec]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadError('');
      await loadFile(file);
    } catch (error) {
      setUploadError(error.message);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <main className="research-app">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">SG</div>
          <div>
            <h1>Screengrid Grammar Lab</h1>
            <p>Publication-ready demonstrator for semantic gridded glyphmaps.</p>
          </div>
        </div>
        <div className="topbar-meta">
          <span>{rows.length.toLocaleString()} records</span>
          <span>{summary.fields} fields</span>
          <span>{summary.warnings} warnings</span>
        </div>
      </header>

      <section className="app-grid">
        <aside className="case-rail">
          <div className="rail-section">
            <h2>Case Studies</h2>
            <div className="case-list">
              {CASE_STUDIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === activeCaseId ? 'case-card selected' : 'case-card'}
                  onClick={() => loadCase(item.id)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.intent}</span>
                  <p>{item.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rail-section upload-section">
            <h2>Upload Data</h2>
            <label className="file-control">
              <input type="file" accept=".csv,.json,.geojson,text/csv,application/json,application/geo+json" onChange={handleUpload} />
              <span>Choose CSV or GeoJSON</span>
            </label>
            {uploadError ? <p className="error-text">{uploadError}</p> : null}
          </div>

          <div className="rail-section compact">
            <h2>Current Dataset</h2>
            <p className="dataset-name">{sourceName}</p>
            <dl>
              <div><dt>Intent</dt><dd>{spec.intent.task}</dd></div>
              <div><dt>Mode</dt><dd>{spec.screengrid.aggregationMode}</dd></div>
              <div><dt>Normalisation</dt><dd>{spec.screengrid.normalization}</dd></div>
            </dl>
          </div>
        </aside>

        <section className="map-column">
          <MapCanvas />
          <EvaluationPanel />
        </section>

        <section className="chat-column">
          <ChatComposer />
          <InspectorPanel />
        </section>
      </section>
    </main>
  );
}
