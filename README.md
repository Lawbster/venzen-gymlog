# Venzen Gym Log

React + PWA gym log with Firebase Auth (Google) and Firestore.

## Implemented MVP
- Google sign-in and sign-out
- Single active workout session (`start` / `end`)
- Add exercises from searchable preset list (or custom text)
- Add, edit, and delete sets
- Edit and delete exercises in active session
- History flow: `Calendar -> Day -> Exercise -> Sets`
- PWA installability with offline asset caching

## 1) Firebase setup
1. Create Firebase project.
2. Enable Google auth provider:
   - Firebase Console -> Authentication -> Sign-in method -> Google -> Enable
3. Create Firestore database in production or test mode.
4. Add a Web app in Firebase and copy config values.
5. Copy `.env.example` to `.env.local` and fill values.

## 2) Run locally
```bash
npm install
npm run sync:exercises
npm run dev
```

## 3) Build
```bash
npm run build
```

## Exercise catalog source
- The exercise search list is generated from the Exercemus dataset.
- To refresh catalog data:

```bash
npm run sync:exercises
```

## Firestore security rules
Use `firestore.rules` from this repo:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/sessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Data shape
`users/{uid}/sessions/{sessionId}`

```json
{
  "id": "uuid",
  "userId": "uid",
  "status": "active|ended",
  "startedAt": "ISO-8601",
  "endedAt": "ISO-8601|null",
  "exercises": [
    {
      "id": "uuid",
      "name": "Barbell Bench Press",
      "catalogId": "Barbell Bench Press",
      "sets": [
        {
          "id": "uuid",
          "weightKg": 100,
          "reps": 7
        }
      ]
    }
  ]
}
```
