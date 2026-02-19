import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { nowIso } from '../lib/date'

function favoritesCollection(userId) {
  return collection(db, 'users', userId, 'favoriteTemplates')
}

function normalizeFavorites(snapshot) {
  return snapshot.docs.map((docEntry) => {
    const data = docEntry.data()
    return {
      id: docEntry.id,
      ...data,
      exerciseNames: data.exerciseNames || [],
    }
  })
}

export function subscribeFavoriteTemplates(userId, onNext, onError) {
  const favoritesQuery = query(favoritesCollection(userId), orderBy('name'))
  return onSnapshot(
    favoritesQuery,
    (snapshot) => onNext(normalizeFavorites(snapshot)),
    onError,
  )
}

export async function createFavoriteTemplate(userId, template) {
  const favoriteId = crypto.randomUUID()
  const now = nowIso()
  const favorite = {
    id: favoriteId,
    userId,
    name: template.name,
    exerciseNames: template.exerciseNames,
    createdAt: now,
    updatedAt: now,
  }

  await setDoc(doc(favoritesCollection(userId), favoriteId), favorite)
  return favorite
}

export async function deleteFavoriteTemplate(userId, favoriteId) {
  await deleteDoc(doc(favoritesCollection(userId), favoriteId))
}
