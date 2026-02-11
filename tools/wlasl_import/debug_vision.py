
import mediapipe as mp
try:
    from mediapipe.tasks.python import vision
    print(f"Vision Path: {vision.__file__}")
    for item in dir(vision):
        print(item)
except ImportError as e:
    print(f"Could not import vision: {e}")
