const imageInput = document.getElementById('image-input');
const modeSelect = document.getElementById('mode-select');
const detectBtn = document.getElementById('detect-btn');
const resultsSection = document.getElementById('results-section');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const originalImg = document.getElementById('original-img');
const annotatedImg = document.getElementById('annotated-img');
const countsDisplay = document.getElementById('counts-display');

let selectedFile = null;

// Check available models on page load
async function checkAvailableModels() {
    try {
        const response = await fetch('/api/models');
        const data = await response.json();
        
        // Update dropdown options based on available models
        const availableModes = data.available_modes || [];
        const modelsInfo = data.models || {};
        
        // Clear all existing options
        modeSelect.innerHTML = '';
        
        // Add available model options
        if (availableModes.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models available';
            option.disabled = true;
            modeSelect.appendChild(option);
        } else {
            availableModes.forEach(mode => {
                if (modelsInfo[mode] && modelsInfo[mode].available) {
                    const option = document.createElement('option');
                    option.value = mode;
                    // Use the name from config, which matches what we want
                    option.textContent = modelsInfo[mode].name;
                    modeSelect.appendChild(option);
                }
            });
        }
        
        // Show info if some models are unavailable
        const allModes = Object.keys(modelsInfo);
        const unavailableModes = allModes.filter(mode => !modelsInfo[mode].available);
        
        if (unavailableModes.length > 0) {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'info-message';
            const unavailableNames = unavailableModes.map(m => modelsInfo[m].name).join(', ');
            infoDiv.innerHTML = `<strong>ℹ️ Note:</strong> Some models are not available: ${unavailableNames}. Only available models are shown.`;
            modeSelect.parentElement.appendChild(infoDiv);
        }
    } catch (err) {
        console.error('Failed to check available models:', err);
    }
}

// Initialize on page load
checkAvailableModels();

// Handle file selection
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedFile = file;
        detectBtn.disabled = false;
        
        // Preview original image
        const reader = new FileReader();
        reader.onload = (event) => {
            originalImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
        
        // Hide previous results
        resultsSection.classList.add('hidden');
        error.classList.add('hidden');
    }
});

// Handle detect button click
detectBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('Please select an image first');
        return;
    }

    // Show loading, hide results and error
    loading.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    error.classList.add('hidden');
    detectBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('mode', modeSelect.value);

        const response = await fetch('/detect', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Detection failed');
        }

        const data = await response.json();

        if (data.success) {
            // Display annotated image
            annotatedImg.src = data.annotated_image;
            
            // Display counts
            displayCounts(data.counts, data.mode);
            
            // Show results
            resultsSection.classList.remove('hidden');
        } else {
            throw new Error('Detection failed');
        }
    } catch (err) {
        showError(err.message || 'An error occurred during detection');
    } finally {
        loading.classList.add('hidden');
        detectBtn.disabled = false;
    }
});

function displayCounts(counts, mode) {
    countsDisplay.innerHTML = '';
    
    if (mode === 'malaria') {
        // Malaria model: Display total trophozoite count
        // The model only detects trophozoite, so show total count
        const totalCount = counts.Trophozoite || counts.Total || Object.values(counts)[0] || 0;
        const card = document.createElement('div');
        card.className = 'count-card';
        card.innerHTML = `
            <div class="label">Trophozoites Detected</div>
            <div class="value">${totalCount}</div>
        `;
        countsDisplay.appendChild(card);
    } else {
        // Platelet model: Display counts for WBC, RBC, and Platelet
        Object.entries(counts).forEach(([className, count]) => {
            const card = document.createElement('div');
            card.className = 'count-card';
            card.innerHTML = `
                <div class="label">${className}</div>
                <div class="value">${count}</div>
            `;
            countsDisplay.appendChild(card);
        });
    }
}

function showError(message) {
    error.textContent = `Error: ${message}`;
    error.classList.remove('hidden');
}

