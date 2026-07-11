import { create } from 'zustand';
import {
  CASE_STUDIES,
  applyPatch,
  createLocalProposal,
  parseUploadedFile,
  requestAssistantProposal,
  specForRows,
  validateAssistantProposal,
  validateSpec
} from '../lib/demoData.js';

const initialCase = CASE_STUDIES[0];
const initialSpec = specForRows(initialCase.rows, initialCase.sourceName, initialCase.sourceType, initialCase.intent);

export const useScreengridStore = create((set, get) => ({
  rows: initialCase.rows,
  sourceName: initialCase.sourceName,
  sourceType: initialCase.sourceType,
  activeCaseId: initialCase.id,
  spec: initialSpec,
  validation: validateSpec(initialSpec),
  selectedCell: null,
  hoveredCell: null,
  activeProposal: null,
  provider: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    apiKey: ''
  },
  chat: [
    {
      id: 'welcome',
      role: 'assistant',
      kind: 'message',
      content: 'Load a case study or upload point data. Then ask for a density, composition, temporal, or uncertainty design and I will propose grammar patches rather than arbitrary rendering code.'
    }
  ],
  inspectorTab: 'evaluation',

  loadCase: (caseId) => {
    const nextCase = CASE_STUDIES.find((item) => item.id === caseId) || CASE_STUDIES[0];
    const spec = specForRows(nextCase.rows, nextCase.sourceName, nextCase.sourceType, nextCase.intent);
    set({
      rows: nextCase.rows,
      sourceName: nextCase.sourceName,
      sourceType: nextCase.sourceType,
      activeCaseId: nextCase.id,
      spec,
      validation: validateSpec(spec),
      selectedCell: null,
      hoveredCell: null,
      activeProposal: null,
      chat: append(get().chat, assistant(`Loaded ${nextCase.title}. I inferred ${spec.intent.task} intent and prepared a semantic-cell grammar.`))
    });
  },

  loadFile: async (file) => {
    const parsed = await parseUploadedFile(file);
    const spec = specForRows(parsed.rows, parsed.sourceName, parsed.sourceType);
    set({
      rows: parsed.rows,
      sourceName: parsed.sourceName,
      sourceType: parsed.sourceType,
      activeCaseId: null,
      spec,
      validation: validateSpec(spec),
      selectedCell: null,
      hoveredCell: null,
      activeProposal: null,
      chat: append(get().chat, assistant(`Uploaded ${parsed.sourceName}. I found ${parsed.rows.length} point records and inferred ${spec.intent.task} intent.`))
    });
  },

  sendChat: async (content) => {
    if (!content.trim()) return;
    set({ chat: append(get().chat, user(content)) });
    await get().runLocalCommand(content);
  },

  runLocalCommand: async (content) => {
    const state = get();
    const lower = content.toLowerCase();
    const patches = [];

    if (lower.includes('temporal') || lower.includes('trend')) {
      patches.push({ op: 'replace', path: '/intent/task', value: 'temporal-trend' });
      patches.push({ op: 'replace', path: '/intent/comparison', value: 'across-cells' });
      patches.push({ op: 'replace', path: '/screengrid/normalization', value: 'max-global' });
    } else if (lower.includes('uncertainty') || lower.includes('reliability') || lower.includes('confidence')) {
      patches.push({ op: 'replace', path: '/intent/task', value: 'uncertainty' });
      patches.push({ op: 'replace', path: '/glyph/channels/opacity/field', value: fieldByHint(state.spec, ['confidence', 'reliability']) || 'count' });
      patches.push({ op: 'replace', path: '/glyph/limits/supportsUncertainty', value: true });
    } else if (lower.includes('composition') || lower.includes('categor')) {
      patches.push({ op: 'replace', path: '/intent/task', value: 'composition' });
      patches.push({ op: 'replace', path: '/glyph/type', value: 'pie' });
      patches.push({ op: 'replace', path: '/glyph/palette', value: 'categorical' });
      patches.push({ op: 'replace', path: '/glyph/channels/segments/field', value: firstField(state.spec, 'string') });
    } else if (lower.includes('density') || lower.includes('hotspot')) {
      patches.push({ op: 'replace', path: '/intent/task', value: 'density' });
      patches.push({ op: 'replace', path: '/glyph/type', value: 'heatmap' });
      patches.push({ op: 'replace', path: '/intent/comparison', value: 'within-cell' });
    }

    if (lower.includes('global')) patches.push({ op: 'replace', path: '/screengrid/normalization', value: 'max-global' });
    if (lower.includes('hex')) patches.push({ op: 'replace', path: '/screengrid/aggregationMode', value: 'screen-hex' });

    if (patches.length) {
      const proposal = {
        summary: 'Grammar patch from chat intent',
        rationale: 'The command was translated into declarative Screengrid spec edits. No rendering code was generated.',
        actions: [{ id: crypto.randomUUID(), label: 'Apply chat-derived grammar patch', confidence: 0.82, patch: patches }],
        warnings: []
      };
      set({ activeProposal: proposal, chat: append(get().chat, proposalMessage(proposal)) });
      return;
    }

    const proposal = createLocalProposal(state.spec);
    set({ activeProposal: proposal, chat: append(get().chat, proposalMessage(proposal)) });
  },

  askProvider: async (prompt) => {
    const state = get();
    try {
      const proposal = await requestAssistantProposal({
        ...state.provider,
        temperature: 0.2,
        prompt,
        spec: state.spec,
        tools: ['profileDataset', 'suggestCellSummaries', 'validateSpec', 'renderPreview', 'explainEncoding']
      });
      const validation = validateAssistantProposal(proposal);
      if (!validation.valid) throw new Error(validation.errors.join(' '));
      set({ activeProposal: proposal, chat: append(get().chat, proposalMessage(proposal)) });
    } catch (error) {
      set({ chat: append(get().chat, assistant(error.message, 'error')) });
    }
  },

  applyAction: (actionId) => {
    const state = get();
    const action = state.activeProposal?.actions.find((item) => item.id === actionId);
    if (!action) return;
    try {
      const spec = applyPatch(state.spec, action.patch);
      const validation = validateSpec(spec);
      if (!validation.valid) {
        set({ chat: append(state.chat, assistant(validation.errors.join(' '), 'error')) });
        return;
      }
      set({
        spec,
        validation,
        activeProposal: null,
        chat: append(state.chat, assistant(`Applied "${action.label}". Validation now reports ${validation.warnings.length} cartographic warning(s).`))
      });
    } catch (error) {
      set({ chat: append(state.chat, assistant(error.message, 'error')) });
    }
  },

  rejectProposal: () => {
    set({ activeProposal: null, chat: append(get().chat, assistant('Proposal rejected. The grammar was not changed.')) });
  },

  setProvider: (provider) => set({ provider: { ...get().provider, ...provider } }),
  setHoveredCell: (hoveredCell) => set({ hoveredCell }),
  setSelectedCell: (selectedCell) => set({ selectedCell }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab })
}));

function user(content) {
  return { id: crypto.randomUUID(), role: 'user', kind: 'message', content };
}

function assistant(content, tone = 'normal') {
  return { id: crypto.randomUUID(), role: 'assistant', kind: 'message', tone, content };
}

function proposalMessage(proposal) {
  return { id: crypto.randomUUID(), role: 'assistant', kind: 'proposal', proposal };
}

function append(chat, message) {
  return [...chat, message].slice(-40);
}

function firstField(spec, type) {
  return spec.datasetProfile.fields.find((field) => field.type === type)?.name || null;
}

function fieldByHint(spec, hints) {
  return spec.datasetProfile.fields.find((field) => hints.some((hint) => field.name.toLowerCase().includes(hint)))?.name || null;
}
