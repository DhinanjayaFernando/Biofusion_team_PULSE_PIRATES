// DOM Elements - Unified System
const modeSelect = document.getElementById('mode-select');
const uploadSection = document.getElementById('upload-section');
const unifiedImageInput = document.getElementById('unified-image-input');
const imagesInfo = document.getElementById('images-info');
const imagesSelectedCount = document.getElementById('images-selected-count');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsSection = document.getElementById('results-section');
const singleResultsSection = document.getElementById('single-results-section');
const aggregationResultsSection = document.getElementById('aggregation-results-section');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const originalImg = document.getElementById('original-img');
const annotatedImg = document.getElementById('annotated-img');
const countsDisplay = document.getElementById('counts-display');

// State
let selectedFiles = [];
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

        // Trigger change event to show upload section if a model is selected
        if (modeSelect.value) {
            modeSelect.dispatchEvent(new Event('change'));
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

    if (selectedMode) {
        // Show upload section
        uploadSection.classList.remove('hidden');

        // Reset file selection
        selectedFiles = [];
        unifiedImageInput.value = '';
        updateFilePreview();

        // Hide previous results
        resultsSection.classList.add('hidden');
        error.classList.add('hidden');
    } else {
        // No selection - hide upload section
        uploadSection.classList.add('hidden');
    }
});

// ============ UNIFIED IMAGE UPLOAD ============

// Handle file selection
unifiedImageInput.addEventListener('change', (e) => {
    const newFiles = Array.from(e.target.files);
    // Add new files to existing selection
    selectedFiles = [...selectedFiles, ...newFiles];
    // Reset input so count doesn't show misleadingly
    unifiedImageInput.value = '';
    updateFilePreview();
});

// Update file preview display
function updateFilePreview() {
    const previewContainer = document.getElementById('selected-images-preview');
    const imagesList = document.getElementById('selected-images-list');

    imagesSelectedCount.textContent = selectedFiles.length;

    if (selectedFiles.length > 0) {
        analyzeBtn.disabled = false;
        imagesInfo.classList.remove('hidden');
        previewContainer.classList.remove('hidden');

        // Update button text based on count
        analyzeBtn.textContent = selectedFiles.length === 1 ? 'Analyze Image' : `Analyze ${selectedFiles.length} Images`;

        // Clear and rebuild the list
        imagesList.innerHTML = '';

        selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'selected-image-item';

            // Create thumbnail
            const thumbnail = document.createElement('img');
            thumbnail.className = 'image-thumbnail';
            thumbnail.alt = file.name;

            // Read file for thumbnail preview
            const reader = new FileReader();
            reader.onload = (e) => {
                thumbnail.src = e.target.result;
            };
            reader.readAsDataURL(file);

            item.innerHTML = `
                <div class="image-thumb-container"></div>
                <span class="file-name" title="${file.name}">${file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}</span>
                <button class="remove-image-btn" data-index="${index}" title="Remove this image">×</button>
            `;

            // Insert thumbnail into container
            item.querySelector('.image-thumb-container').appendChild(thumbnail);
            imagesList.appendChild(item);
        });

        // Add remove button listeners
        document.querySelectorAll('.remove-image-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                selectedFiles.splice(index, 1);
                updateFilePreview();
            });
        });

        // Show warning if 2-9 images (recommend 10-20 for batch)
        const oldWarning = document.querySelector('.batch-warning');
        if (oldWarning) oldWarning.remove();

        if (selectedFiles.length >= 2 && selectedFiles.length < 10) {
            const warning = document.createElement('small');
            warning.style.color = '#ff9800';
            warning.innerHTML = `⚠️ For best batch results, use 10-20 images (you have ${selectedFiles.length})`;
            warning.className = 'batch-warning';
            unifiedImageInput.parentElement.appendChild(warning);
        }
    } else {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyze Images';
        imagesInfo.classList.add('hidden');
        previewContainer.classList.add('hidden');
        imagesList.innerHTML = '';
        const oldWarning = document.querySelector('.batch-warning');
        if (oldWarning) oldWarning.remove();
    }

    // Hide previous results
    resultsSection.classList.add('hidden');
    error.classList.add('hidden');
}

// Clear all button handler
document.getElementById('clear-all-btn').addEventListener('click', () => {
    selectedFiles = [];
    unifiedImageInput.value = '';
    updateFilePreview();
});

// Handle analyze button click
analyzeBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        showError('Please select at least one image');
        return;
    }

    const mode = modeSelect.value;
    if (!mode) {
        showError('Please select an analysis type');
        return;
    }

    if (selectedFiles.length === 1) {
        // Single image analysis
        await processSingleImage(selectedFiles[0], mode);
    } else {
        // Batch analysis
        await processBatchImages(selectedFiles, mode);
    }
});

// Process single image
async function processSingleImage(file, mode) {
    loading.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    error.classList.add('hidden');
    analyzeBtn.disabled = true;

    // Preview original image
    const reader = new FileReader();
    reader.onload = (event) => {
        originalImg.src = event.target.result;
    };
    reader.readAsDataURL(file);

    try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('mode', mode);

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

            // Display malaria assessment if present
            if (data.malaria_interpretation) {
                displayMalariaAssessment(data.malaria_interpretation);
            } else {
                // Hide malaria assessment for non-malaria modes
                const malariaSection = document.getElementById('malaria-assessment-section');
                if (malariaSection) malariaSection.classList.add('hidden');
            }

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
        analyzeBtn.disabled = false;
    }
}

// Process batch images
async function processBatchImages(files, mode) {
    loading.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    error.classList.add('hidden');
    analyzeBtn.disabled = true;

    try {
        // Create aggregation session
        const sessionFormData = new FormData();
        sessionFormData.append('mode', mode);
        sessionFormData.append('magnification', '100x_oil');

        const sessionResponse = await fetch('/api/aggregation/start', {
            method: 'POST',
            body: sessionFormData
        });

        if (!sessionResponse.ok) {
            const errorData = await sessionResponse.json();
            throw new Error(errorData.detail || 'Failed to start aggregation session');
        }

        const sessionData = await sessionResponse.json();
        currentAggregationSession = sessionData.session_id;

        // Upload images one by one
        const totalImages = files.length;
        let processedImages = 0;
        const batchImagesContainer = document.getElementById('batch-images-container');
        if (batchImagesContainer) batchImagesContainer.innerHTML = '';

        singleResultsSection.style.display = 'none';
        aggregationResultsSection.style.display = 'block';
        resultsSection.classList.remove('hidden');

        for (const file of files) {
            const formData = new FormData();
            formData.append('session_id', currentAggregationSession);
            formData.append('image', file);
            formData.append('mode', mode);

            const uploadResponse = await fetch('/api/aggregation/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                console.error(`Failed to upload ${file.name}`);
                continue;
            }

            const uploadData = await uploadResponse.json();
            processedImages++;

            // Update progress
            const progressPercent = Math.round((processedImages / totalImages) * 100);
            const progressFill = document.getElementById('progress-fill');
            const currentCount = document.getElementById('current-image-count');
            const totalCount = document.getElementById('total-images-count');

            if (progressFill) progressFill.style.width = `${progressPercent}%`;
            if (currentCount) currentCount.textContent = processedImages;
            if (totalCount) totalCount.textContent = totalImages;
        }

        // Finalize aggregation
        const finalizeFormData = new FormData();
        finalizeFormData.append('session_id', currentAggregationSession);

        const finalizeResponse = await fetch('/api/aggregation/finalize', {
            method: 'POST',
            body: finalizeFormData
        });

        if (!finalizeResponse.ok) {
            throw new Error('Failed to finalize aggregation');
        }

        const finalData = await finalizeResponse.json();

        // Display aggregation results
        displayAggregationResults(finalData);

    } catch (err) {
        showError(err.message || 'An error occurred during batch processing');
    } finally {
        loading.classList.add('hidden');
        analyzeBtn.disabled = false;
    }
}

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
        // Default: Display all counts (filter out "Difficult" class for malaria_multi)
        Object.entries(counts).forEach(([className, count]) => {
            // Skip "Difficult" class in UI display
            if (className === 'Difficult') return;

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

function displayAggregationResults(data) {
    const mode = data.mode || 'dengue';
    const aggregation = data.aggregation;
    const clinicalInterpretation = data.clinical_interpretation;
    const individualImages = data.individual_images || [];

    // Build per-image results table
    const tableContainer = document.getElementById('batch-images-container');
    if (tableContainer) {
        let tableHtml = `
            <h4>Per-Image Detection Results</h4>
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Image #</th>
                        ${getTableHeaders(individualImages[0] || {}, mode)}
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let totals = {};
        individualImages.forEach((counts, index) => {
            const total = Object.values(counts).reduce((sum, val) => sum + val, 0);
            tableHtml += `<tr><td>${index + 1}</td>`;

            Object.entries(counts).forEach(([className, count]) => {
                if (className !== 'Difficult') {
                    tableHtml += `<td>${count}</td>`;
                    totals[className] = (totals[className] || 0) + count;
                }
            });

            tableHtml += `<td><strong>${total}</strong></td></tr>`;
        });

        // Add totals row
        const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
        tableHtml += `<tr class="totals-row"><td><strong>Total</strong></td>`;
        Object.values(totals).forEach(val => {
            tableHtml += `<td><strong>${val}</strong></td>`;
        });
        tableHtml += `<td><strong>${grandTotal}</strong></td></tr>`;

        // Add averages row
        const numImages = individualImages.length;
        tableHtml += `<tr class="averages-row"><td><strong>Average</strong></td>`;
        Object.values(totals).forEach(val => {
            tableHtml += `<td><strong>${(val / numImages).toFixed(1)}</strong></td>`;
        });
        tableHtml += `<td><strong>${(grandTotal / numImages).toFixed(1)}</strong></td></tr>`;

        tableHtml += '</tbody></table>';
        tableContainer.innerHTML = tableHtml;
    }

    // Update summary stats
    const totalDetections = document.getElementById('total-detections');
    const imagesProcessed = document.getElementById('images-processed-count');
    const avgPerImage = document.getElementById('avg-platelets-per-image');
    const perUl = document.getElementById('platelets-per-ul');

    // Normalize mode string
    const modeNormalized = mode ? mode.toLowerCase() : 'dengue';

    if (totalDetections) totalDetections.textContent = aggregation.total_detections || 0;
    if (imagesProcessed) imagesProcessed.textContent = aggregation.images_count || 0;

    if (modeNormalized.includes('dengue')) {
        // Dengue mode - show platelet-specific stats
        if (avgPerImage) {
            avgPerImage.textContent = aggregation.avg_platelets_per_image ? aggregation.avg_platelets_per_image.toFixed(2) : '0.00';
            const label = avgPerImage.previousElementSibling;
            if (label) label.textContent = 'Average per Image';
        }

        if (perUl) {
            perUl.textContent = Number(aggregation.platelets_per_ul || 0).toLocaleString();
            // Ensure label helps context
            const label = perUl.previousElementSibling;
            if (label) {
                label.textContent = 'Platelet Count (per µL)';
                label.style.textTransform = 'none'; // Prevent uppercase transformation
            }
            // Make sure parent is visible
            perUl.parentElement.style.display = 'flex';
        }
    } else {
        // Malaria modes - show parasite counts
        const totalParasites = clinicalInterpretation.total_parasites || 0;
        if (totalDetections) totalDetections.textContent = totalParasites;

        if (avgPerImage) {
            avgPerImage.textContent = (totalParasites / (aggregation.images_count || 1)).toFixed(2);
            // Update label for malaria
            const label = avgPerImage.previousElementSibling;
            if (label) label.textContent = 'Avg Parasites/Image';
        }

        // Ensure platelet card is hidden for malaria unless explicitly needed
        if (perUl) perUl.parentElement.style.display = 'none';
    }

    // Update clinical interpretation
    const clinicalStatusDisplay = document.getElementById('clinical-status-display');
    if (clinicalStatusDisplay) {
        const severity = clinicalInterpretation.severity || 'normal';

        if (mode === 'dengue') {
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
        } else {
            // Malaria interpretation
            clinicalStatusDisplay.innerHTML = `
                <div class="risk-assessment-header">
                    <div class="risk-badge ${severity}">
                        ${getMalariaIcon(severity)} ${clinicalInterpretation.risk_level || clinicalInterpretation.status}
                    </div>
                </div>
                <div class="status-badge ${severity}">
                    <strong>${clinicalInterpretation.status}</strong>
                </div>
                ${clinicalInterpretation.parasite_breakdown ? `
                    <div class="parasite-breakdown">
                        <h5>Parasites Detected:</h5>
                        <ul>
                            ${Object.entries(clinicalInterpretation.parasite_breakdown)
                        .map(([name, count]) => `<li>${name}: <strong>${count}</strong></li>`)
                        .join('')}
                        </ul>
                        <p class="total-parasites">Total: <strong>${clinicalInterpretation.total_parasites}</strong> parasites</p>
                    </div>
                ` : ''}
                <p class="interpretation-text">${clinicalInterpretation.interpretation}</p>
                <p class="malaria-recommendation"><strong>Recommendation:</strong> ${clinicalInterpretation.recommendation}</p>
                ${clinicalInterpretation.guidelines ? `
                    <div class="risk-guidelines">
                        <h5>📋 Clinical Guidelines</h5>
                        <ul>
                            ${clinicalInterpretation.guidelines.map(g => `<li>${g}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            `;
        }
    }
}

function getTableHeaders(sampleCounts, mode) {
    return Object.keys(sampleCounts)
        .filter(key => key !== 'Difficult')
        .map(key => `<th>${key}</th>`)
        .join('');
}

function getRiskIcon(severity) {
    switch (severity) {
        case 'normal': return '✅';
        case 'mild': return '⚠️';
        case 'moderate': return '⚠️⚠️';
        case 'severe': return '🚨';
        default: return '❓';
    }
}

function getRiskGuidelines(severity) {
    switch (severity) {
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

function displayMalariaAssessment(interpretation) {
    const malariaSection = document.getElementById('malaria-assessment-section');
    const malariaDisplay = document.getElementById('malaria-assessment-display');

    if (!malariaSection || !malariaDisplay) return;

    malariaSection.classList.remove('hidden');

    const severity = interpretation.severity || 'negative';
    const infected = interpretation.infected;

    // Build parasite breakdown HTML if positive
    let breakdownHtml = '';
    if (interpretation.parasite_breakdown && Object.keys(interpretation.parasite_breakdown).length > 0) {
        breakdownHtml = `
            <div class="parasite-breakdown">
                <h5>Parasites Detected:</h5>
                <ul>
                    ${Object.entries(interpretation.parasite_breakdown)
                .map(([name, count]) => `<li>${name}: <strong>${count}</strong></li>`)
                .join('')}
                </ul>
                <p class="total-parasites">Total: <strong>${interpretation.total_parasites}</strong> parasites</p>
            </div>
        `;
    }

    // Build guidelines HTML
    const guidelinesHtml = interpretation.guidelines ? `
        <div class="malaria-guidelines">
            <h5>📋 Clinical Guidelines</h5>
            <ul>
                ${interpretation.guidelines.map(g => `<li>${g}</li>`).join('')}
            </ul>
        </div>
    ` : '';

    malariaDisplay.innerHTML = `
        <div class="malaria-result ${severity}">
            <div class="malaria-status-header">
                <div class="malaria-badge ${severity}">
                    ${getMalariaIcon(severity)} ${interpretation.risk_level}
                </div>
            </div>
            <div class="malaria-status-badge ${severity}">
                <strong>${interpretation.status}</strong>
            </div>
            ${breakdownHtml}
            <p class="malaria-interpretation">${interpretation.interpretation}</p>
            <p class="malaria-recommendation"><strong>Recommendation:</strong> ${interpretation.recommendation}</p>
            ${guidelinesHtml}
        </div>
    `;
}

function getMalariaIcon(severity) {
    switch (severity) {
        case 'negative': return '✅';
        case 'low': return '⚠️';
        case 'moderate': return '⚠️⚠️';
        case 'high': return '🚨';
        default: return '❓';
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


