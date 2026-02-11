export const KEYPOINT_PROFILES = {
    repo_default: {
        pose: [11, 12, 13, 14, 15, 16], // Shoulders, Elbows, Wrists
        hands: [4, 8, 12, 16, 20],      // Fingertips
    },
    full_hand: {
        pose: [11, 12, 13, 14, 15, 16],
        hands: Array.from({ length: 21 }, (_, i) => i),
    },
};

export type KeypointProfileName = keyof typeof KEYPOINT_PROFILES;
