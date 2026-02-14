import { useEffect, useMemo, useState } from 'react'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import {
  CgAddR,
  CgChevronDown,
  CgChevronUp,
  CgLogOut,
  CgPen,
  CgTrash,
} from 'react-icons/cg'
import { FaMedal } from 'react-icons/fa'
import './App.css'
import { auth, isFirebaseConfigured } from './firebase'
import { EXERCISE_CATALOG, EXERCISE_PRESETS } from './data/exercises'
import {
  formatDateTime,
  formatMonthLabel,
  getCalendarGrid,
  nowIso,
  toDayKey,
} from './lib/date'
import {
  deleteWorkoutSession,
  startWorkoutSession,
  subscribeSessions,
  updateWorkoutSession,
} from './services/sessions'

const GOOGLE_PROVIDER = new GoogleAuthProvider()

function cloneExercises(exercises = []) {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: (exercise.sets || []).map((setEntry) => ({ ...setEntry })),
  }))
}

function findExerciseId(name) {
  const exact = EXERCISE_CATALOG.find(
    (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
  )
  return exact?.id ?? null
}

function SetRow({ setEntry, index, disabled, onDelete, onSave }) {
  const [isEditing, setIsEditing] = useState(false)
  const [weightKg, setWeightKg] = useState(String(setEntry.weightKg))
  const [reps, setReps] = useState(String(setEntry.reps))
  const finishedAt = setEntry.finishedAt || setEntry.createdAt

  async function handleSave() {
    const nextWeight = Number(weightKg)
    const nextReps = Number(reps)
    if (Number.isNaN(nextWeight) || Number.isNaN(nextReps)) {
      return
    }
    await onSave(setEntry.id, nextWeight, nextReps)
    setIsEditing(false)
  }

  return (
    <li className="set-row">
      <div className="set-row-label">Set {index + 1}</div>
      <div className="set-row-meta">
        Finished: {finishedAt ? formatDateTime(finishedAt) : 'Not available'}
      </div>
      {isEditing ? (
        <div className="set-row-form">
          <input
            type="number"
            min="0"
            step="0.5"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            disabled={disabled}
            aria-label={`Set ${index + 1} weight`}
          />
          <input
            type="number"
            min="1"
            step="1"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            disabled={disabled}
            aria-label={`Set ${index + 1} reps`}
          />
          <button type="button" onClick={handleSave} disabled={disabled}>
            Save
          </button>
          <button
            type="button"
            className="button-subtle"
            onClick={() => setIsEditing(false)}
            disabled={disabled}
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div className="set-row-values">
            <span>{setEntry.weightKg} kg</span>
            <span>{setEntry.reps} reps</span>
          </div>
          <div className="set-row-actions">
            <button
              type="button"
              className="button-subtle icon-button"
              onClick={() => setIsEditing(true)}
              disabled={disabled}
              aria-label={`Edit set ${index + 1}`}
              title={`Edit set ${index + 1}`}
            >
              <CgPen aria-hidden="true" />
            </button>
            <button
              type="button"
              className="button-danger icon-button"
              onClick={() => onDelete(setEntry.id)}
              disabled={disabled}
              aria-label={`Delete set ${index + 1}`}
              title={`Delete set ${index + 1}`}
            >
              <CgTrash aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </li>
  )
}

function ExerciseCard({
  exercise,
  disabled,
  isCollapsed,
  onToggleCollapse,
  onDeleteExercise,
  onRenameExercise,
  onAddSet,
  onDeleteSet,
  onUpdateSet,
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(exercise.name)
  const [weightKg, setWeightKg] = useState('')
  const [reps, setReps] = useState('')
  const startedAt = exercise.startedAt || exercise.createdAt

  async function handleNameSave() {
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setNameDraft(exercise.name)
      setEditingName(false)
      return
    }
    await onRenameExercise(exercise.id, trimmed)
    setEditingName(false)
  }

  async function handleAddSet(event) {
    event.preventDefault()
    const nextWeight = Number(weightKg)
    const nextReps = Number(reps)
    if (Number.isNaN(nextWeight) || Number.isNaN(nextReps)) {
      return
    }
    await onAddSet(exercise.id, nextWeight, nextReps)
    setWeightKg('')
    setReps('')
  }

  return (
    <article className="exercise-card">
      <header className="exercise-header">
        {editingName ? (
          <div className="inline-edit-row">
            <input
              type="text"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              disabled={disabled}
              aria-label="Exercise name"
            />
            <button type="button" onClick={handleNameSave} disabled={disabled}>
              Save
            </button>
            <button
              type="button"
              className="button-subtle"
              onClick={() => {
                setNameDraft(exercise.name)
                setEditingName(false)
              }}
              disabled={disabled}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="exercise-title-block">
              <h3>{exercise.name}</h3>
              <p className="exercise-meta">
                Started: {startedAt ? formatDateTime(startedAt) : 'Not available'}
              </p>
            </div>
            <div className="inline-button-row">
              <button
                type="button"
                className="button-subtle icon-button"
                onClick={onToggleCollapse}
                disabled={disabled}
                aria-label={isCollapsed ? 'Expand exercise' : 'Minimize exercise'}
                title={isCollapsed ? 'Expand exercise' : 'Minimize exercise'}
              >
                {isCollapsed ? (
                  <CgChevronDown aria-hidden="true" />
                ) : (
                  <CgChevronUp aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="button-subtle"
                onClick={() => setEditingName(true)}
                disabled={disabled}
              >
                Rename
              </button>
              <button
                type="button"
                className="button-danger icon-button"
                onClick={() => onDeleteExercise(exercise.id)}
                disabled={disabled}
                aria-label={`Delete exercise ${exercise.name}`}
                title={`Delete exercise ${exercise.name}`}
              >
                <CgTrash aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </header>
      {!isCollapsed && (
        <>
          <ul className="set-list">
            {exercise.sets.length === 0 && (
              <li className="empty-message">No sets yet. Add your first set.</li>
            )}
            {exercise.sets.map((setEntry, index) => (
              <SetRow
                key={setEntry.id}
                setEntry={setEntry}
                index={index}
                disabled={disabled}
                onDelete={(setId) => onDeleteSet(exercise.id, setId)}
                onSave={(setId, nextWeight, nextReps) =>
                  onUpdateSet(exercise.id, setId, nextWeight, nextReps)
                }
              />
            ))}
          </ul>
          <form className="set-add-form" onSubmit={handleAddSet}>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="Weight (kg)"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              required
              disabled={disabled}
            />
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Reps"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              required
              disabled={disabled}
            />
            <button
              type="submit"
              className="icon-button"
              disabled={disabled}
              aria-label="Add set"
              title="Add set"
            >
              <CgAddR aria-hidden="true" />
            </button>
          </form>
        </>
      )}
    </article>
  )
}

function HistoryPanel({
  monthCursor,
  onMonthChange,
  selectedDay,
  onSelectDay,
  sessionsByDay,
  disabled,
  onRequestDeleteWorkout,
}) {
  const calendarDays = useMemo(
    () => getCalendarGrid(monthCursor),
    [monthCursor],
  )

  const selectedDaySessionsSorted = useMemo(
    () => {
      const selectedDaySessions = sessionsByDay.get(selectedDay) || []
      return [...selectedDaySessions].sort(
        (left, right) => new Date(left.startedAt) - new Date(right.startedAt),
      )
    },
    [sessionsByDay, selectedDay],
  )

  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null)
  const [selectedExerciseKey, setSelectedExerciseKey] = useState(null)

  const selectedWorkout =
    selectedDaySessionsSorted.find((session) => session.id === selectedWorkoutId) ||
    null

  const drilldownExercises = selectedWorkout
    ? (selectedWorkout.exercises || []).map((exercise) => ({
        exercise,
        sessionId: selectedWorkout.id,
        sessionStartedAt: selectedWorkout.startedAt,
      }))
    : []

  const selectedExercise = drilldownExercises.find(
    (entry) => `${entry.sessionId}:${entry.exercise.id}` === selectedExerciseKey,
  )

  return (
    <section className="history-grid">
      <article className="panel">
        <header className="panel-header">
          <h2>History</h2>
          <div className="inline-button-row">
            <button
              type="button"
              className="button-subtle"
              onClick={() =>
                onMonthChange(
                  new Date(
                    monthCursor.getFullYear(),
                    monthCursor.getMonth() - 1,
                    1,
                  ),
                )
              }
            >
              Prev
            </button>
            <strong>{formatMonthLabel(monthCursor)}</strong>
            <button
              type="button"
              className="button-subtle"
              onClick={() =>
                onMonthChange(
                  new Date(
                    monthCursor.getFullYear(),
                    monthCursor.getMonth() + 1,
                    1,
                  ),
                )
              }
            >
              Next
            </button>
          </div>
        </header>

        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((date) => {
            const dayKey = toDayKey(date)
            const count = sessionsByDay.get(dayKey)?.length || 0
            const isCurrentMonth = date.getMonth() === monthCursor.getMonth()
            const isSelected = dayKey === selectedDay
            const countLabel = count > 4 ? '4+' : String(count)
            const ariaLabel = `${date.toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}: ${count} workout${count === 1 ? '' : 's'}`

            return (
              <button
                key={dayKey}
                type="button"
                className={`calendar-day ${isCurrentMonth ? '' : 'calendar-day-muted'} ${isSelected ? 'calendar-day-selected' : ''}`}
                onClick={() => {
                  setSelectedWorkoutId(null)
                  setSelectedExerciseKey(null)
                  onSelectDay(dayKey)
                }}
                aria-label={ariaLabel}
              >
                <span className="calendar-day-date">{date.getDate()}</span>
                {count > 0 && (
                  <span className="calendar-medal-indicator" aria-hidden="true">
                    <FaMedal className="calendar-medal-icon" />
                    <span className="calendar-medal-count">{countLabel}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </article>

      <article className="panel">
        <h2>Day</h2>
        <p className="muted">
          {selectedDay} - {selectedDaySessionsSorted.length} workout(s)
        </p>
        {selectedDaySessionsSorted.length > 0 && (
          <ul className="history-workout-list">
            {selectedDaySessionsSorted.map((session, index) => (
              <li key={session.id} className="history-workout-row">
                <button
                  type="button"
                  className={`history-item-button ${selectedWorkout?.id === session.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedWorkoutId((current) =>
                      current === session.id ? null : session.id,
                    )
                    setSelectedExerciseKey(null)
                  }}
                  disabled={disabled}
                >
                  <span>Workout {index + 1}</span>
                  <small>{formatDateTime(session.startedAt)}</small>
                </button>
                <button
                  type="button"
                  className="button-danger icon-button"
                  onClick={() =>
                    onRequestDeleteWorkout({
                      id: session.id,
                      name: `Workout ${index + 1}`,
                      startedAt: session.startedAt,
                    })
                  }
                  disabled={disabled}
                  aria-label={`Delete workout ${index + 1}`}
                  title={`Delete workout ${index + 1}`}
                >
                  <CgTrash aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {!selectedWorkout && selectedDaySessionsSorted.length > 0 && (
          <p className="empty-message">Select a workout to view exercises.</p>
        )}
        {selectedWorkout && drilldownExercises.length === 0 && (
          <p className="empty-message">No exercises logged for this workout.</p>
        )}
        {selectedWorkout && (
          <ul className="history-exercise-list">
            {drilldownExercises.map((entry) => {
              const key = `${entry.sessionId}:${entry.exercise.id}`
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={`history-item-button ${selectedExerciseKey === key ? 'selected' : ''}`}
                    onClick={() => setSelectedExerciseKey(key)}
                  >
                    <span>{entry.exercise.name}</span>
                    <small>{formatDateTime(entry.sessionStartedAt)}</small>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </article>

      <article className="panel">
        <h2>Sets</h2>
        {!selectedExercise && (
          <p className="empty-message">
            Select an exercise to inspect logged sets.
          </p>
        )}
        {selectedExercise && (
          <>
            <p>
              <strong>{selectedExercise.exercise.name}</strong>
            </p>
            <ul className="set-list readonly">
              {selectedExercise.exercise.sets.map((setEntry, index) => (
                <li key={setEntry.id} className="set-row">
                  <div className="set-row-label">Set {index + 1}</div>
                  <div className="set-row-meta">
                    Finished:{' '}
                    {setEntry.finishedAt || setEntry.createdAt
                      ? formatDateTime(setEntry.finishedAt || setEntry.createdAt)
                      : 'Not available'}
                  </div>
                  <div className="set-row-values">
                    <span>{setEntry.weightKg} kg</span>
                    <span>{setEntry.reps} reps</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </article>
    </section>
  )
}

function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('venzen_theme')
    return saved === 'dark' || saved === 'queen' || saved === 'light'
      ? saved
      : 'light'
  })
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsError, setSessionsError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [activeTab, setActiveTab] = useState('log')
  const [exerciseInput, setExerciseInput] = useState('')
  const [collapsedExerciseMap, setCollapsedExerciseMap] = useState({})

  const [monthCursor, setMonthCursor] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [selectedDay, setSelectedDay] = useState(toDayKey(new Date()))

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('venzen_theme', theme)
  }, [theme])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false)
      return
    }

    setPersistence(auth, browserLocalPersistence).catch(() => {})

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthLoading(false)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user) {
      setSessions([])
      setSessionsLoading(false)
      return undefined
    }

    setSessionsLoading(true)

    const unsubscribe = subscribeSessions(
      user.uid,
      (nextSessions) => {
        setSessions(nextSessions)
        setSessionsLoading(false)
      },
      (error) => {
        setSessionsError(error.message)
        setSessionsLoading(false)
      },
    )

    return unsubscribe
  }, [user])

  const activeSession = useMemo(
    () => sessions.find((session) => session.status === 'active') || null,
    [sessions],
  )

  const sortedActiveExercises = useMemo(() => {
    if (!activeSession) {
      return []
    }
    return [...(activeSession.exercises || [])].sort(
      (left, right) =>
        new Date(right.createdAt || 0).getTime() -
        new Date(left.createdAt || 0).getTime(),
    )
  }, [activeSession])

  const sessionsByDay = useMemo(() => {
    const map = new Map()
    for (const session of sessions) {
      const key = toDayKey(session.startedAt)
      const list = map.get(key) || []
      list.push(session)
      map.set(key, list)
    }
    return map
  }, [sessions])

  async function runAction(action) {
    setActionError('')
    setIsBusy(true)
    try {
      await action()
      return true
    } catch (error) {
      setActionError(error.message || 'Unexpected error')
      return false
    } finally {
      setIsBusy(false)
    }
  }

  async function withActiveSession(mutator) {
    if (!user || !activeSession) {
      return
    }
    const nextExercises = mutator(cloneExercises(activeSession.exercises || []))
    await updateWorkoutSession(user.uid, activeSession.id, { exercises: nextExercises })
  }

  async function handleSignIn() {
    await runAction(async () => {
      setAuthError('')
      await signInWithPopup(auth, GOOGLE_PROVIDER)
    })
  }

  async function handleSignOut() {
    await runAction(async () => {
      await signOut(auth)
    })
  }

  async function handleStartWorkout() {
    if (!user) {
      return
    }
    await runAction(async () => {
      await startWorkoutSession(user.uid)
      setActiveTab('log')
    })
  }

  async function handleEndWorkout() {
    if (!user || !activeSession) {
      return
    }
    await runAction(async () => {
      await updateWorkoutSession(user.uid, activeSession.id, {
        status: 'ended',
        endedAt: nowIso(),
      })
    })
  }

  async function handleAddExercise(event) {
    event.preventDefault()
    const trimmed = exerciseInput.trim()
    if (!trimmed) {
      return
    }

    const timestamp = nowIso()
    const nextExerciseId = crypto.randomUUID()
    const existingExerciseIds = (activeSession?.exercises || []).map(
      (exercise) => exercise.id,
    )

    const wasSuccessful = await runAction(async () => {
      await withActiveSession((exercises) => [
        {
          id: nextExerciseId,
          name: trimmed,
          catalogId: findExerciseId(trimmed),
          startedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          sets: [],
        },
        ...exercises,
      ])
      setExerciseInput('')
    })

    if (!wasSuccessful) {
      return
    }

    setCollapsedExerciseMap(() => {
      const nextMap = {}
      for (const exerciseId of existingExerciseIds) {
        nextMap[exerciseId] = true
      }
      nextMap[nextExerciseId] = false
      return nextMap
    })
  }

  function toggleExerciseCollapse(exerciseId) {
    setCollapsedExerciseMap((current) => ({
      ...current,
      [exerciseId]: !current[exerciseId],
    }))
  }

  async function renameExercise(exerciseId, nextName) {
    await runAction(async () => {
      await withActiveSession((exercises) =>
        exercises.map((exercise) =>
          exercise.id === exerciseId
            ? { ...exercise, name: nextName, updatedAt: nowIso() }
            : exercise,
        ),
      )
    })
  }

  async function deleteExercise(exerciseId) {
    await runAction(async () => {
      await withActiveSession((exercises) =>
        exercises.filter((exercise) => exercise.id !== exerciseId),
      )
    })
  }

  async function addSet(exerciseId, weightKg, reps) {
    await runAction(async () => {
      const timestamp = nowIso()
      await withActiveSession((exercises) =>
        exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: [
                  ...exercise.sets,
                  {
                    id: crypto.randomUUID(),
                    weightKg,
                    reps,
                    finishedAt: timestamp,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                  },
                ],
                updatedAt: nowIso(),
              }
            : exercise,
        ),
      )
    })
  }

  async function updateSet(exerciseId, setId, weightKg, reps) {
    await runAction(async () => {
      await withActiveSession((exercises) =>
        exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.map((setEntry) =>
                  setEntry.id === setId
                    ? { ...setEntry, weightKg, reps, updatedAt: nowIso() }
                    : setEntry,
                ),
                updatedAt: nowIso(),
              }
            : exercise,
        ),
      )
    })
  }

  async function deleteSet(exerciseId, setId) {
    await runAction(async () => {
      await withActiveSession((exercises) =>
        exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.filter((setEntry) => setEntry.id !== setId),
                updatedAt: nowIso(),
              }
            : exercise,
        ),
      )
    })
  }

  async function confirmDeleteWorkout() {
    if (!user || !deleteTarget) {
      return
    }

    await runAction(async () => {
      await deleteWorkoutSession(user.uid, deleteTarget.id)
      setDeleteTarget(null)
    })
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Venzen Gym Log</h1>
          <p>Firebase is not configured yet.</p>
          <p className="muted">
            Add the required keys to <code>.env.local</code> using
            <code>.env.example</code> as template, then restart the dev server.
          </p>
        </section>
      </main>
    )
  }

  if (authLoading) {
    return (
      <main className="app-shell">
        <section className="panel">
          <p>Checking auth session...</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="app-shell">
        <section className="panel auth-panel">
          <h1>Venzen Gym Log</h1>
          <p>Sign in with Google to start logging workouts.</p>
          <button type="button" onClick={handleSignIn} disabled={isBusy}>
            Continue With Google
          </button>
          {(authError || actionError) && (
            <p className="error">{authError || actionError}</p>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Venzen Gym Log</h1>
          <p className="muted">Signed in as {user.email}</p>
        </div>
        <div className="topbar-actions">
          <div className="theme-text-switcher" role="group" aria-label="Theme mode">
            <button
              type="button"
              className={`theme-text-button ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
            >
              Light
            </button>
            <span>-</span>
            <button
              type="button"
              className={`theme-text-button ${theme === 'queen' ? 'active' : ''}`}
              onClick={() => setTheme('queen')}
            >
              Queen
            </button>
            <span>-</span>
            <button
              type="button"
              className={`theme-text-button ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              Dark
            </button>
          </div>
          <button
            type="button"
            className="button-subtle icon-button"
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <CgLogOut aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={activeTab === 'log' ? 'active' : ''}
          onClick={() => setActiveTab('log')}
        >
          Logging
        </button>
        <button
          type="button"
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </nav>

      {(sessionsError || actionError) && (
        <section className="panel">
          <p className="error">{sessionsError || actionError}</p>
        </section>
      )}

      {activeTab === 'log' && (
        <section className="panel">
          <header className="panel-header">
            <h2>Workout Session</h2>
            {!activeSession && (
              <button type="button" onClick={handleStartWorkout} disabled={isBusy}>
                Start Workout
              </button>
            )}
          </header>

          {sessionsLoading && <p>Loading sessions...</p>}

          {!sessionsLoading && !activeSession && (
            <p className="empty-message">
              No active workout. Start one to begin logging exercises and sets.
            </p>
          )}

          {activeSession && (
            <>
              <p className="muted">
                Started: {formatDateTime(activeSession.startedAt)}
              </p>
              <button
                type="button"
                className="button-danger session-end-button"
                onClick={handleEndWorkout}
                disabled={isBusy}
              >
                End Workout
              </button>

              <form className="exercise-add-form" onSubmit={handleAddExercise}>
                <label htmlFor="exercise-search">Start new exercise</label>
                <input
                  id="exercise-search"
                  className="exercise-search-input"
                  type="text"
                  list="exercise-presets"
                  placeholder="Search or type custom exercise"
                  value={exerciseInput}
                  onChange={(event) => setExerciseInput(event.target.value)}
                  disabled={isBusy}
                  required
                />
                <datalist id="exercise-presets">
                  {EXERCISE_PRESETS.map((exercise) => (
                    <option key={exercise} value={exercise} />
                  ))}
                </datalist>
                <button type="submit" disabled={isBusy}>
                  Add Exercise
                </button>
              </form>

              <section className="exercise-list">
                {activeSession.exercises.length === 0 && (
                  <p className="empty-message">
                    Add an exercise to start logging sets.
                  </p>
                )}

                {sortedActiveExercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    disabled={isBusy}
                    isCollapsed={Boolean(collapsedExerciseMap[exercise.id])}
                    onToggleCollapse={() => toggleExerciseCollapse(exercise.id)}
                    onRenameExercise={renameExercise}
                    onDeleteExercise={deleteExercise}
                    onAddSet={addSet}
                    onUpdateSet={updateSet}
                    onDeleteSet={deleteSet}
                  />
                ))}
              </section>
            </>
          )}
        </section>
      )}

      {activeTab === 'history' && (
        <HistoryPanel
          monthCursor={monthCursor}
          onMonthChange={setMonthCursor}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          sessionsByDay={sessionsByDay}
          disabled={isBusy}
          onRequestDeleteWorkout={setDeleteTarget}
        />
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="panel modal-panel">
            <h3>Delete workout?</h3>
            <p className="muted">
              Are you sure you want to delete {deleteTarget.name} logged on{' '}
              {formatDateTime(deleteTarget.startedAt)}?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button-subtle"
                onClick={() => setDeleteTarget(null)}
                disabled={isBusy}
              >
                No
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={confirmDeleteWorkout}
                disabled={isBusy}
              >
                Yes
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App

