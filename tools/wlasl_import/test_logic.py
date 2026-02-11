
import unittest
import numpy as np
import os
import tempfile
import shutil
from build_dataset import FeatureProcessor, extract_raw_features, list_to_segments, parse_label_map, scan_folder_root

# Mock Classes for MediaPipe results
class MockLandmark:
    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z

# Updated: Tasks API returns LISTS of landmarks, not objects with .landmark
# output is List[NormalizedLandmark]

class TestFeatureProcessor(unittest.TestCase):
    def setUp(self):
        self.processor = FeatureProcessor()

    def test_raw_feature_extraction(self):
        # Create dummy landmarks
        # Pose: need indices 11-16. Let's make huge list.
        pose_lms = [MockLandmark(0,0,0)] * 33
        # Set specific values for 11-16
        for i in range(11, 17):
            pose_lms[i] = MockLandmark(1.0, 2.0, 3.0)
            
        hands_lms = [MockLandmark(0,0,0)] * 21
        # Set specific values for tips: 4, 8, 12, 16, 20
        for i in [4, 8, 12, 16, 20]:
            hands_lms[i] = MockLandmark(0.5, 0.5, 0.5)

        # Pass LISTS directly
        pose = pose_lms
        hands = hands_lms
        
        # Test pose + left + right
        feats = extract_raw_features(pose, hands, hands)
        
        self.assertEqual(len(feats), 48)
        
        # Check values
        # First 18 should be 1.0, 2.0, 3.0 repeated
        self.assertEqual(feats[0], 1.0)
        self.assertEqual(feats[1], 2.0)
        self.assertEqual(feats[2], 3.0)
        
        # Next 15 (Left Hand) should be 0.5, 0.5, 0.5
        self.assertEqual(feats[18], 0.5)
        
    def test_window_stats(self):
        pose_lms = [MockLandmark(1, 2, 3)] * 33
        # Pass list directly
        pose = pose_lms
        
        features = None
        for _ in range(8):
            features = self.processor.process_frame(pose, None, None)
            
        self.assertIsNotNone(features)
        self.assertEqual(len(features), 96) # 48 mean + 48 std
        
        self.assertAlmostEqual(features[0], 1.0)
        self.assertAlmostEqual(features[1], 0.0)

    # ... existing tests (segmentation, labels, folder) should work fine ...
    def test_segmentation(self):
        windows = list(range(10))
        segments = list_to_segments(windows, 5, 1)
        self.assertEqual(len(segments), 6)

    def test_label_map_parsing(self):
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as tmp:
            tmp.write("1 hello\n")
            tmp.write("2 world\n")
            tmp_path = tmp.name
        try:
            mapping = parse_label_map(tmp_path)
            self.assertEqual(mapping['1'], 'hello')
        finally:
            os.remove(tmp_path)

if __name__ == '__main__':
    unittest.main()
