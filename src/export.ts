import { orderToLabel } from './experiment'
import type { BlockLikert, ParticipantSummary, SessionState, TrialSummary } from './types'

export interface CodebookEntry {
  field: string
  description: string
  type: string
  example: string
}

export interface ExportCodebook {
  trial_csv: CodebookEntry[]
  likert_csv: CodebookEntry[]
  participant_summary_csv: CodebookEntry[]
  raw_events_json: CodebookEntry[]
}

function escapeCsvValue(value: unknown): string {
  const text = String(value ?? '')
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function toCsv<T extends object>(rows: T[]): string {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0] as Record<string, unknown>)
  const headerRow = headers.join(',')
  const body = rows.map((row) => {
    const record = row as Record<string, unknown>
    return headers.map((key) => escapeCsvValue(record[key])).join(',')
  })
  return [headerRow, ...body].join('\n')
}

export function buildParticipantSummary(session: SessionState): ParticipantSummary {
  const measured = session.trialSummaries.filter((trial) => trial.included_in_analysis)
  const totalErrorsMeasured = measured.reduce((sum, row) => sum + row.error_count_this_trial, 0)
  const meanReaction =
    measured.length > 0
      ? measured.reduce((sum, row) => sum + row.reaction_time_ms, 0) / measured.length
      : 0

  return {
    participant_id: session.participantId,
    participant_number: session.participantNumber,
    study_operator: session.studyOperator ?? '',
    assigned_order: orderToLabel(session.assignedOrder),
    age_bracket: session.demographics?.ageBracket ?? '',
    computer_use_frequency: session.demographics?.computerUse ?? '',
    color_blindness: session.demographics?.colorBlindness ?? '',
    vision_status: session.demographics?.visionStatus ?? '',
    total_trials_including_practice: session.trialSummaries.length,
    total_measured_trials: measured.length,
    total_errors_measured: totalErrorsMeasured,
    mean_reaction_time_ms_measured: Math.round(meanReaction),
    completed_at_iso: session.completedAtIso ?? '',
  }
}

export function toTrialRows(session: SessionState): TrialSummary[] {
  return [...session.trialSummaries]
}

export function toLikertRows(session: SessionState): BlockLikert[] {
  return [...session.blockLikerts]
}

export function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadBlobFile(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function buildExportCodebook(): ExportCodebook {
  return {
    trial_csv: [
      { field: 'participant_id', description: 'Anonymous participant identifier', type: 'string', example: 'P-674222' },
      { field: 'participant_number', description: 'Numeric participant ID used for order assignment', type: 'number', example: '674222' },
      { field: 'condition', description: 'Encoding condition for this block', type: 'enum(color|shape|combined)', example: 'combined' },
      { field: 'block_index', description: 'Zero-based block index', type: 'number', example: '0' },
      { field: 'block_order', description: 'One-based order of block presentation', type: 'number', example: '1' },
      { field: 'trial_index_in_block', description: 'One-based trial index within block', type: 'number', example: '7' },
      { field: 'is_practice', description: 'Whether trial is practice', type: 'boolean', example: 'false' },
      { field: 'included_in_analysis', description: 'Whether trial should be used for analysis', type: 'boolean', example: 'true' },
      { field: 'target_type', description: 'Prompt encoding type', type: 'enum(color|shape|combined)', example: 'combined' },
      { field: 'target_color', description: 'Target colour label for prompt', type: 'string', example: 'blue' },
      { field: 'target_shape', description: 'Target shape label for prompt', type: 'string', example: 'circle' },
      { field: 'prompt_text', description: 'Displayed text prompt', type: 'string', example: 'Select the blue circle' },
      { field: 'correct_item_id', description: 'ID of the correct clickable item', type: 'string', example: 'item_3' },
      { field: 'clicked_item_id', description: 'Final clicked item ID (correct click)', type: 'string', example: 'item_3' },
      { field: 'is_correct', description: 'Whether final click was correct (always true for completed trial row)', type: 'boolean', example: 'true' },
      { field: 'first_click_correct', description: 'Whether first click in trial was correct', type: 'boolean', example: 'false' },
      { field: 'click_count_this_trial', description: 'Total clicks made in trial until correct', type: 'number', example: '2' },
      { field: 'error_count_this_trial', description: 'Incorrect clicks before correct response', type: 'number', example: '1' },
      { field: 'reaction_time_ms', description: 'Elapsed ms from prompt onset to correct click', type: 'number', example: '1248' },
      { field: 'prompt_onset_iso', description: 'ISO timestamp when prompt became active', type: 'string(ISO-8601)', example: '2026-02-27T00:56:05.311Z' },
      { field: 'response_time_iso', description: 'ISO timestamp of correct click', type: 'string(ISO-8601)', example: '2026-02-27T00:56:06.559Z' },
      { field: 'assigned_order', description: 'Latin square condition order label', type: 'string', example: 'CAB' },
    ],
    likert_csv: [
      { field: 'participant_id', description: 'Anonymous participant identifier', type: 'string', example: 'P-674222' },
      { field: 'participant_number', description: 'Numeric participant ID', type: 'number', example: '674222' },
      { field: 'block_index', description: 'Zero-based block index', type: 'number', example: '0' },
      { field: 'block_order', description: 'One-based order of block presentation', type: 'number', example: '1' },
      { field: 'condition', description: 'Condition rated after block', type: 'enum(color|shape|combined)', example: 'combined' },
      { field: 'clarity_1_to_5', description: 'Subjective clarity score', type: 'integer(1..5)', example: '4' },
      { field: 'ease_of_use_1_to_5', description: 'Subjective ease-of-use score', type: 'integer(1..5)', example: '3' },
      { field: 'preference_1_to_5', description: 'Subjective preference score', type: 'integer(1..5)', example: '5' },
      { field: 'timestamp_iso', description: 'ISO timestamp of submission', type: 'string(ISO-8601)', example: '2026-02-27T00:57:03.774Z' },
      { field: 'assigned_order', description: 'Latin square condition order label', type: 'string', example: 'CAB' },
    ],
    participant_summary_csv: [
      { field: 'participant_id', description: 'Anonymous participant identifier', type: 'string', example: 'P-674222' },
      { field: 'participant_number', description: 'Numeric participant ID', type: 'number', example: '674222' },
      { field: 'study_operator', description: 'Name/label of person conducting the study session', type: 'string', example: 'Researcher-01' },
      { field: 'assigned_order', description: 'Latin square condition order label', type: 'string', example: 'CAB' },
      { field: 'age_bracket', description: 'Participant age bracket', type: 'string', example: '18-24' },
      { field: 'computer_use_frequency', description: 'Self-reported computer use frequency', type: 'string', example: 'daily' },
      { field: 'color_blindness', description: 'Self-reported colour blindness', type: 'string', example: 'no' },
      { field: 'vision_status', description: 'Vision status confirmation', type: 'string', example: 'normal' },
      { field: 'total_trials_including_practice', description: 'Count of completed trials including practice', type: 'number', example: '57' },
      { field: 'total_measured_trials', description: 'Count of measured trials only', type: 'number', example: '48' },
      { field: 'total_errors_measured', description: 'Total incorrect clicks in measured trials', type: 'number', example: '2' },
      { field: 'mean_reaction_time_ms_measured', description: 'Mean measured reaction time', type: 'number', example: '1649' },
      { field: 'completed_at_iso', description: 'ISO timestamp of study completion', type: 'string(ISO-8601)', example: '2026-02-27T00:58:01.435Z' },
    ],
    raw_events_json: [
      { field: 'event_type', description: 'Event category in session timeline', type: 'enum', example: 'trial_presented' },
      { field: 'timestamp_iso', description: 'Event timestamp in ISO format', type: 'string(ISO-8601)', example: '2026-02-27T00:56:05.311Z' },
      { field: 'payload', description: 'Event-specific metadata object', type: 'object', example: '{ "is_practice": false, "prompt_text": "Select the blue circle" }' },
    ],
  }
}

export function buildCodebookMarkdown(codebook: ExportCodebook): string {
  const renderSection = (title: string, rows: CodebookEntry[]) => {
    const header = `## ${title}\nfield,description,type,example`
    const lines = rows.map((row) => `${row.field},${row.description},${row.type},${row.example}`)
    return [header, ...lines].join('\n')
  }

  return [
    '# Export Codebook',
    'This codebook defines all exported datasets and fields for analysis.',
    renderSection('Trial CSV', codebook.trial_csv),
    renderSection('Likert CSV', codebook.likert_csv),
    renderSection('Participant Summary CSV', codebook.participant_summary_csv),
    renderSection('Raw Events JSON', codebook.raw_events_json),
  ].join('\n\n')
}
