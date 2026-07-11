import densityCompositionText from '../../../fixtures/density-composition.geojson?raw';
import temporalProfileText from '../../../fixtures/temporal-profile.geojson?raw';
import uncertaintyReliabilityText from '../../../fixtures/uncertainty-reliability.geojson?raw';
import { SAMPLE_DATA, parseUploadedFile } from '../../../prototype/js/data.js';
import { profileDataset } from '../../../prototype/js/profile.js';
import { createDefaultSpec, applyPatch, clone } from '../../../prototype/js/spec.js';
import { validateAssistantProposal, validateSpec } from '../../../prototype/js/validation.js';
import { createLocalProposal } from '../../../prototype/js/orchestrator.js';
import { requestAssistantProposal } from '../../../prototype/js/llm.js';

export {
  SAMPLE_DATA,
  parseUploadedFile,
  profileDataset,
  createDefaultSpec,
  applyPatch,
  clone,
  validateAssistantProposal,
  validateSpec,
  createLocalProposal,
  requestAssistantProposal
};

export const CASE_STUDIES = [
  {
    id: 'civic-sample',
    title: 'Civic Services',
    intent: 'composition',
    description: 'A compact mixed-attribute sample for testing upload, profile, and category composition.',
    sourceName: 'London civic sample',
    sourceType: 'csv',
    rows: SAMPLE_DATA
  },
  {
    id: 'density-composition',
    title: 'Density + Composition',
    intent: 'composition',
    description: 'Point categories with volume and reliability fields for radial composition checks.',
    sourceName: 'density-composition.geojson',
    sourceType: 'geojson',
    rows: rowsFromGeoJson(JSON.parse(densityCompositionText))
  },
  {
    id: 'temporal-profile',
    title: 'Temporal Profile',
    intent: 'temporal-trend',
    description: 'Yearly values arranged as per-cell profile glyphs with global scaling.',
    sourceName: 'temporal-profile.geojson',
    sourceType: 'geojson',
    rows: rowsFromGeoJson(JSON.parse(temporalProfileText))
  },
  {
    id: 'uncertainty-reliability',
    title: 'Uncertainty',
    intent: 'uncertainty',
    description: 'Sensor-like observations with variance and confidence fields for reliability warnings.',
    sourceName: 'uncertainty-reliability.geojson',
    sourceType: 'geojson',
    rows: rowsFromGeoJson(JSON.parse(uncertaintyReliabilityText))
  }
];

export function rowsFromGeoJson(geojson) {
  return (geojson.features || [])
    .filter((feature) => feature?.geometry?.type === 'Point')
    .map((feature, index) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return {
        id: feature.id ?? index,
        ...(feature.properties || {}),
        longitude,
        latitude
      };
    });
}

export function specForRows(rows, sourceName, sourceType, intentTask = null) {
  const profile = profileDataset(rows, sourceName, sourceType);
  const spec = createDefaultSpec(profile);
  if (intentTask) {
    spec.intent = {
      ...spec.intent,
      task: intentTask,
      comparison: intentTask === 'density' ? 'within-cell' : 'across-cells'
    };
  }
  return spec;
}
