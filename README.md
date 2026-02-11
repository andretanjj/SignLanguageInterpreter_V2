# SignMeUp - Local Sign Language Recognition

A privacy-focused, offline-capable web application for learning and recognizing sign language using your webcam.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```
> **Note**: If you see errors about `tfjs-node`, ignore them. The training script will automatically fall back to the standard JS backend.

### 2. Run the App
```bash
pnpm dev
```
Open [http://localhost:3000/interpreter](http://localhost:3000/interpreter).

---

## 📸 Workflow: Train Your Own Signs

SignMeUp allows you to teach it *your* specific signs (e.g., "Hungry", "Bathroom", "Yes", "No") without needing a massive external dataset.

### 1. Collect Data
1.  Navigate to the **Phrases** tab in the Interpreter.
2.  Click **Teach New Phrase**.
3.  Follow the wizard:
    *   **Name** your sign (e.g., "Hello").
    *   **Record** yourself performing the sign.
    *   **Save** it.
4.  Repeat this for 5-10 examples per sign for best accuracy.
    > **Tip**: Vary your distance, lighting, and speed slightly to make the model robust.

### 2. Export Dataset
1.  In the **Phrases** tab, click **Export Dataset (JSON)**.
2.  Save the file as `dataset.json` in the root folder of this project.

### 3. Train Model
Run the training script to build a custom model from your `dataset.json`:

```bash
npm run train
```

This command will:
1.  Load your `dataset.json`.
2.  Normalize and segment the data (MediaPipe landmarks).
3.  Train a lightweight LSTM neural network.
4.  Save the model to `public/models/signmeup/`.

### 4. Run Inference
1.  Refresh the [Interpreter Page](http://localhost:3000/interpreter).
2.  The status should say **"Model Ready (Vision + Classifier)"**.
3.  Perform your signs in front of the camera.
4.  The recognized text will appear in the "Live Prediction" box.

---

## 🧠 Data Collection Best Practices

To get a reliable model, follow these tips when recording:

- **Consistent Framing**: Keep your upper body and hands visible. Avoid moving too close or too far.
- **Lighting**: Ensure your hands are well-lit. Backlighting (window behind you) makes hand tracking difficult.
- **Start/End Neutral**: Start with hands down (neutral), perform the sign, and return to neutral.
- **Variety**: Record at least 10 samples per phrase.
    - 5x Normal speed
    - 3x Slightly faster
    - 2x Slightly slower

---

## 🛠️ Advanced (Optional): External Datasets

If you want to bootstrap your model with a large dictionary (WLASL), we provide tools to import standard datasets.

See [tools/wlasl_import/README.md](tools/wlasl_import/README.md) for instructions on how to download and process the WLASL dataset.

Once processed into `wlasl_dataset.jsonl.gz`, the training script will automatically detect and merge it with your local `dataset.json`:

```bash
# Trains on BOTH local data and WLASL if present
npm run train
```
