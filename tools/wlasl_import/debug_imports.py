
import sys
print(f"Python Executable: {sys.executable}")
print(f"Python Version: {sys.version}")

try:
    import cv2
    print(f"OpenCV imported successfully: {cv2.__version__}")
except ImportError as e:
    print(f"Failed to import cv2: {e}")

try:
    import mediapipe as mp
    print(f"MediaPipe imported successfully: {mp.__file__}")
    try:
        print(f"mp.solutions: {mp.solutions}")
    except AttributeError:
        print("mp.solutions does not exist")
        
    try:
        from mediapipe.python.solutions import holistic
        print("from mediapipe.python.solutions import holistic SUCCEEDED")
    except ImportError as e:
        print(f"from mediapipe.python.solutions import holistic FAILED: {e}")

except ImportError as e:
    print(f"Failed to import mediapipe: {e}")
