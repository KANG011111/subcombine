// 字幕合併工具 JavaScript
class SubtitleMerger {
    constructor() {
        this.files = [];
        this.gaps = [];
        this.currentGapIndex = -1;
        this.isProcessing = false;
        this.defaultGap = 0.5;
        this.preserveEmpty = true;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        // 拖放事件
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // 檔案選擇事件
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            // 清空 input 以允許重複選擇相同檔案
            e.target.value = '';
        });

        // 點擊拖放區域觸發檔案選擇
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // 設定變更事件
        document.getElementById('defaultGap').addEventListener('change', (e) => {
            this.defaultGap = parseFloat(e.target.value);
            this.updatePreview();
        });

        document.getElementById('preserveEmpty').addEventListener('change', (e) => {
            this.preserveEmpty = e.target.checked;
        });
    }

    async handleFiles(fileList) {
        console.log('收到檔案列表:', Array.from(fileList).map(f => f.name));
        
        const srtFiles = Array.from(fileList).filter(file => 
            file.name.toLowerCase().endsWith('.srt'));

        console.log('過濾後的SRT檔案:', srtFiles.map(f => f.name));

        if (srtFiles.length === 0) {
            this.showError('請選擇 .srt 格式的字幕檔案');
            return;
        }

        // 不清空現有檔案，改為累加模式
        // this.files = [];
        // this.gaps = [];

        // 讀取並處理檔案
        console.log('開始處理檔案:', srtFiles.map(f => f.name));
        console.log('目前已有檔案:', this.files.map(f => f.name));
        
        for (const file of srtFiles) {
            // 檢查是否已經存在相同檔名
            if (this.files.some(existingFile => existingFile.name === file.name)) {
                console.log(`檔案 ${file.name} 已存在，跳過`);
                continue;
            }

            try {
                console.log(`開始讀取檔案: ${file.name}, 大小: ${file.size} bytes`);
                const content = await this.readFile(file);
                console.log(`檔案內容長度: ${content.length} 字符`);
                const subtitles = this.parseSRT(content);
                console.log(`解析到 ${subtitles.length} 個字幕條目`);
                
                this.files.push({
                    name: file.name,
                    size: file.size,
                    content: content,
                    subtitles: subtitles,
                    duration: this.calculateDuration(subtitles),
                    count: subtitles.length
                });
                console.log(`成功加入檔案: ${file.name}, 總檔案數: ${this.files.length}`);
            } catch (error) {
                console.error(`讀取檔案 ${file.name} 失敗:`, error);
                this.showError(`讀取檔案 ${file.name} 失敗`);
            }
        }

        // 排序檔案
        this.sortFilesByName();
        console.log('排序後的檔案:', this.files.map(f => `${f.name} (編號: ${this.extractNumber(f.name)})`));
        
        // 初始化間隔
        this.initializeGaps();
        
        // 更新介面
        this.updateFileList();
        this.updatePreview();
        this.showSection('fileListSection');
        this.showSection('previewSection');
        this.showSection('settingsSection');
        this.showSection('actionSection');
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('檔案讀取失敗'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    parseSRT(content) {
        const subtitles = [];
        const blocks = content.trim().split(/\n\s*\n/);

        for (const block of blocks) {
            const lines = block.trim().split('\n');
            if (lines.length >= 3) {
                const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
                
                if (timeMatch) {
                    const text = lines.slice(2).join('\n').trim();
                    
                    // 保持所有字幕條目分開，包括重複時間軸的雙語字幕
                    subtitles.push({
                        number: parseInt(lines[0]),
                        startTime: this.parseTimestamp(timeMatch[1]),
                        endTime: this.parseTimestamp(timeMatch[2]),
                        text: text,
                        isEmpty: text === ''
                    });
                }
            }
        }

        // 重新編號以確保連續性
        subtitles.forEach((sub, index) => {
            sub.number = index + 1;
        });

        return subtitles;
    }

    parseTimestamp(timeStr) {
        const [time, ms] = timeStr.split(',');
        const [hours, minutes, seconds] = time.split(':').map(Number);
        return (hours * 3600 + minutes * 60 + seconds) * 1000 + parseInt(ms);
    }

    formatTimestamp(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const ms = milliseconds % 1000;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }

    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    calculateDuration(subtitles) {
        if (subtitles.length === 0) return 0;
        return Math.max(...subtitles.map(sub => sub.endTime));
    }

    sortFilesByName() {
        this.files.sort((a, b) => {
            const aNum = this.extractNumber(a.name);
            const bNum = this.extractNumber(b.name);
            return aNum - bNum;
        });
    }

    extractNumber(filename) {
        // 優先尋找 part 後面的數字
        const partMatch = filename.match(/part(\d+)/i);
        if (partMatch) {
            return parseInt(partMatch[1]);
        }
        
        // 如果沒有找到 part，則取最後一個數字
        const allMatches = filename.match(/\d+/g);
        if (allMatches && allMatches.length > 0) {
            return parseInt(allMatches[allMatches.length - 1]);
        }
        
        return 0;
    }

    initializeGaps() {
        this.gaps = new Array(Math.max(0, this.files.length - 1)).fill(this.defaultGap * 1000);
    }

    updateFileList() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        this.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item slide-in';
            fileItem.innerHTML = `
                <div class="file-info-left">
                    <div class="file-icon">📄</div>
                    <div class="file-details">
                        <h4>${file.name}</h4>
                        <div class="file-meta">
                            ${(file.size / 1024).toFixed(1)} KB | 
                            ${file.count} 字幕 | 
                            ${this.formatDuration(file.duration)}
                        </div>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn move-btn" onclick="merger.moveFile(${index}, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="action-btn move-btn" onclick="merger.moveFile(${index}, 1)" ${index === this.files.length - 1 ? 'disabled' : ''}>↓</button>
                    <button class="action-btn remove-btn" onclick="merger.removeFile(${index})">移除</button>
                </div>
            `;
            fileList.appendChild(fileItem);
        });
    }

    updatePreview() {
        const timelinePreview = document.getElementById('timelinePreview');
        const totalInfo = document.getElementById('totalInfo');
        
        timelinePreview.innerHTML = '';
        
        let currentTime = 0;
        let totalSubtitles = 0;

        this.files.forEach((file, index) => {
            // 檔案段落
            const segment = document.createElement('div');
            segment.className = 'file-segment';
            segment.innerHTML = `
                <div class="segment-info">
                    <span class="filename">${file.name}</span>
                    <span class="time-range">${this.formatTimestamp(currentTime)} - ${this.formatTimestamp(currentTime + file.duration)}</span>
                    <span class="subtitle-count">${file.count} 字幕</span>
                </div>
            `;
            timelinePreview.appendChild(segment);

            currentTime += file.duration;
            totalSubtitles += file.count;

            // 間隔指示器（除了最後一個檔案）
            if (index < this.files.length - 1) {
                const gap = document.createElement('div');
                gap.className = 'gap-indicator';
                gap.innerHTML = `
                    <span class="gap-time">間隔: ${(this.gaps[index] / 1000).toFixed(1)}秒</span>
                    <button class="adjust-gap" onclick="merger.showGapDialog(${index})">調整</button>
                `;
                timelinePreview.appendChild(gap);
                currentTime += this.gaps[index];
            }
        });

        // 更新總計資訊
        document.getElementById('totalDuration').textContent = this.formatDuration(currentTime);
        document.getElementById('totalSubtitles').textContent = totalSubtitles;
    }

    showGapDialog(gapIndex) {
        this.currentGapIndex = gapIndex;
        const modal = document.getElementById('gapModal');
        const fromFile = this.files[gapIndex].name;
        const toFile = this.files[gapIndex + 1].name;
        
        document.getElementById('gapFromFile').textContent = fromFile;
        document.getElementById('gapToFile').textContent = toFile;
        document.getElementById('gapValue').value = this.gaps[gapIndex] / 1000;
        
        modal.style.display = 'flex';
    }

    moveFile(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.files.length) return;

        // 交換檔案
        [this.files[index], this.files[newIndex]] = [this.files[newIndex], this.files[index]];
        
        // 重新初始化間隔
        this.initializeGaps();
        
        // 更新介面
        this.updateFileList();
        this.updatePreview();
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.initializeGaps();
        
        if (this.files.length === 0) {
            this.hideSection('fileListSection');
            this.hideSection('previewSection');
            this.hideSection('settingsSection');
            this.hideSection('actionSection');
        } else {
            this.updateFileList();
            this.updatePreview();
        }
    }

    async startMerge() {
        if (this.isProcessing || this.files.length === 0) return;

        this.isProcessing = true;
        this.showSection('progressSection');
        
        const mergeBtn = document.getElementById('mergeBtn');
        mergeBtn.disabled = true;
        mergeBtn.textContent = '處理中...';

        try {
            await this.processMerge();
            this.showMergeComplete();
        } catch (error) {
            console.error('合併失敗:', error);
            this.showError('合併過程中發生錯誤: ' + error.message);
        } finally {
            this.isProcessing = false;
            mergeBtn.disabled = false;
            mergeBtn.textContent = '開始合併';
        }
    }

    async processMerge() {
        const steps = [
            '解析字幕檔案',
            '調整時間軸',
            '合併字幕內容',
            '生成輸出檔案',
            '準備下載'
        ];

        let currentTime = 0;
        const mergedSubtitles = [];
        let subtitleNumber = 1;

        for (let i = 0; i < steps.length; i++) {
            this.updateProgress(i + 1, steps.length, steps[i]);
            await this.delay(300); // 模擬處理時間

            if (i === 1) { // 調整時間軸和合併
                for (let fileIndex = 0; fileIndex < this.files.length; fileIndex++) {
                    const file = this.files[fileIndex];
                    
                    for (const subtitle of file.subtitles) {
                        // 跳過空白字幕（如果設定為不保留）
                        if (!this.preserveEmpty && subtitle.isEmpty) {
                            continue;
                        }

                        mergedSubtitles.push({
                            number: subtitleNumber++,
                            startTime: subtitle.startTime + currentTime,
                            endTime: subtitle.endTime + currentTime,
                            text: subtitle.text
                        });
                    }

                    currentTime += file.duration;
                    if (fileIndex < this.files.length - 1) {
                        currentTime += this.gaps[fileIndex];
                    }
                }
            }
        }

        // 生成SRT內容
        this.mergedContent = this.generateSRT(mergedSubtitles);
        this.updateProgress(5, 5, '完成');
    }

    generateSRT(subtitles) {
        return subtitles.map(sub => 
            `${sub.number}\n${this.formatTimestamp(sub.startTime)} --> ${this.formatTimestamp(sub.endTime)}\n${sub.text}\n`
        ).join('\n');
    }

    updateProgress(current, total, stepText) {
        const percent = Math.round((current / total) * 100);
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressPercent').textContent = `${percent}%`;
        document.getElementById('currentStep').textContent = stepText;

        // 更新步驟詳情
        const stepDetails = document.getElementById('stepDetails');
        const steps = [
            '解析字幕檔案',
            '調整時間軸', 
            '合併字幕內容',
            '生成輸出檔案',
            '準備下載'
        ];

        stepDetails.innerHTML = steps.map((step, index) => {
            let className = 'step ';
            if (index < current - 1) className += 'completed';
            else if (index === current - 1) className += 'in-progress';
            else className += 'pending';

            let icon = '⏸';
            if (index < current - 1) icon = '✓';
            else if (index === current - 1) icon = '⏳';

            return `<div class="${className}">${icon} ${step}</div>`;
        }).join('');
    }

    showMergeComplete() {
        document.getElementById('mergedFileCount').textContent = this.files.length;
        this.showSection('resultSection');
        document.getElementById('downloadBtn').style.display = 'inline-block';
    }

    downloadResult() {
        if (!this.mergedContent) return;

        const filename = document.getElementById('outputFilename').value || 'merged.srt';
        const blob = new Blob([this.mergedContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'block';
            section.classList.add('fade-in');
        }
    }

    hideSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
        }
    }

    showError(message) {
        alert(message); // 簡單的錯誤顯示，可以改為更好的UI
    }
}

// 全域函數
let merger;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    merger = new SubtitleMerger();
});

// 全域函數實現
function toggleHelp() {
    const helpSection = document.getElementById('helpSection');
    helpSection.style.display = helpSection.style.display === 'none' ? 'block' : 'none';
}

function clearFiles() {
    if (confirm('確定要清除所有檔案嗎？')) {
        merger.files = [];
        merger.gaps = [];
        merger.hideSection('fileListSection');
        merger.hideSection('previewSection');
        merger.hideSection('settingsSection');
        merger.hideSection('actionSection');
        merger.hideSection('progressSection');
        merger.hideSection('resultSection');
        document.getElementById('downloadBtn').style.display = 'none';
    }
}

function sortFiles() {
    merger.sortFilesByName();
    merger.initializeGaps();
    merger.updateFileList();
    merger.updatePreview();
}

function startMerge() {
    merger.startMerge();
}

function downloadResult() {
    merger.downloadResult();
}

// 間隔調整對話框函數
function closeGapModal() {
    document.getElementById('gapModal').style.display = 'none';
}

function setGapValue(value) {
    document.getElementById('gapValue').value = value;
    
    // 更新按鈕狀態
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

function confirmGapAdjustment() {
    const gapValue = parseFloat(document.getElementById('gapValue').value);
    if (isNaN(gapValue) || gapValue < 0) {
        alert('請輸入有效的間隔時間');
        return;
    }

    merger.gaps[merger.currentGapIndex] = gapValue * 1000;
    merger.updatePreview();
    closeGapModal();
}