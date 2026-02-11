export type SignLanguageKey = "asl" | "bsl";

export interface SignLanguageConfig {
    name: string;
    dataset: {
        kind: "json" | "jsonl_gz";
        path: string; // Relative to project root
    };
    modelDir: string;      // Public URL path where model.json is served (e.g. /models/asl)
    fsModelDir: string;    // Filesystem path for saving (e.g. public/models/asl)
    labelsPath: string;    // Public URL path to labels.json
}

export const SIGN_LANGUAGES: Record<SignLanguageKey, SignLanguageConfig> = {
    asl: {
        name: "ASL (WLASL300)",
        dataset: { kind: "jsonl_gz", path: "wlasl_dataset.jsonl.gz" },
        modelDir: "/models/asl",
        fsModelDir: "public/models/asl",
        labelsPath: "/models/asl/labels.json"
    },
    bsl: {
        name: "BSL (Custom)",
        dataset: { kind: "json", path: "bsl_dataset.json" },
        modelDir: "/models/bsl",
        fsModelDir: "public/models/bsl",
        labelsPath: "/models/bsl/labels.json"
    }
} as const;

export const DEFAULT_LANGUAGE: SignLanguageKey = "asl";
