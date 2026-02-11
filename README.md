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

## 🌍 Multi-Language Support (ASL / BSL)

SignMeUp now supports multiple sign languages! You can toggle between them using the dropdown at the top of the Interpreter or Debug pages.

### How it Works
- **ASL (American Sign Language)**: Uses the WLASL300 dataset + your custom recordings.
- **BSL (British Sign Language)**: Uses a separate custom dataset (`bsl_dataset.json`).

Each language has its own isolated model and labels:
- ASL Model: `public/models/asl/`
- BSL Model: `public/models/bsl/`

---

## 📸 Workflow: Train Your Own Signs

SignMeUp allows you to teach it *your* specific signs without needing a massive external dataset.

### 1. Collect Data
1.  Navigate to **[http://localhost:3000/debug](http://localhost:3000/debug)**.
2.  **Select the Language** you want to teach (e.g., ASL or BSL).
3.  In the "Data Collection" panel:
    *   Enter a **Label** (e.g., "Hello").
    *   Click **Start Record**.
    *   Perform the sign (move your hands!).
    *   Click **Stop & Save**.
4.  Repeat 5-10 times per sign.

### 2. Train Model
You can trigger training directly from the **Debug Page**:
1.  On the right side, find the **Training** panel.
2.  Click **Train Model Now**.
3.  Watch the logs. When it says "Training completed," reload the page.

*Alternatively, run via command line:*
```bash
# Train ASL (default)
npm run train -- --lang asl

# Train BSL
npm run train -- --lang bsl
```

### 3. Run Inference
1.  Go to the [Interpreter Page](http://localhost:3000/interpreter).
2.  Select the correct language.
3.  Perform your signs!

---

## 🧠 Data Collection Best Practices

- **Consistent Framing**: Keep your upper body and hands visible.
- **Lighting**: Ensure your hands are well-lit. Avoid heavy backlighting.
- **Start/End Neutral**: Start with hands down, sign, then hands down.
- **Variety**: Record varying speeds and slight angle changes.

---

## 🛠️ Advanced (Optional): External Datasets

See [tools/wlasl_import/README.md](tools/wlasl_import/README.md) for instructions on importing WLASL (ASL) data.

To train with manual custom arguments (if you are a power user):
```bash
npm run train -- --dataset my_custom_data.json --outDir public/models/experimental
```
