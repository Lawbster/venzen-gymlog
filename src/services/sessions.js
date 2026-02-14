import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { nowIso } from '../lib/date'

function normalizeSessions(snapshot) {
  return snapshot.docs.map((docEntry) => {
    const data = docEntry.data()
    return {
      id: docEntry.id,
      ...data,
      exercises: data.exercises || [],
    }
  })
}

function sessionsCollection(userId) {
  return collection(db, 'users', userId, 'sessions')
}

function sessionDocument(userId, sessionId) {
  return doc(db, 'users', userId, 'sessions', sessionId)
}

function cloneExercises(exercises = []) {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: (exercise.sets || []).map((setEntry) => ({ ...setEntry })),
  }))
}

export function subscribeSessions(userId, onNext, onError) {
  const sessionsQuery = query(sessionsCollection(userId), orderBy('startedAt', 'desc'))
  return onSnapshot(
    sessionsQuery,
    (snapshot) => onNext(normalizeSessions(snapshot)),
    onError,
  )
}

export async function startWorkoutSession(userId) {
  const sessionsRef = sessionsCollection(userId)
  const activeSessionQuery = query(
    sessionsRef,
    where('status', '==', 'active'),
    limit(1),
  )
  const activeSessionSnapshot = await getDocs(activeSessionQuery)

  if (!activeSessionSnapshot.empty) {
    return normalizeSessions(activeSessionSnapshot)[0]
  }

  const sessionId = crypto.randomUUID()
  const now = nowIso()
  const session = {
    id: sessionId,
    userId,
    status: 'active',
    startedAt: now,
    endedAt: null,
    exercises: [],
    createdAt: now,
    updatedAt: now,
  }

  await setDoc(doc(sessionsRef, sessionId), session)
  return session
}

export async function updateWorkoutSession(userId, sessionId, patch) {
  const sessionRef = sessionDocument(userId, sessionId)
  await updateDoc(sessionRef, {
    ...patch,
    updatedAt: nowIso(),
  })
}

export async function deleteWorkoutSession(userId, sessionId) {
  const sessionRef = sessionDocument(userId, sessionId)
  await deleteDoc(sessionRef)
}

export async function mutateSessionExercises(userId, sessionId, mutator) {
  const sessionRef = sessionDocument(userId, sessionId)

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(sessionRef)
    if (!snapshot.exists()) {
      throw new Error('Workout session not found')
    }

    const data = snapshot.data()
    const nextExercises = mutator(cloneExercises(data.exercises || []))

    transaction.update(sessionRef, {
      exercises: nextExercises,
      updatedAt: nowIso(),
    })

    return nextExercises
  })
}
