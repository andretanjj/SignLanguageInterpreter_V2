
export type DatasetRecord = {
    id?: number | string;
    label: string;
    type: "LETTER" | "PHRASE";
    features: number[][]; // Each inner array should be length 96
    createdAt?: number;
    metadata?: Record<string, any>;
    source?: "local" | "wlasl" | "other";
};

export type TrainingSample = {
    features: number[][]; // Shape: [5, 96]
    label: string;
    source?: string;
};
