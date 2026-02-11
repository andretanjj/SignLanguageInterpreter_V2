import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface SignSample {
    id?: number;
    label: string;
    type: 'LETTER' | 'PHRASE';
    features: number[][]; // Sequence of window features (96-dim)
    createdAt: number;
}

interface SignMeUpDB extends DBSchema {
    samples: {
        key: number;
        value: SignSample;
        indexes: { 'by-label': string };
    };
}

const DB_NAME = 'SignMeUpDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SignMeUpDB>>;

export const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<SignMeUpDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore('samples', { keyPath: 'id', autoIncrement: true });
                store.createIndex('by-label', 'label');
            },
        });
    }
    return dbPromise;
};

export const saveSample = async (sample: Omit<SignSample, 'id' | 'createdAt'>) => {
    const db = await getDB();
    const fullSample: SignSample = {
        ...sample,
        createdAt: Date.now(),
    };
    return db.add('samples', fullSample);
};

export const getAllSamples = async () => {
    const db = await getDB();
    return db.getAll('samples');
};

export const getSamplesByLabel = async (label: string) => {
    const db = await getDB();
    return db.getAllFromIndex('samples', 'by-label', label);
};

export const deleteSample = async (id: number) => {
    const db = await getDB();
    return db.delete('samples', id);
};

export const clearDatabase = async () => {
    const db = await getDB();
    return db.clear('samples');
};

export const exportDataset = async () => {
    const samples = await getAllSamples();
    return JSON.stringify(samples, null, 2);
};
