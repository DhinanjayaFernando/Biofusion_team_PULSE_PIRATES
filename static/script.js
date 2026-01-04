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
                // Hide dengue assessment for malaria modes
                const dengueSection = document.getElementById('dengue-assessment-section');
                if (dengueSection) dengueSection.classList.add('hidden');
            } else {
                // Hide malaria assessment for non-malaria modes
                const malariaSection = document.getElementById('malaria-assessment-section');
                if (malariaSection) malariaSection.classList.add('hidden');
            }

            // Display dengue assessment if present
            if (data.dengue_interpretation) {
                displayDengueAssessment(data.dengue_interpretation);
            } else {
                // Hide dengue assessment for non-dengue modes
                const dengueSection = document.getElementById('dengue-assessment-section');
                if (dengueSection) dengueSection.classList.add('hidden');
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

    // Store annotated images from all models
    const annotatedImages = [];

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

            // Store annotated image data
            if (uploadData.annotated_image) {
                annotatedImages.push({
                    filename: file.name,
                    image: uploadData.annotated_image,
                    counts: uploadData.counts,
                    imageNumber: uploadData.image_number
                });
            }

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

        // Add annotated images to final data
        finalData.annotated_images = annotatedImages;

        // Display aggregation results (now includes annotated images)
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
    const annotatedImages = data.annotated_images || [];

    // Build annotated images gallery first
    const tableContainer = document.getElementById('batch-images-container');
    if (tableContainer) {
        let galleryHtml = '';

        // Add annotated images gallery if available
        if (annotatedImages.length > 0) {
            galleryHtml += `
                <div class="annotated-gallery-section">
                    <div class="gallery-header" onclick="toggleGallery()">
                        <h4>📸 Annotated Images (${annotatedImages.length})</h4>
                        <span id="gallery-toggle-icon" class="toggle-icon">▼</span>
                    </div>
                    <div id="annotated-gallery" class="annotated-gallery">
                        ${annotatedImages.map((img, idx) => `
                            <div class="annotated-thumb" onclick="showFullImage(${idx})">
                                <img src="${img.image}" alt="Image ${img.imageNumber}" title="${img.filename}">
                                <div class="thumb-label">#${img.imageNumber}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Full Image Modal -->
                <div id="image-modal" class="image-modal hidden" onclick="closeModal(event)">
                    <div class="modal-content" onclick="event.stopPropagation()">
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                        <button class="modal-nav modal-prev" onclick="navigateImage(-1)">❮</button>
                        <div class="modal-image-container">
                            <img id="modal-image" src="" alt="Full size annotated image">
                            <div id="modal-caption" class="modal-caption"></div>
                        </div>
                        <button class="modal-nav modal-next" onclick="navigateImage(1)">❯</button>
                    </div>
                </div>
            `;

            // Store annotated images globally for modal navigation
            window.annotatedImagesData = annotatedImages;
            window.currentImageIndex = 0;
        }

        // Add per-image results table in a table section
        galleryHtml += `
            <div class="table-section">
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
            galleryHtml += `<tr><td>${index + 1}</td>`;

            Object.entries(counts).forEach(([className, count]) => {
                if (className !== 'Difficult') {
                    galleryHtml += `<td>${count}</td>`;
                    totals[className] = (totals[className] || 0) + count;
                }
            });

            galleryHtml += `<td><strong>${total}</strong></td></tr>`;
        });

        // Add totals row
        const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
        galleryHtml += `<tr class="totals-row"><td><strong>Total</strong></td>`;
        Object.values(totals).forEach(val => {
            galleryHtml += `<td><strong>${val}</strong></td>`;
        });
        galleryHtml += `<td><strong>${grandTotal}</strong></td></tr>`;

        // Add averages row - use aggregation.images_count for consistency with backend
        const numImages = aggregation.images_count || individualImages.length;
        galleryHtml += `<tr class="averages-row"><td><strong>Average</strong></td>`;
        Object.values(totals).forEach(val => {
            galleryHtml += `<td><strong>${(val / numImages).toFixed(2)}</strong></td>`;
        });
        galleryHtml += `<td><strong>${(grandTotal / numImages).toFixed(2)}</strong></td></tr>`;

        galleryHtml += '</tbody></table></div>';
        tableContainer.innerHTML = galleryHtml;
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

function displayDengueAssessment(interpretation) {
    const dengueSection = document.getElementById('dengue-assessment-section');
    const dengueDisplay = document.getElementById('dengue-assessment-display');

    if (!dengueSection || !dengueDisplay) return;

    dengueSection.classList.remove('hidden');

    const status = interpretation.clinical_status;
    const severity = status.severity || 'normal';
    const estimatedCount = interpretation.estimated_platelets_per_ul;

    dengueDisplay.innerHTML = `
        <div class="dengue-result ${severity}">
            <div class="dengue-estimate-cards">
                <div class="dengue-card">
                    <div class="label">Platelets Detected</div>
                    <div class="value">${interpretation.platelet_count}</div>
                </div>
                <div class="dengue-card highlight">
                    <div class="label">Estimated Count</div>
                    <div class="value">${Number(estimatedCount).toLocaleString()}/µL</div>
                </div>
            </div>
            
            <div class="dengue-status-header">
                <div class="risk-badge ${severity}">
                    ${getRiskIcon(severity)} ${status.risk_level}
                </div>
            </div>
            <div class="status-badge ${severity}">
                <strong>${status.status}</strong><br>
                <span>${status.range}</span>
            </div>
            <p class="interpretation-text">${status.interpretation}</p>
            
            <div class="dengue-disclaimer">
                <strong>⚠️ Single Field Estimate</strong>
                <p>${interpretation.disclaimer}</p>
            </div>
        </div>
    `;
}

function showError(message) {
    // Handle error objects
    if (typeof message === 'object') {
        message = message.message || message.detail || JSON.stringify(message);
    }
    error.textContent = `Error: ${message}`;
    error.classList.remove('hidden');
}

// ============ ANNOTATED IMAGES GALLERY FUNCTIONS ============

// Toggle gallery visibility
function toggleGallery() {
    const gallery = document.getElementById('annotated-gallery');
    const toggleIcon = document.getElementById('gallery-toggle-icon');

    if (gallery && toggleIcon) {
        gallery.classList.toggle('collapsed');
        toggleIcon.textContent = gallery.classList.contains('collapsed') ? '▶' : '▼';
    }
}

// Show full-size image in modal
function showFullImage(index) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption');

    if (!modal || !modalImage || !window.annotatedImagesData) return;

    window.currentImageIndex = index;
    const imageData = window.annotatedImagesData[index];

    modalImage.src = imageData.image;

    // Build caption with counts
    let countText = '';
    if (imageData.counts) {
        countText = Object.entries(imageData.counts)
            .filter(([key]) => key !== 'Difficult')
            .map(([key, val]) => `${key}: ${val}`)
            .join(' | ');
    }

    modalCaption.innerHTML = `
        <strong>Image #${imageData.imageNumber}</strong> - ${imageData.filename}
        <br><span class="count-summary">${countText}</span>
    `;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

// Close the image modal
function closeModal(event) {
    // If event passed, only close if clicking the backdrop
    if (event && event.target.id !== 'image-modal') return;

    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // Restore scroll
    }
}

// Navigate between images in modal
function navigateImage(direction) {
    if (!window.annotatedImagesData) return;

    const newIndex = window.currentImageIndex + direction;

    // Wrap around
    if (newIndex < 0) {
        showFullImage(window.annotatedImagesData.length - 1);
    } else if (newIndex >= window.annotatedImagesData.length) {
        showFullImage(0);
    } else {
        showFullImage(newIndex);
    }
}

// Keyboard navigation for modal
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('image-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
        closeModal();
    } else if (e.key === 'ArrowLeft') {
        navigateImage(-1);
    } else if (e.key === 'ArrowRight') {
        navigateImage(1);
    }
});


