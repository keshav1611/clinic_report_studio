const DB_NAME = 'clinic-report-studio';
const DB_VERSION = 1;
const PATIENT_STORE = 'patients';

let dbPromise;

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PATIENT_STORE)) {
        db.createObjectStore(PATIENT_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function transact(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PATIENT_STORE, mode);
    const store = transaction.objectStore(PATIENT_STORE);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPatients() {
  const patients = await transact('readonly', (store) => store.getAll());
  return patients.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function savePatient(patient) {
  const now = new Date().toISOString();
  const nextPatient = {
    ...patient,
    updatedAt: now,
    createdAt: patient.createdAt || now,
  };

  await transact('readwrite', (store) => store.put(nextPatient));
  return nextPatient;
}

export async function deletePatient(id) {
  await transact('readwrite', (store) => store.delete(id));
}
