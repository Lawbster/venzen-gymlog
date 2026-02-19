const CSV_COLUMNS = [
  'date',
  'exercise_name',
  'reps',
  'weight_kg',
  'set_number',
  'set_finished_at',
  'workout_name',
  'workout_started_at',
  'workout_ended_at',
]

function toLocalMonthKey(input) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function toLocalDayKey(input) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toLocalTimeString(input) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function escapeCsvValue(value) {
  const normalized = value == null ? '' : String(value)
  if (normalized.includes('"') || normalized.includes(',') || normalized.includes('\n')) {
    return `"${normalized.replaceAll('"', '""')}"`
  }
  return normalized
}

export function getCurrentMonthKey() {
  return toLocalMonthKey(new Date())
}

export function buildExportRows(sessions, { scope = 'all', monthKey = '' } = {}) {
  const filtered = (sessions || []).filter((session) => {
    if (scope !== 'month') {
      return true
    }
    return toLocalMonthKey(session.startedAt) === monthKey
  })

  const sortedSessions = [...filtered].sort(
    (left, right) => new Date(left.startedAt || 0) - new Date(right.startedAt || 0),
  )

  const rows = []

  for (const session of sortedSessions) {
    const workoutName =
      typeof session.name === 'string' && session.name.trim()
        ? session.name.trim()
        : 'Workout'
    const exercises = session.exercises || []

    for (const exercise of exercises) {
      const sets = exercise.sets || []
      for (const [index, setEntry] of sets.entries()) {
        const setFinishedAt = setEntry.finishedAt || setEntry.createdAt || ''
        const reps = Number(setEntry.reps)
        const weightKg = Number(setEntry.weightKg)

        rows.push({
          date: toLocalDayKey(setFinishedAt || session.startedAt || ''),
          exercise_name: exercise.name || '',
          reps: Number.isFinite(reps) ? reps : '',
          weight_kg: Number.isFinite(weightKg) ? weightKg : '',
          set_number: index + 1,
          set_finished_at: toLocalTimeString(setFinishedAt),
          workout_name: workoutName,
          workout_started_at: toLocalTimeString(session.startedAt),
          workout_ended_at: toLocalTimeString(session.endedAt),
        })
      }
    }
  }

  return rows
}

export function buildWorkoutCsv(sessions, options = {}) {
  const rows = buildExportRows(sessions, options)
  const lines = [
    CSV_COLUMNS.join(','),
    ...rows.map((row) =>
      CSV_COLUMNS.map((column) => escapeCsvValue(row[column])).join(','),
    ),
  ]

  return {
    csvText: lines.join('\n'),
    rowCount: rows.length,
  }
}
