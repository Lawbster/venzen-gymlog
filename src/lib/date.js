export function nowIso() {
  return new Date().toISOString()
}

export function toDayKey(input) {
  const value = typeof input === 'string' ? new Date(input) : input
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMonthLabel(value) {
  return value.toLocaleDateString([], {
    year: 'numeric',
    month: 'long',
  })
}

export function getCalendarGrid(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstWeekday)

  return Array.from({ length: totalCells }, (_, index) => {
    const value = new Date(gridStart)
    value.setDate(gridStart.getDate() + index)
    return value
  })
}
