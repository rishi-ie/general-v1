# Sub-Agent Context — State Machines

## Meta State Lifecycle

```
[Empty] → session_start → [Loaded] → runtime updates → [Updated] → session_shutdown → [Persisted]

States:
  EMPTY         — No meta state file exists
  LOADED        — Meta state loaded from disk
  UPDATED       — Runtime updates pending persist
  PERSISTED     — State written to disk

Transitions:
  EMPTY → LOADED     : Load meta-state.json (or create default)
  LOADED → UPDATED   : Any update (decision, goal, project, etc.)
  UPDATED → PERSISTED: Debounced write (500ms) or session_shutdown
  PERSISTED → LOADED : Next session_start
```

## Decision Ledger Lifecycle

```
[Append] → [Indexed] → [Retrievable] → [Linked to Epoch]

States:
  DRAFT         — Decision captured, not yet finalized
  FINALIZED     — Reasoning and evidence complete
  LINKED        — Associated with an epoch

Transitions:
  DRAFT → FINALIZED : Extract reasoning, evidence, confidence
  FINALIZED → LINKED : Associate with epoch after compaction
```

## Lineage Engine Lifecycle

```
[No Epochs] → [Epoch 1] → [Epoch 2] → [Epoch 3] → ...

States:
  IDLE              — No compaction in progress
  CAPTURING         — session_before_compact: capturing state
  CREATING_EPOCH    — Generating epoch from captured state
  LINKING           — session_compact: linking to Pi's entry
  PERSISTED         — Epoch written to disk

Transitions:
  IDLE → CAPTURING        : session_before_compact fires
  CAPTURING → CREATING_EPOCH : Capture complete
  CREATING_EPOCH → LINKING   : Epoch object created
  LINKING → PERSISTED       : session_compact fires, epoch persisted
  PERSISTED → IDLE          : Epoch fully stored
```

## Retrieval Pipeline States

```
[Question] → [DETECTING] → [RETRIEVING] → [RECONSTRUCTING] → [SYNTHESIZING] → [DONE]

States:
  DETECTING       — Memory Question Router evaluating
  RETRIEVING      — Querying all stores in parallel
  RECONSTRUCTING  — Assembling retrieved data
  SYNTHESIZING    — Invoking Meta Memory Sub-Agent
  DONE            — Response ready to return to Pi

Transitions:
  Question → DETECTING     : User input received
  DETECTING → RETRIEVING  : Memory intent confirmed
  DETECTING → SKIPPED     : Not a memory question (pass through)
  RETRIEVING → RECONSTRUCTING : All queries complete
  RECONSTRUCTING → SYNTHESIZING : Context assembled
  SYNTHESIZING → DONE       : Sub-agent response received
  DONE → (end)              : Return to Pi
```

## Event Observer States

```
[Raw Event] → [CLASSIFYING] → [PROCESSING] → [STORING] → [done]

States:
  CLASSIFYING   — Determining event type
  PROCESSING    — Extracting entities, tags, content
  STORING       — Updating relevant stores

Transitions:
  Raw → CLASSIFYING  : Pi event received
  CLASSIFYING → PROCESSING : Event type determined
  PROCESSING → STORING     : Extraction complete
  STORING → done            : All stores updated
```

## Memory Question Router

```
[Input] → [PATTERN_MATCH] → [CONFIRMED] or [NOT_MEMORY]

Pattern Match:
  Input text matched against configured patterns:
  - "why did we decide*"
  - "what happened*"
  - "what were we working on*"
  - "what changed*"
  - "what are our active goals*"
  - "who is*"
  - "when did we*"
  - "what is the history of*"

States:
  EVALUATING   — Running pattern match
  CONFIRMED    — Memory question detected
  NOT_MEMORY   — Regular user input
```

## Compaction Hook States

```
session_before_compact
    ↓
[CAPTURED] → [EPOCH_CREATED] → [return { cancel: false }]
    ↓
session_compact
    ↓
[LINKED] → [PERSISTED]
```

## Cognitive Snapshot Generation

```
[Meta State] → [LOAD_PROJECTS] → [LOAD_GOALS] → [LOAD_DECISIONS] → [FORMAT]

States:
  LOADING        — Loading from meta state
  FILTERING      — Filtering active projects, recent decisions
  FORMATTING     — Converting to human-readable text
  READY          — Snapshot string ready for injection
```
