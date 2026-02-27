import { useEffect, useMemo, useRef, useState } from 'react'
import {
  conditionInstructions,
  createParticipantNumber,
  generateBlockPlan,
  getLatinSquareOrder,
  orderToLabel,
  readableCondition,
} from './experiment'
import JSZip from 'jszip'
import {
  buildCodebookMarkdown,
  buildExportCodebook,
  buildParticipantSummary,
  downloadBlobFile,
  downloadTextFile,
  toCsv,
  toLikertRows,
  toTrialRows,
} from './export'
import { clearSession, loadSession, saveSession } from './storage'
import type { BlockPlan, BlockLikert, Condition, Demographics, SessionState } from './types'

const SESSION_VERSION = 1
const REQUIRED_WIDTH = 1920
const REQUIRED_HEIGHT = 1080

type StartMode = 'landing' | 'withdrawn'

function nowIso(): string {
  return new Date().toISOString()
}

function buildParticipantId(participantNumber: number): string {
  return `P-${participantNumber}`
}

function defaultDemographics(): Demographics {
  return {
    ageBracket: '18-24',
    computerUse: 'daily',
    colorBlindness: 'no',
    visionStatus: 'normal',
  }
}

function createSession(args?: {
  participantNumber?: number
  assignedOrder?: Condition[]
  studyOperator?: string
  stage?: SessionState['stage']
  demographics?: Demographics
  consentGiven?: boolean
}): SessionState {
  const participantNumber = args?.participantNumber ?? createParticipantNumber()
  const assignedOrder = args?.assignedOrder ?? getLatinSquareOrder(participantNumber)
  const blocks: BlockPlan[] = assignedOrder.map((condition, blockIndex) =>
    generateBlockPlan({
      participantNumber,
      blockIndex,
      blockOrder: blockIndex + 1,
      condition,
    }),
  )

  const session: SessionState = {
    version: SESSION_VERSION,
    participantId: buildParticipantId(participantNumber),
    participantNumber,
    studyOperator: args?.studyOperator,
    assignedOrder,
    stage: args?.stage ?? 'consent',
    consentGiven: args?.consentGiven ?? false,
    demographics: args?.demographics,
    blocks,
    currentBlockIndex: 0,
    currentTrialIndex: 0,
    trialSummaries: [],
    rawEvents: [
      {
        participant_id: buildParticipantId(participantNumber),
        event_type: 'session_started',
        timestamp_iso: nowIso(),
        payload: {
          assigned_order: orderToLabel(assignedOrder),
          study_operator: args?.studyOperator ?? '',
          screen_width_px: window.innerWidth,
          screen_height_px: window.innerHeight,
          experiment_design: 'single-factor, three-level within-subjects repeated-measures controlled visual search paradigm',
        },
      },
    ],
    blockLikerts: [],
    currentTrialErrors: 0,
  }

  return session
}

export function App() {
  const [mode, setMode] = useState<StartMode>('landing')
  const [session, setSession] = useState<SessionState | undefined>()
  const [resumeCandidate, setResumeCandidate] = useState<SessionState | undefined>()
  const [studyOperatorInput, setStudyOperatorInput] = useState('')
  const [consentChecked, setConsentChecked] = useState(false)
  const [visionConfirmed, setVisionConfirmed] = useState(false)
  const [demographicsForm, setDemographicsForm] = useState<Demographics>(defaultDemographics())
  const [likert, setLikert] = useState<{ clarity: 1 | 2 | 3 | 4 | 5; ease: 1 | 2 | 3 | 4 | 5; preference: 1 | 2 | 3 | 4 | 5 }>({
    clarity: 3,
    ease: 3,
    preference: 3,
  })
  const [trialReady, setTrialReady] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [devCondition, setDevCondition] = useState<Condition>('color')
  const [showStudyMeta, setShowStudyMeta] = useState(false)
  const [environmentMessage, setEnvironmentMessage] = useState('')
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement))

  const promptStartPerfRef = useRef<number | null>(null)
  const promptStartIsoRef = useRef<string>('')
  const clickLockRef = useRef(false)

  const devEnabled = useMemo(() => new URLSearchParams(window.location.search).get('dev') === '1', [])

  useEffect(() => {
    const loaded = loadSession()
    if (loaded && loaded.stage !== 'complete') {
      setResumeCandidate(loaded)
    }
  }, [])

  useEffect(() => {
    if (session) {
      saveSession(session)
    }
  }, [session])

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))

    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  const currentBlock = session ? session.blocks[session.currentBlockIndex] : undefined
  const currentTrial = currentBlock ? currentBlock.trials[session!.currentTrialIndex] : undefined
  const isRecommendedDisplay = isFullscreen && viewport.width >= REQUIRED_WIDTH && viewport.height >= REQUIRED_HEIGHT

  useEffect(() => {
    if (!session || session.stage !== 'trial' || !currentTrial || !currentBlock) {
      return
    }

    setFeedback('')
    setTrialReady(false)
    clickLockRef.current = false

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        promptStartPerfRef.current = performance.now()
        promptStartIsoRef.current = nowIso()
        setTrialReady(true)

        setSession((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            rawEvents: [
              ...prev.rawEvents,
              {
                participant_id: prev.participantId,
                event_type: 'trial_presented',
                timestamp_iso: promptStartIsoRef.current,
                block_index: currentBlock.blockIndex,
                condition: currentBlock.condition,
                trial_id: currentTrial.id,
                trial_index_in_block: currentTrial.trialIndexInBlock,
                payload: {
                  is_practice: currentTrial.isPractice,
                  prompt_text: currentTrial.promptText,
                },
              },
            ],
          }
        })
      })
      void raf2
    })

    return () => {
      cancelAnimationFrame(raf1)
    }
  }, [session?.stage, session?.currentBlockIndex, session?.currentTrialIndex, currentTrial?.id, currentBlock?.condition])

  const measuredInCurrentBlock = currentBlock?.trials.filter((trial) => !trial.isPractice).length ?? 0
  const measuredCompletedInCurrentBlock = session
    ? session.trialSummaries.filter((row) => row.block_index === session.currentBlockIndex && row.included_in_analysis).length
    : 0

  const appendRawEvent = (event: SessionState['rawEvents'][number]) => {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        rawEvents: [...prev.rawEvents, event],
      }
    })
  }

  const handleWithdraw = () => {
    appendRawEvent({
      participant_id: session?.participantId ?? 'unknown',
      event_type: 'withdrawn',
      timestamp_iso: nowIso(),
    })
    clearSession()
    setSession(undefined)
    setMode('withdrawn')
  }

  const startDevMode = () => {
    const participantNumber = createParticipantNumber()
    const defaultOrder = getLatinSquareOrder(participantNumber)
    const rest = defaultOrder.filter((condition) => condition !== devCondition)
    const assignedOrder: Condition[] = [devCondition, ...rest]
    const devSession = createSession({
      participantNumber,
      assignedOrder,
      studyOperator: studyOperatorInput.trim() || undefined,
      stage: 'block_intro',
      demographics: defaultDemographics(),
      consentGiven: true,
    })
    setSession(devSession)
    setMode('landing')
  }

  const startFromConsent = () => {
    setSession(createSession({ studyOperator: studyOperatorInput.trim() || undefined }))
    setMode('landing')
  }

  const submitConsent = () => {
    if (!consentChecked || !visionConfirmed) return
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        consentGiven: true,
        stage: 'demographics',
      }
    })
  }

  const submitDemographics = () => {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        demographics: demographicsForm,
        stage: 'block_intro',
      }
    })
  }

  const startBlock = () => {
    if (!session || !currentBlock) return
    setEnvironmentMessage('')

    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        stage: 'trial',
        currentTrialIndex: 0,
        currentTrialErrors: 0,
        rawEvents: [
          ...prev.rawEvents,
          {
            participant_id: prev.participantId,
            event_type: 'block_started',
            timestamp_iso: nowIso(),
            block_index: currentBlock.blockIndex,
            condition: currentBlock.condition,
          },
        ],
      }
    })
  }

  const handleItemClick = (itemId: string) => {
    if (!session || !currentTrial || !currentBlock || !trialReady || clickLockRef.current) return

    const isCorrect = itemId === currentTrial.correctItemId
    const timestampIso = nowIso()

    appendRawEvent({
      participant_id: session.participantId,
      event_type: 'item_clicked',
      timestamp_iso: timestampIso,
      block_index: currentBlock.blockIndex,
      condition: currentBlock.condition,
      trial_id: currentTrial.id,
      trial_index_in_block: currentTrial.trialIndexInBlock,
      item_id: itemId,
      is_correct: isCorrect,
    })

    if (!isCorrect) {
      setFeedback('Incorrect selection logged. Please try again.')
      setSession((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          currentTrialErrors: prev.currentTrialErrors + 1,
        }
      })
      return
    }

    clickLockRef.current = true
    setFeedback('Correct')

    const reactionTimeMs = Math.max(
      0,
      Math.round((performance.now() - (promptStartPerfRef.current ?? performance.now()))),
    )

    setSession((prev) => {
      if (!prev) return prev
      const assignedOrder = orderToLabel(prev.assignedOrder)

      const summary = {
        participant_id: prev.participantId,
        participant_number: prev.participantNumber,
        condition: currentBlock.condition,
        block_index: currentBlock.blockIndex,
        block_order: currentBlock.blockOrder,
        trial_index_in_block: currentTrial.trialIndexInBlock,
        is_practice: currentTrial.isPractice,
        included_in_analysis: !currentTrial.isPractice,
        target_type: currentTrial.targetType,
        target_color: currentTrial.targetColor,
        target_shape: currentTrial.targetShape,
        prompt_text: currentTrial.promptText,
        correct_item_id: currentTrial.correctItemId,
        clicked_item_id: itemId,
        is_correct: true,
        first_click_correct: prev.currentTrialErrors === 0,
        click_count_this_trial: prev.currentTrialErrors + 1,
        error_count_this_trial: prev.currentTrialErrors,
        reaction_time_ms: reactionTimeMs,
        prompt_onset_iso: promptStartIsoRef.current,
        response_time_iso: timestampIso,
        assigned_order: assignedOrder,
      } as const

      const nextTrialIndex = prev.currentTrialIndex + 1
      const isEndOfBlock = nextTrialIndex >= currentBlock.trials.length
      const nextTrial = isEndOfBlock ? undefined : currentBlock.trials[nextTrialIndex]
      const reachedMeasuredStart = Boolean(currentTrial.isPractice && nextTrial && !nextTrial.isPractice)

      return {
        ...prev,
        trialSummaries: [...prev.trialSummaries, summary],
        currentTrialErrors: 0,
        currentTrialIndex: isEndOfBlock ? prev.currentTrialIndex : nextTrialIndex,
        stage: isEndOfBlock ? 'post_block' : reachedMeasuredStart ? 'practice_transition' : 'trial',
        rawEvents: [
          ...prev.rawEvents,
          {
            participant_id: prev.participantId,
            event_type: 'trial_completed',
            timestamp_iso: timestampIso,
            block_index: currentBlock.blockIndex,
            condition: currentBlock.condition,
            trial_id: currentTrial.id,
            trial_index_in_block: currentTrial.trialIndexInBlock,
            is_correct: true,
            payload: {
              reaction_time_ms: reactionTimeMs,
              error_count_this_trial: prev.currentTrialErrors,
              is_practice: currentTrial.isPractice,
            },
          },
        ],
      }
    })
  }

  const submitLikert = () => {
    if (!session || !currentBlock) return
    const rating: BlockLikert = {
      participant_id: session.participantId,
      participant_number: session.participantNumber,
      block_index: currentBlock.blockIndex,
      block_order: currentBlock.blockOrder,
      condition: currentBlock.condition,
      clarity_1_to_5: likert.clarity,
      ease_of_use_1_to_5: likert.ease,
      preference_1_to_5: likert.preference,
      timestamp_iso: nowIso(),
      assigned_order: orderToLabel(session.assignedOrder),
    }

    setSession((prev) => {
      if (!prev) return prev
      const lastBlock = prev.currentBlockIndex >= prev.blocks.length - 1

      return {
        ...prev,
        blockLikerts: [...prev.blockLikerts, rating],
        currentBlockIndex: lastBlock ? prev.currentBlockIndex : prev.currentBlockIndex + 1,
        currentTrialIndex: 0,
        stage: lastBlock ? 'complete' : 'break',
        completedAtIso: lastBlock ? nowIso() : prev.completedAtIso,
        rawEvents: [
          ...prev.rawEvents,
          {
            participant_id: prev.participantId,
            event_type: 'likert_submitted',
            timestamp_iso: rating.timestamp_iso,
            block_index: currentBlock.blockIndex,
            condition: currentBlock.condition,
            payload: {
              clarity: rating.clarity_1_to_5,
              ease_of_use: rating.ease_of_use_1_to_5,
              preference: rating.preference_1_to_5,
            },
          },
          ...(lastBlock
            ? [
                {
                  participant_id: prev.participantId,
                  event_type: 'session_completed' as const,
                  timestamp_iso: nowIso(),
                },
              ]
            : []),
        ],
      }
    })

    setLikert({ clarity: 3, ease: 3, preference: 3 })
  }

  const continueNextBlock = () => {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        stage: 'block_intro',
      }
    })
  }

  const continueToMeasuredTrials = () => {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        stage: 'trial',
      }
    })
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
      setEnvironmentMessage('')
    } catch {
      setEnvironmentMessage('Could not change fullscreen mode. Please use browser fullscreen controls and try again.')
    }
  }

  const fullscreenControl = (
    <button className="fullscreen-toggle secondary" onClick={toggleFullscreen}>
      {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    </button>
  )

  const exportTrialCsv = () => {
    if (!session) return
    const csv = toCsv(toTrialRows(session))
    downloadTextFile(`${session.participantId}_trials.csv`, csv, 'text/csv;charset=utf-8')
  }

  const exportLikertCsv = () => {
    if (!session) return
    const csv = toCsv(toLikertRows(session))
    downloadTextFile(`${session.participantId}_likert.csv`, csv, 'text/csv;charset=utf-8')
  }

  const exportParticipantCsv = () => {
    if (!session) return
    const csv = toCsv([buildParticipantSummary(session)])
    downloadTextFile(`${session.participantId}_participant_summary.csv`, csv, 'text/csv;charset=utf-8')
  }

  const exportRawJson = () => {
    if (!session) return
    downloadTextFile(
      `${session.participantId}_raw_events.json`,
      JSON.stringify(
        {
          participant_id: session.participantId,
          study_operator: session.studyOperator ?? '',
          assigned_order: orderToLabel(session.assignedOrder),
          raw_events: session.rawEvents,
          trial_summaries: session.trialSummaries,
          likert_rows: session.blockLikerts,
        },
        null,
        2,
      ),
      'application/json;charset=utf-8',
    )
  }

  const exportCodebook = () => {
    const codebook = buildExportCodebook()
    downloadTextFile('study_export_codebook.json', JSON.stringify(codebook, null, 2), 'application/json;charset=utf-8')
    downloadTextFile('study_export_codebook.md', buildCodebookMarkdown(codebook), 'text/markdown;charset=utf-8')
  }

  const exportAllAsZip = async () => {
    if (!session) return

    const zip = new JSZip()
    const participantId = session.participantId
    zip.file(`${participantId}_trials.csv`, toCsv(toTrialRows(session)))
    zip.file(`${participantId}_likert.csv`, toCsv(toLikertRows(session)))
    zip.file(`${participantId}_participant_summary.csv`, toCsv([buildParticipantSummary(session)]))
    zip.file(
      `${participantId}_raw_events.json`,
      JSON.stringify(
        {
          participant_id: session.participantId,
          study_operator: session.studyOperator ?? '',
          assigned_order: orderToLabel(session.assignedOrder),
          raw_events: session.rawEvents,
          trial_summaries: session.trialSummaries,
          likert_rows: session.blockLikerts,
        },
        null,
        2,
      ),
    )
    const codebook = buildExportCodebook()
    zip.file('study_export_codebook.json', JSON.stringify(codebook, null, 2))
    zip.file('study_export_codebook.md', buildCodebookMarkdown(codebook))

    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlobFile(`${participantId}_all_exports.zip`, blob)
  }

  if (!session) {
    return (
      <main className="app-shell">
        {fullscreenControl}
        <section className="panel">
          <h1>EECS 4441 HCI Visual Encoding Study</h1>
          <p>This study compares colour-coded, shape-coded, and combined encodings in a visual search task.</p>
          <ul>
            <li>No identifying information is collected.</li>
            <li>You may withdraw at any time without penalty.</li>
            <li>Total duration: about 8-10 minutes.</li>
          </ul>

          <label>
            Study operator (optional)
            <input
              type="text"
              value={studyOperatorInput}
              onChange={(event) => setStudyOperatorInput(event.target.value)}
              placeholder="e.g., Researcher-01"
              aria-label="Study operator name"
            />
          </label>

          {mode === 'withdrawn' && <p className="warning">You withdrew from the session. You can close this page now.</p>}

          {resumeCandidate ? (
            <div className="row-actions">
              <button onClick={() => setSession(resumeCandidate)}>Resume saved session</button>
              <button
                className="secondary"
                onClick={() => {
                  clearSession()
                  setResumeCandidate(undefined)
                  startFromConsent()
                }}
              >
                Start new session
              </button>
            </div>
          ) : (
            <div className="row-actions">
              <button onClick={startFromConsent}>Start study</button>
            </div>
          )}

          {devEnabled && (
            <div className="dev-box">
              <h2>Developer Mode</h2>
              <label>
                Preview condition
                <select
                  value={devCondition}
                  onChange={(event) => setDevCondition(event.target.value as Condition)}
                  aria-label="Developer condition selector"
                >
                  <option value="color">A: Colour</option>
                  <option value="shape">B: Shape</option>
                  <option value="combined">C: Combined</option>
                </select>
              </label>
              <button className="secondary" onClick={startDevMode}>
                Quick start in selected condition
              </button>
            </div>
          )}
        </section>
      </main>
    )
  }

  if (session.stage === 'consent') {
    return (
      <main className="app-shell">
        {fullscreenControl}
        <section className="panel">
          <h1>Consent Form</h1>
          <p>
            Participation is voluntary. This is a minimal-risk interface study. You may withdraw at any time without
            providing a reason.
          </p>
          <p>
            Data collected: anonymized participant ID, block order, click responses, reaction times, and brief
            demographics.
          </p>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              aria-label="Consent agreement checkbox"
            />
            I consent to participate in this study.
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={visionConfirmed}
              onChange={(event) => setVisionConfirmed(event.target.checked)}
              aria-label="Vision eligibility confirmation checkbox"
            />
            I confirm that I have normal or corrected-to-normal vision and, if applicable, I am wearing my corrective lenses during this study.
          </label>

          <div className="row-actions">
            <button onClick={submitConsent} disabled={!consentChecked || !visionConfirmed}>
              Continue
            </button>
            <button className="danger" onClick={handleWithdraw}>
              Withdraw
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (session.stage === 'demographics') {
    return (
      <main className="app-shell">
        {fullscreenControl}
        <section className="panel">
          <h1>Demographics</h1>
          <p>Please answer the following non-identifying questions.</p>

          <label>
            Vision status
            <select
              value={demographicsForm.visionStatus}
              onChange={(event) => setDemographicsForm((prev) => ({ ...prev, visionStatus: event.target.value as Demographics['visionStatus'] }))}
            >
              <option value="normal">Normal vision (no correction needed)</option>
              <option value="corrected_with_lenses">Corrected-to-normal (wearing corrective lenses)</option>
            </select>
          </label>

          <label>
            Age bracket
            <select
              value={demographicsForm.ageBracket}
              onChange={(event) => setDemographicsForm((prev) => ({ ...prev, ageBracket: event.target.value as Demographics['ageBracket'] }))}
            >
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-54">45-54</option>
              <option value="55+">55+</option>
            </select>
          </label>

          <label>
            Frequency of computer use
            <select
              value={demographicsForm.computerUse}
              onChange={(event) => setDemographicsForm((prev) => ({ ...prev, computerUse: event.target.value as Demographics['computerUse'] }))}
            >
              <option value="daily">Daily</option>
              <option value="few_per_week">A few times/week</option>
              <option value="weekly">Weekly</option>
              <option value="rarely">Rarely</option>
            </select>
          </label>

          <label>
            Self-reported colour blindness
            <select
              value={demographicsForm.colorBlindness}
              onChange={(event) => setDemographicsForm((prev) => ({ ...prev, colorBlindness: event.target.value as Demographics['colorBlindness'] }))}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
              <option value="unsure">Unsure</option>
            </select>
          </label>

          <div className="row-actions">
            <button onClick={submitDemographics}>Continue to study</button>
            <button className="danger" onClick={handleWithdraw}>
              Withdraw
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (session.stage === 'block_intro' && currentBlock) {
    return (
      <main className="app-shell">
        {fullscreenControl}
        <section className="panel">
          <h1>
            Block {session.currentBlockIndex + 1} of {session.blocks.length}: {readableCondition(currentBlock.condition)}
          </h1>
          <p>{conditionInstructions(currentBlock.condition)}</p>
          <ul>
            <li>Practice trials: {currentBlock.practiceTrials} (excluded from analysis)</li>
            <li>Measured trials: {currentBlock.measuredTrials}</li>
            <li>Click the matching item as quickly and accurately as possible.</li>
          </ul>

          {!isRecommendedDisplay && (
            <p className="warning">
              Recommended setup for consistency: fullscreen and at least {REQUIRED_WIDTH}x{REQUIRED_HEIGHT}. Current: {viewport.width}x{viewport.height}
            </p>
          )}
          {environmentMessage && <p className="warning">{environmentMessage}</p>}

          <div className="row-actions">
            <button className="secondary" onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            </button>
            <button onClick={startBlock}>Start block</button>
            <button className="danger" onClick={handleWithdraw}>
              Withdraw
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (session.stage === 'practice_transition' && currentBlock) {
    return (
      <main className="app-shell">
        {fullscreenControl}
        <section className="panel">
          <h1>Practice Complete</h1>
          <p>You have completed practice for this block.</p>
          <p>The next trials are measured and will be included in analysis.</p>

          <div className="row-actions">
            <button onClick={continueToMeasuredTrials}>Start measured trials</button>
          </div>
        </section>
      </main>
    )
  }

  if (session.stage === 'trial' && currentBlock && currentTrial) {
    return (
      <main className="app-shell full">
        {fullscreenControl}
        <section className="top-bar">
          <div>Block {session.currentBlockIndex + 1} of {session.blocks.length}</div>
          <div>
            Measured progress: {measuredCompletedInCurrentBlock}/{measuredInCurrentBlock}
          </div>
        </section>

        <div className="meta-toggle-row">
          <button className="meta-toggle" onClick={() => setShowStudyMeta((prev) => !prev)}>
            {showStudyMeta ? 'Hide study info' : 'Show study info'}
          </button>
        </div>
        {showStudyMeta && (
          <aside className="meta-drawer" aria-label="Study metadata panel">
            <h3>Study Info</h3>
            <p>Participant: {session.participantId}</p>
            <p>Assigned order: {orderToLabel(session.assignedOrder)}</p>
            <p>Condition order: {session.assignedOrder.map((condition) => readableCondition(condition)).join(' → ')}</p>
            <p>Block index: {session.currentBlockIndex + 1}</p>
          </aside>
        )}

        <section className="trial-panel study-frame">
          <h2>{currentTrial.isPractice ? 'Practice Trial' : 'Measured Trial'}</h2>
          <p className="prompt" aria-live="polite">
            {currentTrial.promptText}
          </p>
          <p className="small-note">Timer starts when this prompt and grid are visible.</p>
          {!isRecommendedDisplay && (
            <p className="warning">
              Recommended setup for consistency: fullscreen and at least {REQUIRED_WIDTH}x{REQUIRED_HEIGHT}. Current: {viewport.width}x{viewport.height}
            </p>
          )}

          <div className="grid" role="group" aria-label="Stimulus grid with 8 selectable items">
            {currentTrial.items.map((item) => {
              const isColorBlock = currentBlock.condition === 'color'
              const isShapeBlock = currentBlock.condition === 'shape'
              const bg = '#ffffff'
              const symbolColor = isShapeBlock ? '#111827' : item.colorHex
              const borderColor = '#6b7280'
              const symbol = isColorBlock ? '●' : item.shapeSymbol

              return (
                <button
                  key={item.id}
                  className="stimulus-item"
                  aria-label={`Item ${item.id}: ${item.colorName} ${item.shapeName}`}
                  style={{ backgroundColor: bg, borderColor }}
                  onClick={() => handleItemClick(item.id)}
                  disabled={!trialReady}
                >
                  <span className="symbol" aria-hidden="true" style={{ color: symbolColor }}>
                    {symbol}
                  </span>
                </button>
              )
            })}
          </div>

          <p className={feedback.startsWith('Incorrect') ? 'warning' : 'success'} aria-live="assertive">
            {feedback}
          </p>

          <div className="row-actions">
            <button className="danger" onClick={handleWithdraw}>
              Withdraw
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (session.stage === 'post_block' && currentBlock) {
    return (
      <main className="app-shell">
        {fullscreenControl}
        <section className="panel">
          <h1>Post-block Ratings</h1>
          <p>
            Rate this condition: <strong>{readableCondition(currentBlock.condition)}</strong>
          </p>

          <fieldset>
            <legend>Clarity (1 = very low, 5 = very high)</legend>
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={`clarity-${value}`} className="radio-row">
                <input
                  type="radio"
                  name="clarity"
                  checked={likert.clarity === value}
                  onChange={() => setLikert((prev) => ({ ...prev, clarity: value as 1 | 2 | 3 | 4 | 5 }))}
                />
                {value}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Ease of use (1 = very low, 5 = very high)</legend>
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={`ease-${value}`} className="radio-row">
                <input
                  type="radio"
                  name="ease"
                  checked={likert.ease === value}
                  onChange={() => setLikert((prev) => ({ ...prev, ease: value as 1 | 2 | 3 | 4 | 5 }))}
                />
                {value}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Preference (1 = very low, 5 = very high)</legend>
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={`pref-${value}`} className="radio-row">
                <input
                  type="radio"
                  name="preference"
                  checked={likert.preference === value}
                  onChange={() => setLikert((prev) => ({ ...prev, preference: value as 1 | 2 | 3 | 4 | 5 }))}
                />
                {value}
              </label>
            ))}
          </fieldset>

          <div className="row-actions">
            <button onClick={submitLikert}>Submit ratings</button>
          </div>
        </section>
      </main>
    )
  }

  if (session.stage === 'break') {
    return (
      <main className="app-shell">
        {fullscreenControl}
        <section className="panel">
          <h1>Short Break</h1>
          <p>Take a brief pause. Continue when ready for the next condition.</p>
          <div className="row-actions">
            <button onClick={continueNextBlock}>Continue</button>
          </div>
        </section>
      </main>
    )
  }

  const participantSummary = buildParticipantSummary(session)

  return (
    <main className="app-shell">
      {fullscreenControl}
      <section className="panel">
        <h1>Study Complete</h1>
        <p>Thank you for participating. Please download your data files now.</p>

        <div className="row-actions wrap">
          <button className="secondary" onClick={exportAllAsZip}>Download all exports (ZIP)</button>
          <button onClick={exportTrialCsv}>Download trial CSV</button>
          <button onClick={exportLikertCsv}>Download Likert CSV</button>
          <button onClick={exportParticipantCsv}>Download participant summary CSV</button>
          <button onClick={exportRawJson}>Download raw JSON log</button>
          <button onClick={exportCodebook}>Download codebook (JSON + MD)</button>
        </div>

        <div className="summary-box">
          <h2>Participant Summary</h2>
          <ul>
            <li>Participant: {participantSummary.participant_id}</li>
            <li>Assigned order: {participantSummary.assigned_order}</li>
            <li>Measured trials: {participantSummary.total_measured_trials}</li>
            <li>Total measured errors: {participantSummary.total_errors_measured}</li>
            <li>Mean measured reaction time: {participantSummary.mean_reaction_time_ms_measured} ms</li>
          </ul>
        </div>

        <div className="row-actions">
          <button
            className="secondary"
            onClick={() => {
              clearSession()
              setSession(undefined)
              setResumeCandidate(undefined)
            }}
          >
            End and clear local session
          </button>
        </div>
      </section>
    </main>
  )
}
