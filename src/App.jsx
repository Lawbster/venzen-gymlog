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
  LogOut,
  Medal,
  Pencil,
  Plus,
  Trash2,
  Check,
  ChevronsUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
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
  mutateSessionExercises,
  startWorkoutSession,
  subscribeSessions,
  updateWorkoutSession,
} from './services/sessions'

const GOOGLE_PROVIDER = new GoogleAuthProvider()
const DEFAULT_APP_TITLE = 'Venzen Gym Log'

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function AppBrand({ theme = 'light', compact = false }) {
  const logoPath =
    theme === 'dark' ? '/VENZENLOGODARK.png' : '/VENZENLOGOLIGHT.png'

  return (
    <img
      src={logoPath}
      alt="Venzen Gym Log"
      className={compact ? 'block w-full max-w-[250px] h-auto' : 'block w-full max-w-[320px] h-auto'}
    />
  )
}

function AppFooter() {
  return (
    <footer className="mt-auto pt-2 text-center text-muted-foreground text-[0.66rem]">
      <a
        className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
        href="https://venzen.no"
        target="_blank"
        rel="noreferrer"
      >
        Venzen designs
      </a>
    </footer>
  )
}

function getElapsedSeconds(fromIso, nowMs) {
  const fromMs = Date.parse(fromIso || '')
  if (Number.isNaN(fromMs)) {
    return 0
  }
  return Math.max(0, Math.floor((nowMs - fromMs) / 1000))
}

function formatHhMmSs(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function formatMmSs(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

async function upsertWorkoutNotification(elapsedLabel) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    Notification.permission !== 'granted'
  ) {
    return
  }

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return
  await registration.showNotification('Venzen Gym Log', {
    body: `Current workout - ${elapsedLabel}`,
    tag: 'active-workout',
    renotify: false,
    silent: true,
    requireInteraction: true,
  })
}

async function clearWorkoutNotification() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return
  const notifications = await registration.getNotifications({ tag: 'active-workout' })
  notifications.forEach((notification) => notification.close())
}

function parseWeight(raw) {
  if (!raw || !raw.trim()) return 0
  return Number(raw.replace(',', '.'))
}

function findExerciseId(name) {
  const exact = EXERCISE_CATALOG.find(
    (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
  )
  return exact?.id ?? null
}

function ExerciseCombobox({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full max-w-[420px] justify-between font-normal"
        >
          {value || 'Search or type exercise...'}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search exercises..."
            value={value}
            onValueChange={onChange}
          />
          <CommandList>
            <CommandEmpty>No exercise found. Press Add to use custom name.</CommandEmpty>
            <CommandGroup>
              {EXERCISE_PRESETS.filter(
                (exercise) => exercise.toLowerCase().includes((value || '').toLowerCase()),
              ).slice(0, 50).map((exercise) => (
                <CommandItem
                  key={exercise}
                  value={exercise}
                  onSelect={(selected) => {
                    onChange(selected)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2',
                      value?.toLowerCase() === exercise.toLowerCase() ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {exercise}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function SetRow({ setEntry, index, isLatest, nowMs, disabled, onDelete, onSave }) {
  const [isEditing, setIsEditing] = useState(false)
  const [weightKg, setWeightKg] = useState(String(setEntry.weightKg))
  const [reps, setReps] = useState(String(setEntry.reps))
  const finishedAt = setEntry.finishedAt || setEntry.createdAt
  const elapsedSinceSetLabel = formatMmSs(getElapsedSeconds(finishedAt, nowMs))

  async function handleSave() {
    const nextWeight = parseWeight(weightKg)
    const nextReps = Number(reps)
    if (Number.isNaN(nextWeight) || Number.isNaN(nextReps) || nextReps < 1) {
      return
    }
    await onSave(setEntry.id, nextWeight, nextReps)
    setIsEditing(false)
  }

  return (
    <li className="border border-border rounded-lg p-2 grid gap-2" style={{ background: 'var(--row-bg)' }}>
      <div className="font-semibold">Set {index + 1}</div>
      <div className="text-xs text-muted-foreground">
        Finished: {finishedAt ? formatDateTime(finishedAt) : 'Not available'}
      </div>
      {isLatest && (
        <div className="text-[0.76rem] text-muted-foreground">
          Time since last set: {elapsedSinceSetLabel}
        </div>
      )}
      {isEditing ? (
        <div className="flex flex-wrap gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            disabled={disabled}
            placeholder="kg"
            aria-label={`Set ${index + 1} weight`}
            className="w-24"
          />
          <Input
            type="number"
            min="1"
            step="1"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            disabled={disabled}
            aria-label={`Set ${index + 1} reps`}
            className="w-24"
          />
          <Button size="sm" onClick={handleSave} disabled={disabled}>
            Save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(false)}
            disabled={disabled}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <span>{setEntry.weightKg} kg</span>
            <span>{setEntry.reps} reps</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsEditing(true)}
              disabled={disabled}
              aria-label={`Edit set ${index + 1}`}
              title={`Edit set ${index + 1}`}
            >
              <Pencil />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onDelete(setEntry.id)}
              disabled={disabled}
              aria-label={`Delete set ${index + 1}`}
              title={`Delete set ${index + 1}`}
            >
              <Trash2 />
            </Button>
          </div>
        </>
      )}
    </li>
  )
}

function ExerciseCard({
  exercise,
  nowMs,
  disabled,
  isCollapsed,
  onToggleCollapse,
  onDeleteExercise,
  onAddSet,
  onDeleteSet,
  onUpdateSet,
}) {
  const [weightKg, setWeightKg] = useState('')
  const [reps, setReps] = useState('')
  const startedAt = exercise.startedAt || exercise.createdAt

  async function handleAddSet(event) {
    event.preventDefault()
    const nextWeight = parseWeight(weightKg)
    const nextReps = Number(reps)
    if (Number.isNaN(nextWeight) || Number.isNaN(nextReps) || nextReps < 1) {
      return
    }
    await onAddSet(exercise.id, nextWeight, nextReps)
    setWeightKg('')
    setReps('')
  }

  function handleCardToggle(event) {
    if (disabled) {
      return
    }

    if (event.target.closest('button,input,select,textarea,label,a,form')) {
      return
    }

    onToggleCollapse()
  }

  return (
    <article
      className="border border-border rounded-xl bg-accent p-3 grid gap-2.5 cursor-pointer"
      onClick={handleCardToggle}
      tabIndex={0}
      role="button"
      aria-expanded={!isCollapsed}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button,input,select,textarea,label,a,form')) {
          e.preventDefault()
          onToggleCollapse()
        }
      }}
    >
      <header className="flex justify-between gap-3 items-start">
        <div className="grid gap-1">
          <h3 className="font-semibold">{exercise.name}</h3>
          <p className="text-xs text-muted-foreground">
            Started: {startedAt ? formatDateTime(startedAt) : 'Not available'}
          </p>
        </div>
        <Button
          variant="destructive"
          size="icon"
          onClick={() => onDeleteExercise(exercise.id)}
          disabled={disabled}
          aria-label={`Delete exercise ${exercise.name}`}
          title={`Delete exercise ${exercise.name}`}
        >
          <Trash2 />
        </Button>
      </header>
      {!isCollapsed && (
        <>
          <ul className="list-none p-0 m-0 grid gap-2">
            {exercise.sets.length === 0 && (
              <li className="text-muted-foreground">No sets yet. Add your first set.</li>
            )}
            {exercise.sets.map((setEntry, index) => (
              <SetRow
                key={setEntry.id}
                setEntry={setEntry}
                index={index}
                isLatest={index === exercise.sets.length - 1}
                nowMs={nowMs}
                disabled={disabled}
                onDelete={(setId) =>
                  onDeleteSet(exercise.id, exercise.name, setId, setEntry, index)
                }
                onSave={(setId, nextWeight, nextReps) =>
                  onUpdateSet(exercise.id, setId, nextWeight, nextReps)
                }
              />
            ))}
          </ul>
          <form className="flex flex-wrap gap-2 items-center mt-2" onSubmit={handleAddSet}>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Weight (kg)"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              disabled={disabled}
              className="w-28"
            />
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Reps"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              required
              disabled={disabled}
              className="w-20"
            />
            <Button type="submit" disabled={disabled} size="sm">
              <Plus className="size-4" />
              Add Set
            </Button>
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
  onRequestRenameWorkout,
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
      <Card className="shadow-[var(--panel-shadow)] backdrop-blur-[5px]">
        <CardContent>
          <div className="flex justify-between items-center gap-2 mb-4">
            <Button
              variant="secondary"
              size="sm"
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
            </Button>
            <strong className="text-sm">{formatMonthLabel(monthCursor)}</strong>
            <Button
              variant="secondary"
              size="sm"
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
            </Button>
          </div>

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
                  className={cn(
                    'calendar-day',
                    !isCurrentMonth && 'calendar-day-muted',
                    isSelected && 'calendar-day-selected',
                  )}
                  onClick={() => {
                    setSelectedWorkoutId(null)
                    setSelectedExerciseKey(null)
                    onSelectDay(dayKey)
                  }}
                  aria-label={ariaLabel}
                  aria-pressed={isSelected}
                >
                  <span className="calendar-day-date">{date.getDate()}</span>
                  {count > 0 && (
                    <span className="calendar-medal-indicator" aria-hidden="true">
                      <Medal className="calendar-medal-icon" />
                      <span className="calendar-medal-count">{countLabel}</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--panel-shadow)] backdrop-blur-[5px]">
        <CardHeader>
          <CardTitle>Day</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-muted-foreground text-sm">
            {selectedDay} - {selectedDaySessionsSorted.length} workout(s)
          </p>
          {selectedDaySessionsSorted.length > 0 && (
            <ul className="list-none m-0 p-0 grid gap-2">
              {selectedDaySessionsSorted.map((session, index) => {
                const workoutName =
                  typeof session.name === 'string' && session.name.trim()
                    ? session.name.trim()
                    : `Workout ${index + 1}`

                return (
                  <li key={session.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-stretch">
                    <button
                      type="button"
                      className={cn(
                        'history-item-button',
                        selectedWorkout?.id === session.id && 'selected',
                      )}
                      onClick={() => {
                        setSelectedWorkoutId((current) =>
                          current === session.id ? null : session.id,
                        )
                        setSelectedExerciseKey(null)
                      }}
                      disabled={disabled}
                    >
                      <span>{workoutName}</span>
                      <small>{formatDateTime(session.startedAt)}</small>
                    </button>
                    <div className="inline-flex gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() =>
                          onRequestRenameWorkout({
                            id: session.id,
                            name: workoutName,
                          })
                        }
                        disabled={disabled}
                        aria-label={`Rename ${workoutName}`}
                        title={`Rename ${workoutName}`}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() =>
                          onRequestDeleteWorkout({
                            id: session.id,
                            name: workoutName,
                            startedAt: session.startedAt,
                          })
                        }
                        disabled={disabled}
                        aria-label={`Delete ${workoutName}`}
                        title={`Delete ${workoutName}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {!selectedWorkout && selectedDaySessionsSorted.length > 0 && (
            <p className="text-muted-foreground text-sm">Select a workout to view exercises.</p>
          )}
          {selectedWorkout && drilldownExercises.length === 0 && (
            <p className="text-muted-foreground text-sm">No exercises logged for this workout.</p>
          )}
          {selectedWorkout && (
            <ul className="list-none m-0 p-0 grid gap-2">
              {drilldownExercises.map((entry) => {
                const key = `${entry.sessionId}:${entry.exercise.id}`
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={cn(
                        'history-item-button',
                        selectedExerciseKey === key && 'selected',
                      )}
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
        </CardContent>
      </Card>

      <Card className="shadow-[var(--panel-shadow)] backdrop-blur-[5px]">
        <CardHeader>
          <CardTitle>Sets</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedExercise && (
            <p className="text-muted-foreground text-sm">
              Select an exercise to inspect logged sets.
            </p>
          )}
          {selectedExercise && (
            <>
              <p className="mb-3">
                <strong>{selectedExercise.exercise.name}</strong>
              </p>
              <ul className="list-none p-0 m-0 grid gap-2">
                {selectedExercise.exercise.sets.map((setEntry, index) => (
                  <li key={setEntry.id} className="border border-border rounded-lg p-2 grid gap-1" style={{ background: 'var(--row-bg)' }}>
                    <div className="font-semibold">Set {index + 1}</div>
                    <div className="text-xs text-muted-foreground">
                      Finished:{' '}
                      {setEntry.finishedAt || setEntry.createdAt
                        ? formatDateTime(setEntry.finishedAt || setEntry.createdAt)
                        : 'Not available'}
                    </div>
                    <div className="flex gap-3">
                      <span>{setEntry.weightKg} kg</span>
                      <span>{setEntry.reps} reps</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
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
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [installPrompt, setInstallPrompt] = useState(null)

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

  const hasNotificationSupport =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator

  const sessionElapsedSeconds = activeSession
    ? getElapsedSeconds(activeSession.startedAt, nowMs)
    : 0
  const sessionElapsedLabel = formatHhMmSs(sessionElapsedSeconds)

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

  async function mutateActiveSessionExercises(mutator) {
    if (!user || !activeSession) {
      return
    }
    await mutateSessionExercises(user.uid, activeSession.id, mutator)
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
      await clearWorkoutNotification()
    })
  }

  function handleCreateGoogleAccount() {
    window.location.assign('https://accounts.google.com/signup')
  }

  async function handleStartWorkout() {
    if (!user) {
      return
    }
    await runAction(async () => {
      await startWorkoutSession(user.uid)
      setSuccessMessage('')
      setActiveTab('log')
    })
  }

  async function handleEndWorkout() {
    if (!user || !activeSession) {
      return
    }
    const workoutName =
      typeof activeSession.name === 'string' && activeSession.name.trim()
        ? activeSession.name.trim()
        : 'Workout'
    const ok = await runAction(async () => {
      await updateWorkoutSession(user.uid, activeSession.id, {
        status: 'ended',
        endedAt: nowIso(),
      })
      await clearWorkoutNotification()
    })
    if (ok) {
      setSuccessMessage(`${workoutName} logged successfully! Go to History to see your completed workouts.`)
    }
  }

  useEffect(() => {
    if (user && hasNotificationSupport && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [user])

  useEffect(() => {
    function onBeforeInstall(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function handleInstallPwa() {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
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
      await mutateActiveSessionExercises((exercises) => [
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

  function requestDeleteExercise(exerciseId) {
    const targetExercise = (activeSession?.exercises || []).find(
      (exercise) => exercise.id === exerciseId,
    )
    setDeleteTarget({
      type: 'exercise',
      exerciseId,
      exerciseName: targetExercise?.name || 'this exercise',
    })
  }

  async function addSet(exerciseId, weightKg, reps) {
    await runAction(async () => {
      const timestamp = nowIso()
      await mutateActiveSessionExercises((exercises) =>
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
      await mutateActiveSessionExercises((exercises) =>
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

  function requestDeleteSet(exerciseId, exerciseName, setId, setEntry, setIndex) {
    setDeleteTarget({
      type: 'set',
      exerciseId,
      exerciseName,
      setId,
      setLabel: `Set ${setIndex + 1}`,
      setFinishedAt: setEntry.finishedAt || setEntry.createdAt || null,
    })
  }

  function requestDeleteWorkout(targetWorkout) {
    setDeleteTarget({
      type: 'workout',
      workoutId: targetWorkout.id,
      workoutName: targetWorkout.name,
      startedAt: targetWorkout.startedAt,
    })
  }

  function openRenameDialog(targetWorkout) {
    setRenameTarget(targetWorkout)
    setRenameDraft(targetWorkout.name)
  }

  async function confirmRename() {
    if (!user || !renameTarget) {
      return
    }

    const nextName = renameDraft.trim()
    if (!nextName || nextName === renameTarget.name) {
      setRenameTarget(null)
      return
    }

    await runAction(async () => {
      await updateWorkoutSession(user.uid, renameTarget.id, { name: nextName })
      setRenameTarget(null)
    })
  }

  async function confirmDeleteTarget() {
    if (!user || !deleteTarget) {
      return
    }

    await runAction(async () => {
      if (deleteTarget.type === 'workout') {
        await deleteWorkoutSession(user.uid, deleteTarget.workoutId)
      } else if (deleteTarget.type === 'exercise' && activeSession?.id) {
        await mutateSessionExercises(user.uid, activeSession.id, (exercises) =>
          exercises.filter((exercise) => exercise.id !== deleteTarget.exerciseId),
        )
      } else if (deleteTarget.type === 'set' && activeSession?.id) {
        await mutateSessionExercises(user.uid, activeSession.id, (exercises) =>
          exercises.map((exercise) =>
            exercise.id === deleteTarget.exerciseId
              ? {
                  ...exercise,
                  sets: exercise.sets.filter((setEntry) => setEntry.id !== deleteTarget.setId),
                  updatedAt: nowIso(),
                }
              : exercise,
          ),
        )
      }

      setDeleteTarget(null)
    })
  }

  function getDeleteModalContent() {
    if (!deleteTarget) {
      return { title: '', message: '' }
    }

    if (deleteTarget.type === 'exercise') {
      return {
        title: 'Delete exercise?',
        message: `Are you sure you want to delete ${deleteTarget.exerciseName}?`,
      }
    }

    if (deleteTarget.type === 'set') {
      const finishedLabel = deleteTarget.setFinishedAt
        ? ` logged on ${formatDateTime(deleteTarget.setFinishedAt)}`
        : ''
      return {
        title: 'Delete set?',
        message: `Are you sure you want to delete ${deleteTarget.setLabel} from ${deleteTarget.exerciseName}${finishedLabel}?`,
      }
    }

    return {
      title: 'Delete workout?',
      message: `Are you sure you want to delete ${deleteTarget.workoutName} logged on ${formatDateTime(deleteTarget.startedAt)}?`,
    }
  }

  useEffect(() => {
    if (!activeSession?.id) {
      return undefined
    }

    setNowMs(Date.now())
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [activeSession?.id])

  useEffect(() => {
    if (!activeSession) {
      document.title = DEFAULT_APP_TITLE
      clearWorkoutNotification()
      return undefined
    }

    document.title = `${sessionElapsedLabel} - ${DEFAULT_APP_TITLE}`

    if (hasNotificationSupport && Notification.permission === 'granted') {
      upsertWorkoutNotification(sessionElapsedLabel)
    }

    return undefined
  }, [activeSession, sessionElapsedLabel])

  const deleteModalContent = getDeleteModalContent()

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto max-w-[1100px] min-h-dvh px-4 py-6 pb-10 flex flex-col gap-4">
        <Card className="shadow-[var(--panel-shadow)] backdrop-blur-[5px]">
          <CardContent>
            <AppBrand theme={theme} />
            <p className="mt-3">Firebase is not configured yet.</p>
            <p className="text-muted-foreground mt-1">
              Add the required keys to <code>.env.local</code> using{' '}
              <code>.env.example</code> as template, then restart the dev server.
            </p>
          </CardContent>
        </Card>
        <AppFooter />
      </main>
    )
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-[1100px] min-h-dvh px-4 py-6 pb-10 flex flex-col gap-4">
        <Card className="shadow-[var(--panel-shadow)] backdrop-blur-[5px]">
          <CardContent>
            <p>Checking auth session...</p>
          </CardContent>
        </Card>
        <AppFooter />
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-[1100px] min-h-dvh px-4 py-6 pb-10 flex flex-col gap-4">
        <Card className="max-w-[420px] mx-auto mt-[8vh] shadow-[var(--panel-shadow)] backdrop-blur-[5px]">
          <CardContent className="grid gap-3">
            <AppBrand theme={theme} />
            <p>You need a google account in order to use this application</p>
            <div className="grid gap-2">
              <Button
                onClick={handleSignIn}
                disabled={isBusy}
                className="w-full justify-center gap-2"
              >
                <GoogleIcon />
                <span>Log in with Google</span>
              </Button>
              <Button
                variant="secondary"
                onClick={handleCreateGoogleAccount}
                disabled={isBusy}
                className="w-full justify-center gap-2"
              >
                <GoogleIcon />
                <span>Create new account</span>
              </Button>
            </div>
            {(authError || actionError) && (
              <p className="text-destructive">{authError || actionError}</p>
            )}
          </CardContent>
        </Card>
        <AppFooter />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1100px] min-h-dvh px-4 py-6 pb-10 flex flex-col gap-4">
      <header className="flex justify-between gap-3 items-start max-sm:flex-col max-sm:items-stretch">
        <div className="grid gap-2">
          <AppBrand theme={theme} compact />
          <p className="text-muted-foreground text-[0.8rem]">Signed in as {user.email}</p>
        </div>
        <div className="inline-flex flex-col items-end gap-1.5">
          <div className="inline-flex gap-1 items-center text-muted-foreground text-sm" role="group" aria-label="Theme mode">
            {['light', 'queen', 'dark'].map((t, i) => (
              <span key={t} className="contents">
                {i > 0 && <span>-</span>}
                <button
                  type="button"
                  className={cn(
                    'appearance-none border-0 bg-transparent p-0 cursor-pointer text-sm underline',
                    theme === t ? 'text-foreground font-bold' : 'text-muted-foreground',
                  )}
                  onClick={() => setTheme(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              </span>
            ))}
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut />
          </Button>
        </div>
      </header>

      {installPrompt && (
        <Card className="shadow-[var(--panel-shadow)]">
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm">Install Venzen Gym Log for quick access from your home screen.</p>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={handleInstallPwa}>
                Install
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setInstallPrompt(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="log">Logging</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {(sessionsError || actionError) && (
          <Card className="shadow-[var(--panel-shadow)]">
            <CardContent>
              <p className="text-destructive">{sessionsError || actionError}</p>
            </CardContent>
          </Card>
        )}

        <TabsContent value="log">
          <Card className="shadow-[var(--panel-shadow)] backdrop-blur-[5px]">
            <CardHeader>
              <CardTitle>Workout Session</CardTitle>
              {!activeSession && (
                <CardAction>
                  <Button onClick={handleStartWorkout} disabled={isBusy}>
                    Start Workout
                  </Button>
                </CardAction>
              )}
            </CardHeader>

            <CardContent>
              {sessionsLoading && <p>Loading sessions...</p>}

              {!sessionsLoading && !activeSession && (
                <>
                  {successMessage && (
                    <p className="text-primary font-medium">{successMessage}</p>
                  )}
                  <p className="text-muted-foreground">
                    No active workout. Start one to begin logging exercises and sets.
                  </p>
                </>
              )}

              {activeSession && (
                <div className="grid gap-3">
                  <p className="text-muted-foreground text-sm">
                    Started: {formatDateTime(activeSession.startedAt)}
                  </p>
                  <p className="font-bold text-foreground">Workout timer: {sessionElapsedLabel}</p>
                  <Button
                    variant="destructive"
                    onClick={handleEndWorkout}
                    disabled={isBusy}
                    className="w-full max-w-[420px]"
                  >
                    End Workout
                  </Button>

                  <form className="flex flex-wrap gap-2 items-end mt-2" onSubmit={handleAddExercise}>
                    <div className="grid gap-1.5 w-full">
                      <Label htmlFor="exercise-search">Start new exercise</Label>
                      <ExerciseCombobox
                        value={exerciseInput}
                        onChange={setExerciseInput}
                        disabled={isBusy}
                      />
                    </div>
                    <Button type="submit" disabled={isBusy}>
                      <Plus className="size-4" />
                      Add Exercise
                    </Button>
                  </form>

                  <section className="grid gap-3 mt-2">
                    {activeSession.exercises.length === 0 && (
                      <p className="text-muted-foreground">
                        Add an exercise to start logging sets.
                      </p>
                    )}

                    {sortedActiveExercises.map((exercise) => (
                      <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        nowMs={nowMs}
                        disabled={isBusy}
                        isCollapsed={Boolean(collapsedExerciseMap[exercise.id])}
                        onToggleCollapse={() => toggleExerciseCollapse(exercise.id)}
                        onDeleteExercise={requestDeleteExercise}
                        onAddSet={addSet}
                        onUpdateSet={updateSet}
                        onDeleteSet={requestDeleteSet}
                      />
                    ))}
                  </section>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <HistoryPanel
            monthCursor={monthCursor}
            onMonthChange={setMonthCursor}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            sessionsByDay={sessionsByDay}
            disabled={isBusy}
            onRequestRenameWorkout={openRenameDialog}
            onRequestDeleteWorkout={requestDeleteWorkout}
          />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteModalContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{deleteModalContent.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>No</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteTarget} disabled={isBusy}>
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename workout dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename workout</DialogTitle>
            <DialogDescription>Enter a new name for this workout.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rename-input">Workout name</Label>
            <Input
              id="rename-input"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmRename() }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)} disabled={isBusy}>
              Cancel
            </Button>
            <Button onClick={confirmRename} disabled={isBusy || !renameDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppFooter />
    </main>
  )
}

export default App
