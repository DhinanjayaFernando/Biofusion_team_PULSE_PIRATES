// DOM Elements - Single Image Mode
const imageInput = document.getElementById('image-input');
const modeSelect = document.getElementById('mode-select');
const detectBtn = document.getElementById('detect-btn');
const resultsSection = document.getElementById('results-section');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const originalImg = document.getElementById('original-img');
const annotatedImg = document.getElementById('annotated-img');
const countsDisplay = document.getElementById('counts-display');

// DOM Elements - Aggregation Mode
const singleImageSection = document.getElementById('single-image-section');
const aggregationSection = document.getElementById('aggregation-section');
const batchImagesInput = document.getElementById('batch-images-input');
const imagesSelectedCount = document.getElementById('images-selected-count');
const startAggregationBtn = document.getElementById('start-aggregation-btn');
const singleResultsSection = document.getElementById('single-results-section');
const aggregationResultsSection = document.getElementById('aggregation-results-section');

// State
let selectedFile = null;
let batchFiles = [];
let currentAggregationSession = null;

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

// Handle mode selection change
modeSelect.addEventListener('change', (e) => {
    const selectedMode = e.target.value;
    
    if (selectedMode === 'dengue') {
        // Show aggregation mode for dengue
        singleImageSection.style.display = 'none';
        aggregationSection.style.display = 'block';
    } else if (selectedMode === 'malaria') {
        // Show single image mode for malaria
        singleImageSection.style.display = 'block';
        aggregationSection.style.display = 'none';
    } else {
        // No selection
        singleImageSection.style.display = 'block';
        aggregationSection.style.display = 'none';
    }
});

// ============ SINGLE IMAGE MODE ============

// Handle single file selection
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

// Handle single detect button click
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
            try {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Detection failed');
            } catch (parseErr) {
                throw new Error(`Detection failed (HTTP ${response.status})`);
            }
        }

        const data = await response.json();

        if (data.success) {
            // Display annotated image
            annotatedImg.src = data.annotated_image;
            
            // Display counts
            displayCounts(data.counts, data.mode);
            
            // Show results
            singleResultsSection.style.display = 'block';
            aggregationResultsSection.style.display = 'none';
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

// ============ BATCH AGGREGATION MODE ============

// Handle batch file selection
batchImagesInput.addEventListener('change', (e) => {
    batchFiles = Array.from(e.target.files);
    imagesSelectedCount.textContent = batchFiles.length;
    
    if (batchFiles.length > 0) {
        startAggregationBtn.disabled = false;
        
        if (batchFiles.length < 10) {
            const warning = document.createElement('small');
            warning.style.color = '#ff9800';
            warning.innerHTML = `⚠️ Recommended: 10-20 images for accurate aggregation (you have ${batchFiles.length})`;
            // Remove old warning if exists
            const oldWarning = document.querySelector('.batch-warning');
            if (oldWarning) oldWarning.remove();
            warning.className = 'batch-warning';
            batchImagesInput.parentElement.appendChild(warning);
        }
    } else {
        startAggregationBtn.disabled = true;
    }
    
    // Hide previous results
    resultsSection.classList.add('hidden');
    error.classList.add('hidden');
});

// Handle batch processing
startAggregationBtn.addEventListener('click', async () => {
    if (batchFiles.length === 0) {
        showError('Please select at least one image');
        return;
    }
    
    // Start aggregation session
    try {
        loading.classList.remove('hidden');
        resultsSection.classList.add('hidden');
        error.classList.add('hidden');
        startAggregationBtn.disabled = true;
        
        // Create aggregation session
        const sessionFormData = new FormData();
        sessionFormData.append('mode', modeSelect.value);  // Use selected mode, not hardcoded 'platelet'
        const sessionResponse = await fetch('/api/aggregation/start', {
            method: 'POST',
            body: sessionFormData
        });
        
        if (!sessionResponse.ok) {
            try {
                const errorData = await sessionResponse.json();
                throw new Error(errorData.detail || 'Failed to start aggregation session');
            } catch (parseErr) {
                throw new Error(`Failed to start aggregation session (HTTP ${sessionResponse.status})`);
            }
        }
        
        const sessionData = await sessionResponse.json();
        currentAggregationSession = sessionData.session_id;
        
        console.log('Started aggregation session:', currentAggregationSession);
        
        // Upload images one by one
        const totalImages = batchFiles.length;
        let processedImages = 0;
        const batchImagesContainer = document.getElementById('batch-images-container');
        batchImagesContainer.innerHTML = '';  // Clear previous images
        
        singleResultsSection.style.display = 'none';
        aggregationResultsSection.style.display = 'block';
        resultsSection.classList.remove('hidden');
        
        for (let i = 0; i < batchFiles.length; i++) {
            const file = batchFiles[i];
            
            // Update progress
            processedImages = i + 1;
            document.getElementById('current-image-count').textContent = processedImages;
            document.getElementById('total-images-count').textContent = totalImages;
            document.getElementById('progress-fill').style.width = ((processedImages / totalImages) * 100) + '%';
            
            try {
                const formData = new FormData();
                formData.append('session_id', currentAggregationSession);
                formData.append('image', file);
                
                const uploadResponse = await fetch('/api/aggregation/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    try {
                        const errorData = await uploadResponse.json();
                        console.error(`Error processing image ${processedImages}:`, errorData.detail);
                    } catch (parseErr) {
                        console.error(`Error processing image ${processedImages}: HTTP ${uploadResponse.status}`);
                    }
                    continue;
                }
                
                const uploadData = await uploadResponse.json();
                console.log(`Processed image ${processedImages}:`, uploadData.counts);
                
                // Display annotated image
                if (uploadData.annotated_image) {
                    const imageCard = document.createElement('div');
                    imageCard.className = 'batch-image-card';
                    imageCard.innerHTML = `
                        <div class="batch-image-number">Image ${processedImages}</div>
                        <img src="${uploadData.annotated_image}" alt="Annotated image ${processedImages}" class="batch-image">
                        <div class="batch-image-counts">
                            ${Object.entries(uploadData.counts).map(([className, count]) => 
                                `<span>${className}: ${count}</span>`
                            ).join('')}
                        </div>
                    `;
                    batchImagesContainer.appendChild(imageCard);
                }
            } catch (err) {
                console.error(`Error uploading image ${processedImages}:`, err);
            }
        }
        
        // Finalize aggregation
        console.log('Finalizing aggregation...');
        const finalizeFormData = new FormData();
        finalizeFormData.append('session_id', currentAggregationSession);
        const finalizeResponse = await fetch('/api/aggregation/finalize', {
            method: 'POST',
            body: finalizeFormData
        });
        
        if (!finalizeResponse.ok) {
            try {
                const errorData = await finalizeResponse.json();
                throw new Error(errorData.detail || 'Failed to finalize aggregation');
            } catch (parseErr) {
                throw new Error(`Failed to finalize aggregation (HTTP ${finalizeResponse.status})`);
            }
        }
        
        const finalData = await finalizeResponse.json();
        console.log('Aggregation result:', finalData);
        
        // Display aggregated results
        displayAggregationResults(finalData.aggregation, finalData.clinical_interpretation);
        
    } catch (err) {
        showError(err.message || 'An error occurred during batch processing');
    } finally {
        loading.classList.add('hidden');
        startAggregationBtn.disabled = batchFiles.length === 0;
    }
});

function displayCounts(counts, mode) {
    countsDisplay.innerHTML = '';
    
    if (mode === 'malaria') {
        // Malaria model: Display total trophozoite count
        const totalCount = counts.Trophozoite || counts.Total || Object.values(counts)[0] || 0;
        const card = document.createElement('div');
        card.className = 'count-card';
        card.innerHTML = `
            <div class="label">Trophozoites Detected</div>
            <div class="value">${totalCount}</div>
        `;
        countsDisplay.appendChild(card);
    } else if (mode === 'dengue') {
        // Dengue model: Display counts for WBC, RBC, and Platelet
        Object.entries(counts).forEach(([className, count]) => {
            const card = document.createElement('div');
            card.className = 'count-card';
            card.innerHTML = `
                <div class="label">${className}</div>
                <div class="value">${count}</div>
            `;
            countsDisplay.appendChild(card);
        });
    } else {
        // Default: Display all counts
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

function displayAggregationResults(aggregation, clinicalInterpretation) {
    // Update aggregation cards
    document.getElementById('total-detections').textContent = aggregation.total_detections;
    document.getElementById('images-processed-count').textContent = aggregation.images_count;
    document.getElementById('avg-platelets-per-image').textContent = aggregation.avg_platelets_per_image.toFixed(2);
    document.getElementById('platelets-per-ul').textContent = Number(aggregation.platelets_per_ul).toLocaleString();
    
    // Update clinical interpretation with risk assessment
    const clinicalStatusDisplay = document.getElementById('clinical-status-display');
    const severity = clinicalInterpretation.severity || 'normal';
    
    clinicalStatusDisplay.innerHTML = `
        <div class="risk-assessment-header">
            <div class="risk-badge ${severity}">
                ${getRiskIcon(severity)} ${clinicalInterpretation.risk_level}
            </div>
        </div>
        <div class="status-badge ${severity}">
            <strong>${clinicalInterpretation.status}</strong><br>
            <span>${clinicalInterpretation.range}</span>
        </div>
        <p class="interpretation-text">${clinicalInterpretation.interpretation}</p>
        <div class="risk-guidelines">
            <h5>📋 Clinical Guidelines</h5>
            ${getRiskGuidelines(severity)}
        </div>
    `;
}

function getRiskIcon(severity) {
    switch(severity) {
        case 'normal': return '✅';
        case 'mild': return '⚠️';
        case 'moderate': return '⚠️⚠️';
        case 'severe': return '🚨';
        default: return '❓';
    }
}

function getRiskGuidelines(severity) {
    switch(severity) {
        case 'normal':
            return `
                <ul>
                    <li>No dengue-related complications expected</li>
                    <li>Continue routine monitoring</li>
                    <li>Standard precautions apply</li>
                </ul>
            `;
        case 'mild':
            return `
                <ul>
                    <li>Monitor platelet count every 24-48 hours</li>
                    <li>Watch for warning signs: bleeding, petechiae, ecchymosis</li>
                    <li>Ensure adequate hydration and rest</li>
                    <li>Avoid NSAIDs and aspirin</li>
                </ul>
            `;
        case 'moderate':
            return `
                <ul>
                    <li><strong>Urgent:</strong> Daily platelet monitoring required</li>
                    <li>Watch for warning signs: severe abdominal pain, persistent vomiting, bleeding</li>
                    <li>Prepare for possible transfusion</li>
                    <li>Close clinical observation recommended</li>
                    <li>Avoid NSAIDs and aspirin</li>
                </ul>
            `;
        case 'severe':
            return `
                <ul>
                    <li><strong>CRITICAL:</strong> Immediate medical intervention required</li>
                    <li>Continuous monitoring and frequent platelet counts</li>
                    <li>Prepare for blood/platelet transfusion</li>
                    <li>ICU monitoring recommended</li>
                    <li>High risk of hemorrhagic fever and shock</li>
                </ul>
            `;
        default:
            return '<p>Unable to determine risk level</p>';
    }
}

function showError(message) {
    // Handle error objects
    if (typeof message === 'object') {
        message = message.message || message.detail || JSON.stringify(message);
    }
    error.textContent = `Error: ${message}`;
    error.classList.remove('hidden');
}


