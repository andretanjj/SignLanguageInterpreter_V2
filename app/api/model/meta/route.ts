import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// This must match frontend config
const CONFIG = {
    windowsPerSample: 5,
    windowFrames: 8,
    featureDim: 96
};

export async function GET() {
    const modelDir = path.join(process.cwd(), 'public/models/signmeup');
    const labelsPath = path.join(modelDir, 'labels.json');
    const modelPath = path.join(modelDir, 'model.json');

    let labels: string[] = [];
    let updatedAt: string | null = null;

    try {
        if (fs.existsSync(labelsPath)) {
            const data = fs.readFileSync(labelsPath, 'utf-8');
            labels = JSON.parse(data);
        }

        if (fs.existsSync(modelPath)) {
            const stats = fs.statSync(modelPath);
            updatedAt = stats.mtime.toISOString();
        }
    } catch (e) {
        console.error("Error reading model metadata", e);
    }

    return NextResponse.json({
        labels,
        updatedAt,
        ...CONFIG
    });
}
