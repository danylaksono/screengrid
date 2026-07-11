import { parseUploadedFile, SAMPLE_DATA } from './data.js';
import { profileDataset } from './profile.js';
import { createDefaultSpec, applyPatch, clone } from './spec.js';
import { validateAssistantProposal, validateSpec } from './validation.js';
import { ScreengridRenderer } from './rendering.js';
import { Orchestrator, createLocalProposal } from './orchestrator.js';
import { requestAssistantProposal } from './llm.js';

const state = {
  rows: [],
  spec: null,
  sourceName: '',
  sourceType: '',
  proposal: null
};

const elements = {
  fileInput: document.getElementById('fileInput'),
  screengridSpecEditor: document.getElementById('screengridSpecEditor'),
  glyphSpecEditor: document.getElementById('glyphSpecEditor'),
  interactionSpecEditor: document.getElementById('interactionSpecEditor'),
  applySpecEditorsBtn: document.getElementById('applySpecEditorsBtn'),
  copySpecBtn: document.getElementById('copySpecBtn'),
  viewTitle: document.getElementById('viewTitle'),
  viewSubtitle: document.getElementById('viewSubtitle'),
  profileBtn: document.getElementById('profileBtn'),
  closeProfileBtn: document.getElementById('closeProfileBtn'),
  profileModal: document.getElementById('profileModal'),
  fitBtn: document.getElementById('fitBtn'),
  validateBtn: document.getElementById('validateBtn'),
  legendText: document.getElementById('legendText'),
  cellTooltip: document.getElementById('cellTooltip'),
  toast: document.getElementById('toast'),
  validationBadge: document.getElementById('validationBadge'),
  evaluationPanel: document.getElementById('evaluationPanel'),
  profileList: document.getElementById('profileList'),
  attributeList: document.getElementById('attributeList'),
  baseUrl: document.getElementById('baseUrl'),
  model: document.getElementById('model'),
  apiKey: document.getElementById('apiKey'),
  persistKey: document.getElementById('persistKey'),
  assistantPrompt: document.getElementById('assistantPrompt'),
  suggestLocalBtn: document.getElementById('suggestLocalBtn'),
  askLlmBtn: document.getElementById('askLlmBtn'),
  proposalList: document.getElementById('proposalList')
};

const map = new maplibregl.Map({
  container: 'map',
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
    layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.72 } }]
  },
  center: [-0.11, 51.51],
  zoom: 11
});

const renderer = new ScreengridRenderer(map);
const orchestrator = new Orchestrator();
let selectedCell = null;

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

elements.apiKey.value = localStorage.getItem('screengrid-demo-api-key') || '';
elements.persistKey.checked = Boolean(elements.apiKey.value);

elements.fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = await parseUploadedFile(file);
    loadRows(parsed.rows, parsed.sourceName, parsed.sourceType);
    showToast(`Loaded ${parsed.rows.length} rows from ${parsed.sourceName}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.fileInput.value = '';
  }
});

elements.applySpecEditorsBtn.addEventListener('click', applySpecEditors);

[elements.screengridSpecEditor, elements.glyphSpecEditor, elements.interactionSpecEditor].forEach((editor) => {
  editor.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      applySpecEditors();
    }
  });
});

elements.fitBtn.addEventListener('click', () => {
  if (state.spec) renderer.fit(state.rows, state.spec);
});

elements.validateBtn.addEventListener('click', () => {
  const validation = state.spec ? validateSpec(state.spec) : { valid: false, errors: ['No spec loaded.'], warnings: [] };
  showToast(validation.valid ? validation.warnings[0] || 'Spec is valid.' : validation.errors.join(' '));
  renderValidation(validation);
});

elements.copySpecBtn.addEventListener('click', async () => {
  if (!state.spec) return;
  await navigator.clipboard.writeText(JSON.stringify(state.spec, null, 2));
  showToast('Current design spec copied.');
});

elements.profileBtn.addEventListener('click', () => {
  elements.profileModal.hidden = false;
});

elements.closeProfileBtn.addEventListener('click', () => {
  elements.profileModal.hidden = true;
});

elements.profileModal.addEventListener('click', (event) => {
  if (event.target === elements.profileModal) elements.profileModal.hidden = true;
});

elements.suggestLocalBtn.addEventListener('click', () => {
  if (!state.spec) return showToast('No design spec loaded.');
  renderProposal(createLocalProposal(state.spec));
});

elements.askLlmBtn.addEventListener('click', async () => {
  if (!state.spec) return showToast('No design spec loaded.');
  try {
    if (elements.persistKey.checked) localStorage.setItem('screengrid-demo-api-key', elements.apiKey.value);
    else localStorage.removeItem('screengrid-demo-api-key');

    const proposal = await requestAssistantProposal({
      baseUrl: elements.baseUrl.value,
      apiKey: elements.apiKey.value,
      model: elements.model.value,
      temperature: 0.2,
      prompt: elements.assistantPrompt.value,
      spec: state.spec,
      tools: orchestrator.registry.list()
    });
    renderProposal(proposal);
  } catch (error) {
    showToast(error.message);
  }
});

window.addEventListener('screengrid-cell-hover', (event) => {
  if (!state.spec || selectedCell) return;
  if (!state.spec.interaction.hover && state.spec.interaction.tooltip?.trigger === 'click') return;
  showCellTooltip(event.detail, false);
});

window.addEventListener('screengrid-cell-click', (event) => {
  if (!state.spec) return;
  if (state.spec.interaction.selection) selectedCell = event.detail;
  showCellTooltip(event.detail, Boolean(state.spec.interaction.selection || state.spec.interaction.tooltip?.trigger === 'click'));
});

map.on('mouseleave', () => {
  if (!selectedCell) hideCellTooltip();
});

map.on('click', (event) => {
  if (!state.spec?.interaction?.selection) return;
  if (!renderer.layer?.getCellAt(event.point)) {
    selectedCell = null;
    hideCellTooltip();
  }
});

function loadRows(rows, sourceName, sourceType) {
  const profile = profileDataset(rows, sourceName, sourceType);
  state.rows = rows;
  state.sourceName = sourceName;
  state.sourceType = sourceType;
  state.spec = createDefaultSpec(profile);
  state.proposal = null;
  renderUi();
  renderer.fit(state.rows, state.spec);
}

function applySpecEditors() {
  if (!state.spec) return;
  try {
    const next = clone(state.spec);
    next.screengrid = JSON.parse(elements.screengridSpecEditor.value);
    next.glyph = JSON.parse(elements.glyphSpecEditor.value);
    next.interaction = JSON.parse(elements.interactionSpecEditor.value);

    const validation = validateSpec(next);
    if (!validation.valid) {
      renderValidation(validation);
      showToast(validation.errors.join(' '));
      return;
    }

    state.spec = next;
    showToast('Grammar applied.');
    renderUi();
  } catch (error) {
    showToast(`JSON parse error: ${error.message}`);
  }
}

function renderUi() {
  const hasSpec = Boolean(state.spec);
  elements.viewTitle.textContent = hasSpec ? state.sourceName : 'No design spec loaded';
  elements.viewSubtitle.textContent = hasSpec
    ? state.spec.interaction.explanation
    : 'Edit the grammar objects directly, then apply them to render the screengrid.';

  renderSpecEditors();
  renderProfile();
  renderAttributeDesign();
  renderSpec();
  elements.proposalList.innerHTML = '';
}

function renderSpecEditors() {
  if (!state.spec) {
    elements.screengridSpecEditor.value = '';
    elements.glyphSpecEditor.value = '';
    elements.interactionSpecEditor.value = '';
    return;
  }

  elements.screengridSpecEditor.value = JSON.stringify(state.spec.screengrid, null, 2);
  elements.glyphSpecEditor.value = JSON.stringify(state.spec.glyph, null, 2);
  elements.interactionSpecEditor.value = JSON.stringify(state.spec.interaction, null, 2);
}

function showCellTooltip(payload, pinned) {
  const tooltip = state.spec.interaction.tooltip || {};
  if (tooltip.enabled === false) return;
  const cell = payload?.cell;
  const mapEvent = payload?.event;
  if (!cell || !mapEvent) return;

  elements.cellTooltip.classList.toggle('pinned', pinned);
  elements.cellTooltip.innerHTML = renderTooltipContent(cell, state.spec);
  elements.cellTooltip.hidden = false;
  positionTooltip(mapEvent.point);
}

function hideCellTooltip() {
  elements.cellTooltip.hidden = true;
  elements.cellTooltip.classList.remove('pinned');
}

function positionTooltip(point) {
  const mapRect = document.getElementById('map').getBoundingClientRect();
  const tooltipRect = elements.cellTooltip.getBoundingClientRect();
  const x = Math.min(point.x + 14, mapRect.width - tooltipRect.width - 14);
  const y = Math.min(point.y + 14, mapRect.height - tooltipRect.height - 14);
  elements.cellTooltip.style.left = `${Math.max(14, x)}px`;
  elements.cellTooltip.style.top = `${Math.max(14, y)}px`;
}

function renderTooltipContent(cell, spec) {
  const tooltip = spec.interaction.tooltip || {};
  const cellData = cell.cellData || cell.records?.rawRefs || [];
  const fields = tooltip.fields || [];
  const calculations = tooltip.calculations || [{ label: 'Points', op: 'count' }];
  const fieldRows = fields.map((field) => tooltipRow(field, summariseField(cellData, field)));
  const calculationRows = calculations.map((calculation) => tooltipRow(
    calculation.label,
    evaluateCalculation(cellData, calculation)
  ));

  return `
    <h3>${escapeHtml(tooltip.title || 'Cell detail')}</h3>
    <div class="tooltip-grid">
      ${tooltipRow('Cell', `${cell.col ?? '-'}, ${cell.row ?? '-'}`)}
      ${tooltipRow('Records', cell.records?.count ?? cellData.length)}
      ${tooltipRow('Reliability', cell.reliability?.sampleSizeClass || '-')}
      ${tooltipRow('Normalisation', cell.comparability?.normalization || spec.screengrid.normalization)}
      ${fieldRows.join('')}
      ${calculationRows.join('')}
    </div>
  `;
}

function tooltipRow(label, value) {
  return `<div class="tooltip-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatTooltipValue(value))}</strong></div>`;
}

function summariseField(cellData, field) {
  const values = cellData.map((item) => item.data?.[field]).filter((value) => value !== null && value !== undefined);
  if (!values.length) return '-';
  if (typeof values[0] === 'number') return mean(values.map(Number));
  return mode(values);
}

function evaluateCalculation(cellData, calculation) {
  if (calculation.expression) return evaluateExpression(cellData, calculation.expression);
  if (calculation.op === 'count') return cellData.length;
  if (calculation.op === 'distinct') return distinctValues(cellData, calculation.field).length;
  if (calculation.op === 'mode') return mode(valuesForField(cellData, calculation.field));
  const values = valuesForField(cellData, calculation.field).map(Number).filter(Number.isFinite);
  if (!values.length) return '-';
  if (calculation.op === 'sum') return values.reduce((sum, value) => sum + value, 0);
  if (calculation.op === 'min') return Math.min(...values);
  if (calculation.op === 'max') return Math.max(...values);
  return mean(values);
}

function evaluateExpression(cellData, expression) {
  let compiled = expression;
  const functions = {
    count: () => cellData.length,
    sum: (field) => sum(valuesForField(cellData, field).map(Number).filter(Number.isFinite)),
    mean: (field) => mean(valuesForField(cellData, field).map(Number).filter(Number.isFinite)),
    min: (field) => Math.min(...valuesForField(cellData, field).map(Number).filter(Number.isFinite)),
    max: (field) => Math.max(...valuesForField(cellData, field).map(Number).filter(Number.isFinite))
  };

  compiled = compiled.replace(/\b(count|sum|mean|min|max)\(([^)]*)\)/g, (_match, fn, rawField) => {
    const field = rawField.trim();
    const value = functions[fn](field);
    return Number.isFinite(value) ? String(value) : '0';
  });

  if (!/^[\d+\-*/().\s]+$/.test(compiled)) return 'Invalid expression';
  try {
    return Function(`"use strict"; return (${compiled});`)();
  } catch (_error) {
    return 'Invalid expression';
  }
}

function renderProfile() {
  if (!state.spec) {
    elements.profileList.innerHTML = '<p class="empty">No profile yet.</p>';
    return;
  }

  elements.profileList.innerHTML = state.spec.datasetProfile.fields.map((field) => `
    <div class="field-item">
      <div>
        <strong>${escapeHtml(field.name)}</strong>
        <small>${field.type} - missing ${field.missingCount} - distinct ${field.distinctCount}</small>
      </div>
      <span>${field.type === 'number' ? formatRange(field) : formatCategories(field)}</span>
    </div>
  `).join('');
}

function renderAttributeDesign() {
  if (!state.spec) {
    elements.attributeList.innerHTML = '<p class="empty">Load a spec to inspect possible visual encodings.</p>';
    return;
  }

  elements.attributeList.innerHTML = state.spec.datasetProfile.fields.map((field) => {
    const roles = rolesForField(field, state.spec);
    return `
      <div class="attribute-item">
        <header>
          <strong>${escapeHtml(field.name)}</strong>
          <span class="role-pill">${escapeHtml(field.type)}</span>
        </header>
        <div class="role-list">
          ${roles.map((role) => `<span class="role-pill">${escapeHtml(role)}</span>`).join('')}
        </div>
        <p>${escapeHtml(describeFieldUse(field, roles))}</p>
      </div>
    `;
  }).join('');
}

function renderSpec() {
  if (!state.spec || !map.loaded()) return;
  const validation = validateSpec(state.spec);
  renderValidation(validation);
  renderEvaluation(validation);
  elements.legendText.textContent = describeEncoding(state.spec);
  if (validation.valid) renderer.render(state.rows, state.spec);
}

function renderValidation(validation) {
  elements.validationBadge.textContent = validation.valid ? 'Valid' : 'Invalid';
  elements.validationBadge.style.color = validation.valid ? '#266d55' : '#bf5a36';
}

function renderEvaluation(validation) {
  if (!state.spec || !elements.evaluationPanel) return;
  const spec = state.spec;
  const warnings = validation.warnings.length
    ? validation.warnings
    : ['No cartographic warnings for the current grammar.'];
  const comparability = ['max-global', 'z-score'].includes(spec.screengrid.normalization)
    ? 'Comparable across cells in the current view.'
    : 'Best read as local pattern, not strict cross-cell comparison.';

  elements.evaluationPanel.innerHTML = `
    <div class="evaluation-summary">
      <strong>${escapeHtml(spec.intent?.task || 'density')}</strong>
      <span>${escapeHtml(spec.intent?.comparison || 'across-cells')}</span>
    </div>
    <p>${escapeHtml(comparability)}</p>
    <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
  `;
}

function renderProposal(proposal) {
  const proposalValidation = validateAssistantProposal(proposal);
  if (!proposalValidation.valid) {
    showToast(proposalValidation.errors.join(' '));
    return;
  }

  state.proposal = proposal;
  elements.proposalList.innerHTML = `
    <div class="proposal">
      <h3>${escapeHtml(proposal.summary)}</h3>
      <p>${escapeHtml(proposal.rationale || '')}</p>
      ${(proposal.warnings || []).map((warning) => `<p>${escapeHtml(warning)}</p>`).join('')}
    </div>
    ${proposal.actions.map((action) => renderAction(action)).join('')}
  `;

  elements.proposalList.querySelectorAll('[data-accept]').forEach((button) => {
    button.addEventListener('click', () => acceptAction(button.dataset.accept));
  });
  elements.proposalList.querySelectorAll('[data-reject]').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.proposal').remove();
      showToast('Suggestion rejected.');
    });
  });
}

function renderAction(action) {
  return `
    <div class="proposal">
      <h3>${escapeHtml(action.label)} (${Math.round(action.confidence * 100)}%)</h3>
      <pre>${escapeHtml(JSON.stringify(action.patch, null, 2))}</pre>
      <div class="proposal-actions">
        <button class="primary" type="button" data-accept="${escapeHtml(action.id)}">Accept</button>
        <button type="button" data-reject="${escapeHtml(action.id)}">Reject</button>
      </div>
    </div>
  `;
}

function acceptAction(actionId) {
  const action = state.proposal?.actions.find((item) => item.id === actionId);
  if (!action) return;
  try {
    const next = applyPatch(state.spec, action.patch);
    const validation = validateSpec(next);
    if (!validation.valid) {
      showToast(validation.errors.join(' '));
      return;
    }
    state.spec = next;
    showToast('Suggestion applied.');
    renderUi();
  } catch (error) {
    showToast(error.message);
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 4200);
}

function formatRange(field) {
  if (field.min === null) return '-';
  return `${formatNumber(field.min)} to ${formatNumber(field.max)}`;
}

function formatCategories(field) {
  return (field.categories || []).slice(0, 2).map((item) => item.value).join(', ') || '-';
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatTooltipValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value ?? '-';
}

function valuesForField(cellData, field) {
  if (!field) return [];
  return cellData.map((item) => item.data?.[field]).filter((value) => value !== null && value !== undefined);
}

function distinctValues(cellData, field) {
  return Array.from(new Set(valuesForField(cellData, field).map(String)));
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values) {
  if (!values.length) return 0;
  return sum(values) / values.length;
}

function mode(values) {
  if (!values.length) return '-';
  const counts = new Map();
  values.forEach((value) => counts.set(String(value), (counts.get(String(value)) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
}

function rolesForField(field, spec) {
  const roles = [];
  const coords = spec.screengrid.coordinateFields;
  const channels = spec.glyph.channels;
  if (field.name === coords.x) roles.push('x coordinate');
  if (field.name === coords.y) roles.push('y coordinate');
  if (field.name === spec.screengrid.aggregation.field) roles.push(`${spec.screengrid.aggregation.function} value`);
  if (field.name === channels.size?.field) roles.push('glyph size');
  if (field.name === channels.color?.field) roles.push('glyph colour');
  if (field.name === channels.opacity?.field) roles.push('glyph opacity');
  if (field.name === channels.segments?.field) roles.push('segments');
  if ((channels.measures || []).some((measure) => measure.field === field.name)) roles.push('bar measure');
  if (spec.glyph.type === 'custom' && customGlyphUsesField(spec.glyph.custom, field.name)) roles.push('custom glyph');
  if (!roles.length) roles.push(field.type === 'number' ? 'available measure' : 'available category');
  return roles;
}

function describeFieldUse(field, roles) {
  if (roles.includes('bar measure')) return 'This numeric attribute is drawn inside each cell as one bar in the multivariate glyph.';
  if (roles.includes('custom glyph')) return 'This attribute is referenced by the custom glyph grammar.';
  if (roles.includes('segments')) return 'This attribute splits pie or rose-style glyphs into categorical parts.';
  if (roles.includes('glyph colour')) return 'This attribute controls the dominant colour encoding for each cell.';
  if (roles.includes('glyph size')) return 'This attribute controls glyph area, useful for magnitude or intensity.';
  if (field.type === 'number') return 'Numeric fields can be aggregated, sized, coloured, used for opacity, or added as bar/line measures.';
  return 'Categorical fields can drive colour groups, segment composition, labels, or small-multiple splits.';
}

function describeEncoding(spec) {
  if (spec.glyph.type === 'custom') {
    const marks = (spec.glyph.custom?.marks || []).map((mark) => mark.mark).join(', ') || 'none';
    return `Custom glyph: ${spec.glyph.custom?.layout || 'unknown'} layout with ${marks} marks.`;
  }
  const measures = (spec.glyph.channels.measures || []).map((measure) => measure.field).join(', ') || 'none';
  if (spec.glyph.type === 'bar') {
    return `Bar glyph: bars show ${measures}; size=${spec.glyph.channels.size?.field}; colour=${spec.glyph.channels.color?.field}; opacity=${spec.glyph.channels.opacity?.field}.`;
  }
  if (spec.glyph.type === 'pie') {
    return `Pie glyph: slices show ${spec.glyph.channels.segments?.field || spec.glyph.channels.color?.field}; size=${spec.glyph.channels.size?.field}; palette=${spec.glyph.palette}.`;
  }
  return `${spec.glyph.type} glyph: size=${spec.glyph.channels.size?.field}; colour=${spec.glyph.channels.color?.field}; opacity=${spec.glyph.channels.opacity?.field}.`;
}

function customGlyphUsesField(custom, fieldName) {
  return (custom?.marks || []).some((mark) => (mark.data?.fields || []).includes(fieldName));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

map.on('load', () => {
  renderUi();
  loadRows(SAMPLE_DATA, 'London civic sample', 'csv');
});
