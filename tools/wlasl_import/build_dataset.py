
import os
import json
import time
import argparse
import numpy as np
import gzip
import urllib.request
import shutil
import ssl
from datetime import datetime

try:
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
except ImportError:
    cv2 = None
    mp = None
    print("Warning: opencv-python and/or mediapipe not installed. Some features will be disabled.")

# ==========================================
# 1. Feature Engineering Logic (Ported from TS)
# ==========================================

FEATURE_CONFIG = {
    "windowFrames": 8,
    "strideFrames": 4,
    "windowsPerSample": 5, # Default reference
    "featuresPerKeypoint": 6 # (mean x,y,z) + (std x,y,z)
}

# Keypoint Indices
POSE_INDICES = [11, 12, 13, 14, 15, 16] # Shoulders, Elbows, Wrists
HAND_INDICES = [4, 8, 12, 16, 20]       # Fingertips

def extract_raw_features(pose_landmarks, left_hand_landmarks, right_hand_landmarks):
    """
    Extracts 48 raw features: 6 pose points + 5 left hand points + 5 right hand points.
    Each point has (x, y, z).
    Total: (6 + 5 + 5) * 3 = 16 * 3 = 48.
    
    Inputs are LISTS of NormalizedLandmark (or None).
    """
    features = []

    # Helper to push x,y,z or 0,0,0
    def push_point(landmarks, idx):
        if landmarks:
            lm = landmarks[idx]
            features.extend([lm.x, lm.y, lm.z])
        else:
            features.extend([0.0, 0.0, 0.0])

    # 1. Pose
    if pose_landmarks:
        for idx in POSE_INDICES:
            push_point(pose_landmarks, idx)
    else:
         for _ in POSE_INDICES:
            features.extend([0.0, 0.0, 0.0])

    # 2. Left Hand
    if left_hand_landmarks:
        for idx in HAND_INDICES:
             push_point(left_hand_landmarks, idx)
    else:
        for _ in HAND_INDICES:
            features.extend([0.0, 0.0, 0.0])

    # 3. Right Hand
    if right_hand_landmarks:
        for idx in HAND_INDICES:
            push_point(right_hand_landmarks, idx)
    else:
         for _ in HAND_INDICES:
            features.extend([0.0, 0.0, 0.0])

    return features

def compute_window_stats(window_buffer):
    """
    Computes Mean and StdDev for each feature across the window.
    Input: window_buffer (list of lists), shape [WindowSize, 48]
    Output: flattened list of shape [96] (48 means + 48 stds)
    """
    data = np.array(window_buffer) # Shape (N, 48)
    
    means = np.mean(data, axis=0)
    stds = np.std(data, axis=0)
    
    # Interleave mean and std
    features = []
    for m, s in zip(means, stds):
        features.extend([float(m), float(s)])
        
    return features


class FeatureProcessor:
    def __init__(self):
        self.frame_buffer = []
        self.stride = FEATURE_CONFIG["strideFrames"]
        self.window_size = FEATURE_CONFIG["windowFrames"]

    def process_frame(self, pose_landmarks, left_hand_landmarks, right_hand_landmarks):
        """
        Returns a feature vector (96-dim) if a window is completed, else None.
        """
        raw_feats = extract_raw_features(pose_landmarks, left_hand_landmarks, right_hand_landmarks)
        self.frame_buffer.append(raw_feats)

        if len(self.frame_buffer) >= self.window_size:
            # Take the window_size frames
            window_data = self.frame_buffer[:self.window_size]
            window_stats = compute_window_stats(window_data)
            
            # Remove stride
            self.frame_buffer = self.frame_buffer[self.stride:]
            
            return window_stats
        
        return None

    def reset(self):
        self.frame_buffer = []

# ==========================================
# 2. Video Processing Logic
# ==========================================

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

def ensure_models():
    """Download models if missing."""
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
    
    pose_path = os.path.join(MODEL_DIR, "pose_landmarker_full.task")
    hand_path = os.path.join(MODEL_DIR, "hand_landmarker.task")
    
    # Create unverified SSL context
    ssl_context = ssl._create_unverified_context()

    def download_file(url, path):
        with urllib.request.urlopen(url, context=ssl_context) as response, open(path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)

    if not os.path.exists(pose_path):
        print("Downloading Pose Model...")
        download_file(POSE_MODEL_URL, pose_path)
        
    if not os.path.exists(hand_path):
        print("Downloading Hand Model...")
        download_file(HAND_MODEL_URL, hand_path)
        
    return pose_path, hand_path

def process_video_frames(video_path, pose_landmarker, hand_landmarker, processor,
                         fps_target=15, max_seconds=6.0, start_ts_ms=0):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None, start_ts_ms

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0:
        video_fps = 30

    frame_interval = max(1, int(round(video_fps / fps_target)))

    processor.reset()
    all_features = []

    frame_count = 0
    frames_processed = 0
    max_frames = int(fps_target * max_seconds)

    # Use a fixed step based on the fps you are sampling at
    step_ms = max(1, int(round(1000.0 / fps_target)))
    ts_ms = start_ts_ms

    try:
        while cap.isOpened():
            success, image = cap.read()
            if not success:
                break

            frame_count += 1
            if (frame_count - 1) % frame_interval != 0:
                continue
            if frames_processed >= max_frames:
                break

            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)

            # IMPORTANT: monotonically increasing across the whole run
            timestamp_ms = ts_ms
            ts_ms += step_ms

            pose_result = pose_landmarker.detect_for_video(mp_image, timestamp_ms)
            hand_result = hand_landmarker.detect_for_video(mp_image, timestamp_ms)

            pose_lms = pose_result.pose_landmarks[0] if pose_result.pose_landmarks else None

            left_hand_lms = None
            right_hand_lms = None
            if hand_result.hand_landmarks:
                for i, hand_lms in enumerate(hand_result.hand_landmarks):
                    label = hand_result.handedness[i][0].category_name
                    if label == "Left":
                        left_hand_lms = hand_lms
                    elif label == "Right":
                        right_hand_lms = hand_lms

            feats = processor.process_frame(pose_lms, left_hand_lms, right_hand_lms)
            if feats:
                all_features.append(feats)

            frames_processed += 1

    except Exception as e:
        print(f"Error during video processing: {e}")
    finally:
        cap.release()

    # return next start timestamp for the next video
    return all_features, ts_ms

def list_to_segments(features_list, segment_size, segment_stride):
    segments = []
    if len(features_list) < segment_size:
        return segments 
    for i in range(0, len(features_list) - segment_size + 1, segment_stride):
        segments.append(features_list[i : i + segment_size])
    return segments

# ==========================================
# 3. Video Sources
# ==========================================
def parse_label_map(path):
    mapping = {}
    if not path:
        return mapping
    try:
        with open(path, 'r') as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 2:
                    mapping[parts[0]] = parts[1]
                    try:
                        mapping[int(parts[0])] = parts[1]
                    except ValueError:
                        pass
    except Exception as e:
        print(f"Error parsing label map: {e}")
    return mapping

def scan_wlasl_json(wlasl_root, json_path, labels_limit=0):
    if not json_path:
        json_path = os.path.join(wlasl_root, "WLASL_v0.3.json")
    if not os.path.exists(json_path):
        print(f"Error: WLASL JSON not found at {json_path}")
        return
    try:
        with open(json_path, 'r') as f:
            wlasl_data = json.load(f)
    except Exception as e:
        print(f"Error loading metadata: {e}")
        return
    if labels_limit > 0:
        wlasl_data = wlasl_data[:labels_limit]
    for entry in wlasl_data:
        gloss = entry['gloss']
        instances = entry.get('instances', [])
        for inst in instances:
            video_id = inst['video_id']
            video_path = os.path.join(wlasl_root, "videos", f"{video_id}.mp4")
            if os.path.exists(video_path):
                yield video_path, gloss, video_id

def scan_folder_root(folder_root, label_map=None, labels_limit=0):
    if not os.path.exists(folder_root):
        print(f"Error: Folder root not found at {folder_root}")
        return
    subdirs = [d for d in os.listdir(folder_root) if os.path.isdir(os.path.join(folder_root, d))]
    subdirs.sort()
    if labels_limit > 0:
        subdirs = subdirs[:labels_limit]
    for class_id in subdirs:
        label = class_id
        if label_map and class_id in label_map:
            label = label_map[class_id]
        elif label_map and int(class_id) in label_map:
             label = label_map[int(class_id)]
        class_dir = os.path.join(folder_root, class_id)
        files = [f for f in os.listdir(class_dir) if f.lower().endswith('.mp4')]
        files.sort()
        for fname in files:
            video_path = os.path.join(class_dir, fname)
            unique_id = f"{class_id}/{fname}"
            yield video_path, label, unique_id

# ==========================================
# 4. Main Script
# ==========================================

def main():
    if cv2 is None or mp is None:
        print("Error: Required libraries (opencv-python, mediapipe) are not installed.")
        return

    parser = argparse.ArgumentParser(description="Build dataset from WLASL videos.")
    parser.add_argument("--wlasl_root", help="Path to WLASL root (JSON mode).")
    parser.add_argument("--wlasl_json", help="Path to WLASL JSON (JSON mode).")
    parser.add_argument("--folder_root", help="Path to WLASL300 root folders (Folder mode).")
    parser.add_argument("--label_map", help="Path to label map file.")
    parser.add_argument("--out", required=True, help="Output filename.")
    parser.add_argument("--out_format", choices=['json', 'jsonl'], default='jsonl', help="Output format.")
    parser.add_argument("--gzip", action='store_true', help="Use GZIP compression.")
    parser.add_argument("--labels_limit", type=int, default=0, help="Limit number of processed labels.")
    parser.add_argument("--fps", type=int, default=15, help="Target FPS.")
    parser.add_argument("--max_seconds", type=float, default=6.0, help="Max video duration.")
    parser.add_argument("--type", default="PHRASE", help="Dataset type.")
    parser.add_argument("--start_id", type=int, default=10000, help="Starting ID.")
    parser.add_argument("--resume", action='store_true', help="Resume from checkpoint.")
    parser.add_argument("--segment_windows", type=int, default=0, help="If > 0, split into segments.")
    parser.add_argument("--segment_stride", type=int, default=1, help="Stride for segmentation.")
    args = parser.parse_args()

    # Determine video source
    if args.folder_root:
        print(f"Mode: Folder Scan ({args.folder_root})")
        label_mapping = parse_label_map(args.label_map)
        video_source = scan_folder_root(args.folder_root, label_mapping, args.labels_limit)
    elif args.wlasl_root:
        print(f"Mode: WLASL JSON ({args.wlasl_root})")
        video_source = scan_wlasl_json(args.wlasl_root, args.wlasl_json, args.labels_limit)
    else:
        print("Error: Must specify either --wlasl_root or --folder_root.")
        return

    # Checkpoint
    processed_ids = set()
    checkpoint_file = args.out + ".checkpoint.txt"
    if args.resume and os.path.exists(checkpoint_file):
        print(f"Resuming from {checkpoint_file}...")
        with open(checkpoint_file, 'r') as f:
            for line in f:
                processed_ids.add(line.strip())
        print(f"Already processed {len(processed_ids)} items.")

    # Output
    mode = 'a' if args.resume else 'w'
    if args.gzip:
        out_f = gzip.open(args.out, mode + 't', encoding='utf-8')
    else:
        out_f = open(args.out, mode, encoding='utf-8')

    if args.out_format == 'json' and not args.resume:
        out_f.write("[\n")

    # Initialize MediaPipe Tasks
    print("Initializing MediaPipe Tasks (downloading models if needed)...")
    pose_model, hand_model = ensure_models()

    BaseOptions = mp.tasks.BaseOptions
    PoseLandmarker = mp.tasks.vision.PoseLandmarker
    PoseOptions = mp.tasks.vision.PoseLandmarkerOptions
    HandLandmarker = mp.tasks.vision.HandLandmarker
    HandOptions = mp.tasks.vision.HandLandmarkerOptions
    VisionRunningMode = mp.tasks.vision.RunningMode

    pose_options = PoseOptions(
        base_options=BaseOptions(model_asset_path=pose_model),
        running_mode=VisionRunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    hand_options = HandOptions(
        base_options=BaseOptions(model_asset_path=hand_model),
        running_mode=VisionRunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    processor = FeatureProcessor()

    current_id = args.start_id
    count_processed = 0
    count_skipped = 0

    # ✅ NEW: global monotonic timestamp across ALL videos in this run
    global_ts_ms = 0

    print("Starting processing...")

    try:
        with PoseLandmarker.create_from_options(pose_options) as pose_landmarker, \
             HandLandmarker.create_from_options(hand_options) as hand_landmarker:

            for video_path, label, unique_id in video_source:
                if unique_id in processed_ids:
                    continue

                print(f"Processing {label} ({unique_id})...", end="\r")

                try:
                    # ✅ NEW: pass global_ts_ms in, and get updated value back
                    features_list, global_ts_ms = process_video_frames(
                        video_path,
                        pose_landmarker,
                        hand_landmarker,
                        processor,
                        args.fps,
                        args.max_seconds,
                        start_ts_ms=global_ts_ms,
                    )

                    if features_list and len(features_list) > 0:
                        if args.segment_windows > 0:
                            samples = list_to_segments(features_list, args.segment_windows, args.segment_stride)
                        else:
                            samples = [features_list]

                        if len(samples) > 0:
                            for feat_seq in samples:
                                record = {
                                    "label": label,
                                    "type": args.type,
                                    "features": feat_seq,
                                    "createdAt": int(time.time() * 1000),
                                    "id": current_id,
                                    "metadata": {"video_id": unique_id},
                                }
                                line = json.dumps(record)
                                if args.out_format == 'jsonl':
                                    out_f.write(line + "\n")
                                else:
                                    out_f.write(line + ",\n")
                                current_id += 1

                            count_processed += 1
                            out_f.flush()

                            with open(checkpoint_file, 'a') as cpf:
                                cpf.write(f"{unique_id}\n")
                            processed_ids.add(unique_id)
                        else:
                            count_skipped += 1
                    else:
                        count_skipped += 1

                except Exception as e:
                    print(f"\nFailed {unique_id}: {e}")
                    count_skipped += 1

    except KeyboardInterrupt:
        print("\nInterrupted by user.")

    if args.out_format == 'json':
        out_f.write("]\n")

    out_f.close()
    print(f"\nDone. Processed: {count_processed}, Skipped: {count_skipped}")

if __name__ == "__main__":
    main()

