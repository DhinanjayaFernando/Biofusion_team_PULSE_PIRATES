# ML Blood Smear Detection App - Setup & Run Guide

## Quick Start

### Windows
```bash
RUN_APP.bat
```

### Linux (Universal)
```bash
chmod +x RUN_APP.sh
./RUN_APP.sh
```

### Ubuntu / Debian / Linux Mint
```bash
chmod +x RUN_APP_UBUNTU.sh
./RUN_APP_UBUNTU.sh
```

### Arch / Manjaro / EndeavourOS
```bash
chmod +x RUN_APP_ARCH.sh
./RUN_APP_ARCH.sh
```

---

## System Requirements

### Windows
- Python 3.8+
- pip (Python package manager)
- Modern web browser

### Ubuntu/Debian
- Python 3.8+
- pip3
- OpenCV system dependencies (libsm6, libxext6, libxrender-dev)
- curl or wget (optional, for manual setup)

### Arch Linux
- Python 3.8+
- pip
- opencv (optional, system package)
- curl or wget (optional, for manual setup)

---

## Manual Setup (If Scripts Don't Work)

### 1. Install Python & Dependencies

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv
sudo apt-get install -y libsm6 libxext6 libxrender-dev
```

**Arch Linux:**
```bash
sudo pacman -S python python-pip
sudo pacman -S --needed opencv
```

### 2. Create Virtual Environment
```bash
python3 -m venv venv
```

### 3. Activate Virtual Environment

**Linux/Mac:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### 4. Install Python Packages
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Run the Application
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Then open your browser to: **http://localhost:8000**

---

## Features

✅ **Malaria Detection** - Single image detection of trophozoite parasites
✅ **Dengue Detection** - Batch platelet analysis with clinical risk assessment
✅ **Clinical Aggregation** - Multi-image averaging (10-20 images per sample)
✅ **Risk Levels** - No Risk, Low Risk, Medium Risk, High Risk
✅ **Medical Guidelines** - Context-specific clinical recommendations

---

## Troubleshooting

### Python Not Found
- Make sure Python 3.8+ is installed and in your PATH
- Ubuntu: `sudo apt-get install python3`
- Arch: `sudo pacman -S python`

### Permission Denied (Linux/Mac)
```bash
chmod +x RUN_APP.sh
chmod +x RUN_APP_UBUNTU.sh
chmod +x RUN_APP_ARCH.sh
```

### Port 8000 Already in Use
Edit the run script and change `--port 8000` to a different port number (e.g., 8080)

### OpenCV Import Error
**Ubuntu/Debian:**
```bash
sudo apt-get install -y libsm6 libxext6 libxrender-dev
pip install --upgrade opencv-python
```

**Arch:**
```bash
sudo pacman -S --needed opencv
pip install --upgrade opencv-python
```

### Missing Model Files
Ensure `malaria_best.pt` and `platelet_best.pt` are in the project root directory.

---

## Environment Variables

You can customize the application with these environment variables:

- `PORT` - Change the server port (default: 8000)
- `HOST` - Change the server host (default: 0.0.0.0)
- `MODEL_DIR` - Path to model directory (default: current directory)

**Example:**
```bash
export PORT=8080
export MODEL_DIR=/path/to/models
uvicorn app:app --reload --host 0.0.0.0 --port $PORT
```

---

## File Structure

```
.
├── app.py                    # Main FastAPI application
├── config.py                 # Configuration settings
├── requirements.txt          # Python dependencies
├── RUN_APP.bat              # Windows run script
├── RUN_APP.sh               # Universal Linux script
├── RUN_APP_UBUNTU.sh        # Ubuntu/Debian specific script
├── RUN_APP_ARCH.sh          # Arch Linux specific script
├── models/                  # Model utilities
│   ├── model_loader.py
│   └── image_processor.py
├── static/                  # Frontend files
│   ├── index.html
│   ├── script.js
│   └── style.css
└── Malaria.ipynb            # Model training notebook
└── Platelet.ipynb           # Platelet model training notebook
```

---

## Performance Tips

1. **GPU Support** - Install CUDA for faster inference
   ```bash
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```

2. **Model Caching** - Models are cached after first load

3. **Batch Processing** - For dengue detection, use 10-20 images per sample for best accuracy

---

## Support

For issues or questions, check:
- README.txt for project overview
- Model training notebooks (Malaria.ipynb, Platelet.ipynb)
- Application logs in the console

---

## Disclaimer

⚠️ **Important:** This application is for research and educational purposes only. It is not intended for medical diagnosis or clinical use. Always consult with qualified medical professionals for actual patient diagnosis and treatment.

---

**Last Updated:** January 2026
