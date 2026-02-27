# EECS 4441 HCI Study App (React + TypeScript)

This app runs the full user study from the proposal:
- A: colour-only (all circles)
- B: shape-only (all black shapes)
- C: combined colour+shape

## Run
```bash
npm install
npm run dev
```

Build and tests:
```bash
npm run build
npm run test
```

## Study flow enforced
1. Consent (must check box)
2. Demographics
3. Three counterbalanced condition blocks
   - Block intro
  - 3 practice trials (excluded)
  - 10 measured trials
4. Post-block 5-point Likert ratings
5. Completion and export

Participants can withdraw at any time.

## Counterbalancing
Latin square (3 conditions):
- `ABC`
- `BCA`
- `CAB`

Assignment: `participant_number % 3`.
Saved/exported as `assigned_order`.

This is a single-factor, three-level within-subjects (repeated measures) controlled visual search design.

## Stimuli/task mapping accuracy
- Colour-only: all items are circles, colours vary, prompt is `Select the <colour> circle`.
- Shape-only: all items are black, shapes vary, prompt is `Select the <shape>`.
- Combined: both colour and shape vary, prompt is `Select the <colour> <shape>`.
- For every trial, the prompted target is guaranteed to exist exactly as a clickable item.
- Measured trials use near-even balancing:
  - with 10 measured trials and 8 feature categories, balancing is near-even (difference at most 1)
  - colour-only block: colour targets near-even
  - shape-only block: shape targets near-even
  - combined block: colour and shape marginals near-even
  - the extra (repeated) categories in 10-of-8 balancing are randomized per block (seeded), avoiding fixed-category bias

## Timing and error logic
- Timed interval = prompt/grid onset (post-render) to correct click.
- Incorrect click:
  - logged in raw events,
  - increments `error_count_this_trial`,
  - shows feedback,
  - trial continues until correct click.
- Double-completion prevention: click lock after correct response.

## Export files
At completion, app exports:
1. `*_trials.csv` (one row per trial)
2. `*_likert.csv` (one row per block)
3. `*_participant_summary.csv` (one row per participant)
4. `*_raw_events.json` (full raw event log)

## Analysis-ready schema
### Trial CSV
One row per trial with these key columns:
- `participant_id`, `participant_number`
- `condition`, `block_index`, `block_order`, `trial_index_in_block`
- `is_practice`, `included_in_analysis`
- `target_type`, `target_color`, `target_shape`, `prompt_text`
- `correct_item_id`, `clicked_item_id`, `is_correct`
- `first_click_correct`, `click_count_this_trial`, `error_count_this_trial`
- `reaction_time_ms`, `prompt_onset_iso`, `response_time_iso`
- `assigned_order`

### Likert CSV
- `participant_id`, `participant_number`
- `block_index`, `block_order`, `condition`
- `clarity_1_to_5`, `ease_of_use_1_to_5`, `preference_1_to_5`
- `timestamp_iso`, `assigned_order`

### Participant summary CSV
- `participant_id`, `participant_number`, `assigned_order`
- `age_bracket`, `computer_use_frequency`, `color_blindness`
- `vision_status`
- `total_trials_including_practice`, `total_measured_trials`
- `total_errors_measured`, `mean_reaction_time_ms_measured`
- `completed_at_iso`

## Vision eligibility requirement
Participants must confirm before proceeding:
- normal vision, or
- corrected-to-normal vision while wearing corrective lenses during the study.

## Autosave/resume
Session auto-saves in local storage and can resume after refresh/reload.

## Dev/admin mode
Use `?dev=1` in URL to enable quick condition preview mode.

## Display and accessibility
- Fullscreen + minimum 1920x1080 strongly recommended for consistency (not hard-blocked).
- Trial layout is tuned to fit fully on a 1920x1080 screen with no scrolling.
- Larger prompt and stimulus sizes for visibility.
- ARIA labels on clickable items.
- Combined condition avoids colour-only encoding.

## Proposal alignment notes
- Independent variable: Visual Encoding Condition with 3 levels (colour-only, shape-only, combined colour+shape).
- Dependent variables: reaction time (ms), error count, post-condition Likert ratings (clarity, ease, preference).
- Counterbalancing: standard 3-condition Latin square orders (ABC, BCA, CAB) assigned by participant number mod 3.
- Task: visual search in 8-item grid; prompt onset to correct click timing; incorrect click logged + feedback then continue.
- Practice trials are excluded from analysis via `included_in_analysis=false`.

## Verification tests
Automated unit tests cover:
- Latin square assignment/distribution
- trial count and practice/measured split
- balancing constraints
- prompt-target existence in all conditions

Manual checks:
- consent gate works
- withdraw works at every stage
- incorrect clicks are logged and feedback shown
- measured trials only included in analysis
- exports open correctly in R/Python/SPSS workflows
