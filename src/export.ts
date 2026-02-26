import { orderToLabel } from './experiment'
import type { BlockLikert, ParticipantSummary, SessionState, TrialSummary } from './types'

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
