export type Condition = 'color' | 'shape' | 'combined'

export type Stage =
  | 'consent'
  | 'demographics'
  | 'block_intro'
  | 'practice_transition'
  | 'trial'
  | 'post_block'
  | 'break'
  | 'complete'

export interface Demographics {
  ageBracket: '18-24' | '25-34' | '35-44' | '45-54' | '55+'
  computerUse: 'daily' | 'few_per_week' | 'weekly' | 'rarely'
  colorBlindness: 'no' | 'yes' | 'unsure'
  visionStatus: 'normal' | 'corrected_with_lenses'
}

export interface StimulusItem {
  id: string
  colorName: string
  colorHex: string
  shapeName: string
  shapeSymbol: string
}

export interface TrialPlan {
  id: string
  blockIndex: number
  blockOrder: number
  condition: Condition
  trialIndexInBlock: number
  isPractice: boolean
  targetType: 'color' | 'shape' | 'combined'
  targetColor: string
  targetShape: string
  promptText: string
  correctItemId: string
  items: StimulusItem[]
}

export interface BlockPlan {
  blockIndex: number
  blockOrder: number
  condition: Condition
  practiceTrials: number
  measuredTrials: number
  trials: TrialPlan[]
}

export interface TrialSummary {
  participant_id: string
  participant_number: number
  condition: Condition
  block_index: number
  block_order: number
  trial_index_in_block: number
  is_practice: boolean
  included_in_analysis: boolean
  target_type: 'color' | 'shape' | 'combined'
  target_color: string
  target_shape: string
  prompt_text: string
  correct_item_id: string
  clicked_item_id: string
  is_correct: boolean
  first_click_correct: boolean
  click_count_this_trial: number
  error_count_this_trial: number
  reaction_time_ms: number
  prompt_onset_iso: string
  response_time_iso: string
  assigned_order: string
}

export interface RawEvent {
  participant_id: string
  event_type:
    | 'session_started'
    | 'block_started'
    | 'trial_presented'
    | 'item_clicked'
    | 'trial_completed'
    | 'likert_submitted'
    | 'session_completed'
    | 'withdrawn'
  timestamp_iso: string
  block_index?: number
  condition?: Condition
  trial_id?: string
  trial_index_in_block?: number
  item_id?: string
  is_correct?: boolean
  payload?: Record<string, unknown>
}

export interface BlockLikert {
  participant_id: string
  participant_number: number
  block_index: number
  block_order: number
  condition: Condition
  clarity_1_to_5: 1 | 2 | 3 | 4 | 5
  ease_of_use_1_to_5: 1 | 2 | 3 | 4 | 5
  preference_1_to_5: 1 | 2 | 3 | 4 | 5
  timestamp_iso: string
  assigned_order: string
}

export interface SessionState {
  version: number
  participantId: string
  participantNumber: number
  studyOperator?: string
  assignedOrder: Condition[]
  stage: Stage
  consentGiven: boolean
  demographics?: Demographics
  blocks: BlockPlan[]
  currentBlockIndex: number
  currentTrialIndex: number
  trialSummaries: TrialSummary[]
  rawEvents: RawEvent[]
  blockLikerts: BlockLikert[]
  currentTrialErrors: number
  completedAtIso?: string
}

export interface ParticipantSummary {
  participant_id: string
  participant_number: number
  study_operator: string
  assigned_order: string
  age_bracket: string
  computer_use_frequency: string
  color_blindness: string
  vision_status: string
  total_trials_including_practice: number
  total_measured_trials: number
  total_errors_measured: number
  mean_reaction_time_ms_measured: number
  completed_at_iso: string
}
