import exerciseCatalog from './exercise-catalog.json'

export const EXERCISE_CATALOG = exerciseCatalog
export const EXERCISE_PRESETS = EXERCISE_CATALOG.map((exercise) => exercise.name)
