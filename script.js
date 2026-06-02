// ========== NEON WAVE AUDIO PLAYER ==========
// Хранилище в localStorage (для теста и быстрого старта)
// Потом можно легко переделать на Appwrite

// Текущий пользователь
let currentUserId = localStorage.getItem("neonUserId");
if (!currentUserId) {
    currentUserId = "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 8);
    localStorage.setItem("neonUserId", currentUserId);
    localStorage.setItem("userName", "Listener_" + Math.floor(Math.random() * 1000));
}

// Глобальные переменные
let allSounds = [];
let likedSounds = new Set();
let currentTab = "home";
let currentPlaylist = [];
let currentIndex = -1;
let currentAudio = null;
let searchQuery = "";

// DOM элементы
const heroSection = document.getElementById("heroSection");
const mainInterface = document.getElementById("mainInterface");
const exploreBtn = document.getElementById("exploreBtn");
const uploadHeroBtn = document.getElementById("uploadBtn");
const mainContent = document.getElementById("main-content");
const userNameSpan = document.getElementById("userName");
const searchInput = document.getElementById("searchInput");
const nowPlayingDiv = document.getElementById("nowPlaying");
const npTitle = document.getElementById("npTitle");
const npArtist = document.getElementById("npArtist");
const npPlayPause = document.getElementById("npPlayPause");
const npPrev = document.getElementById("npPrev");
const npNext = document.getElementById("npNext");
const volumeSlider = document.getElementById("volumeSlider");
const totalSoundsSpan = document.getElementById("totalSoundsCount");
const totalLikesSpan = document.getElementById("totalLikesCount");

// Инициализация
function init() {
    loadSounds();
    loadUserLikes();
    updateUserName();
    updateStats();
    
    // Обработчики кнопок
    exploreBtn.addEventListener("click", showMainInterface);
    uploadHeroBtn.addEventListener("click", () => {
        showMainInterface();
        setActiveTab("upload");
    });
    
    searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderCurrentTab();
    });
    
    npPlayPause.addEventListener("click", togglePlayPause);
    npPrev.addEventListener("click", playPrev);
    npNext.addEventListener("click", playNext);
    volumeSlider.addEventListener("input", (e) => {
        if (currentAudio) currentAudio.volume = e.target.value / 100;
    });
    
    // Навигация
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            setActiveTab(tab);
        });
    });
}

function showMainInterface() {
    heroSection.style.display = "none";
    mainInterface.style.display = "block";
    renderCurrentTab();
}

function updateUserName() {
    const name = localStorage.getItem("userName") || "Listener";
    userNameSpan.textContent = name;
}

function loadSounds() {
    const saved = localStorage.getItem("neonSounds");
    if (saved) {
        allSounds = JSON.parse(saved);
    } else {
        // Демо-звуки для примера
        allSounds = [];
    }
}

function saveSounds() {
    localStorage.setItem("neonSounds", JSON.stringify(allSounds));
    updateStats();
}

function loadUserLikes() {
    const likes = JSON.parse(localStorage.getItem(`neonLikes_${currentUserId}`)) || [];
    likedSounds = new Set(likes);
}

function saveUserLikes() {
    localStorage.setItem(`neonLikes_${currentUserId}`, JSON.stringify([...likedSounds]));
}

function updateStats() {
    const totalSounds = allSounds.length;
    const totalLikes = allSounds.reduce((sum, s) => sum + (s.likesCount || 0), 0);
    if (totalSoundsSpan) totalSoundsSpan.textContent = totalSounds;
    if (totalLikesSpan) totalLikesSpan.textContent = totalLikes;
}

function toggleLike(soundId) {
    const sound = allSounds.find(s => s.id === soundId);
    if (!sound) return;
    
    if (likedSounds.has(soundId)) {
        likedSounds.delete(soundId);
        sound.likesCount = Math.max(0, (sound.likesCount || 0) - 1);
    } else {
        likedSounds.add(soundId);
        sound.likesCount = (sound.likesCount || 0) + 1;
    }
    saveSounds();
    saveUserLikes();
    renderCurrentTab();
    updateStats();
}

function deleteSound(soundId, userId) {
    if (userId !== currentUserId) return;
    allSounds = allSounds.filter(s => s.id !== soundId);
    likedSounds.delete(soundId);
    saveSounds();
    saveUserLikes();
    renderCurrentTab();
    updateStats();
}

function playSound(soundId) {
    const sound = allSounds.find(s => s.id === soundId);
    if (!sound) return;
    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    const audio = new Audio(sound.url);
    audio.volume = volumeSlider.value / 100;
    audio.play();
    currentAudio = audio;
    
    npTitle.textContent = sound.name;
    npArtist.textContent = sound.userId === currentUserId ? "Вы" : "Автор";
    nowPlayingDiv.style.display = "block";
    
    audio.addEventListener("ended", () => {
        playNext();
    });
    
    npPlayPause.innerHTML = '<i class="fas fa-pause"></i>';
}

function togglePlayPause() {
    if (!currentAudio) return;
    if (currentAudio.paused) {
        currentAudio.play();
        npPlayPause.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        currentAudio.pause();
        npPlayPause.innerHTML = '<i class="fas fa-play"></i>';
    }
}

function playNext() {
    // Просто играем следующий из текущего плейлиста
    const currentList = getFilteredSounds();
    const currentSound = currentAudio ? allSounds.find(s => s.url === currentAudio.src) : null;
    if (currentSound) {
        const idx = currentList.findIndex(s => s.id === currentSound.id);
        const next = currentList[idx + 1];
        if (next) playSound(next.id);
    }
}

function playPrev() {
    const currentList = getFilteredSounds();
    const currentSound = currentAudio ? allSounds.find(s => s.url === currentAudio.src) : null;
    if (currentSound) {
        const idx = currentList.findIndex(s => s.id === currentSound.id);
        const prev = currentList[idx - 1];
        if (prev) playSound(prev.id);
    }
}

function getFilteredSounds() {
    let filtered = [...allSounds];
    
    if (searchQuery) {
        filtered = filtered.filter(s => s.name.toLowerCase().includes(searchQuery));
    }
    
    if (currentTab === "my") {
        filtered = filtered.filter(s => s.userId === currentUserId);
    } else if (currentTab === "favorites") {
        filtered = filtered.filter(s => likedSounds.has(s.id));
    } else if (currentTab === "trending") {
        filtered = filtered.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    }
    
    return filtered;
}

function renderSoundsList(soundsArray) {
    if (!soundsArray.length) {
        mainContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-head-side-vr"></i>
                <h3>Звуков пока нет</h3>
                <p>Стань первым! Загрузи свой звук в разделе "Загрузить"</p>
            </div>
        `;
        return;
    }
    
    let html = `<div class="sounds-grid">`;
    soundsArray.forEach(sound => {
        const isLiked = likedSounds.has(sound.id);
        const isMine = sound.userId === currentUserId;
        html += `
            <div class="sound-card" data-id="${sound.id}">
                <div class="card-header">
                    <div class="sound-title">
                        <i class="fas fa-waveform"></i>
                        <span>${escapeHtml(sound.name.length > 35 ? sound.name.substr(0, 32) + '...' : sound.name)}</span>
                    </div>
                    <div class="sound-duration">
                        <i class="far fa-clock"></i> ${formatDate(sound.createdAt)}
                    </div>
                </div>
                <div class="sound-meta">
                    <span><i class="fas fa-user"></i> ${sound.userId === currentUserId ? 'Вы' : 'Слушатель'}</span>
                    <span><i class="fas fa-database"></i> ${(sound.size / 1024).toFixed(1)} KB</span>
                </div>
                <audio controls class="audio-player" src="${sound.url}" preload="metadata"></audio>
                <div class="card-actions">
                    <button class="btn-like ${isLiked ? 'liked' : ''}" data-id="${sound.id}">
                        <i class="fas fa-heart"></i> <span>${sound.likesCount || 0}</span>
                    </button>
                    <button class="btn-play-now" data-id="${sound.id}">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn-download" data-url="${sound.url}" data-name="${sound.name}">
                        <i class="fas fa-download"></i>
                    </button>
                    ${isMine ? `<button class="btn-delete" data-id="${sound.id}"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
        `;
    });
    html += `</div>`;
    mainContent.innerHTML = html;
    
    // Обработчики событий
    document.querySelectorAll('.btn-like').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLike(btn.getAttribute('data-id'));
        });
    });
    
    document.querySelectorAll('.btn-play-now').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            playSound(id);
        });
    });
    
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = btn.getAttribute('data-url');
            const name = btn.getAttribute('data-name');
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const sound = allSounds.find(s => s.id === id);
            if (sound && confirm(`Удалить "${sound.name}"?`)) {
                deleteSound(id, sound.userId);
            }
        });
    });
}

function formatDate(dateStr) {
    if (!dateStr) return "только что";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "только что";
    if (hours < 24) return `${hours} ч назад`;
    return `${Math.floor(hours / 24)} д назад`;
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

function renderCurrentTab() {
    const filtered = getFilteredSounds();
    renderSoundsList(filtered);
}

function setActiveTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    if (tabId === "upload") {
        showUploadForm();
    } else {
        renderCurrentTab();
    }
}

function showUploadForm() {
    mainContent.innerHTML = `
        <div class="upload-area">
            <div class="upload-icon">
                <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <h3>Загрузи свой звук</h3>
            <p>Поделись своей аудио-вселенной с другими</p>
            <input type="file" id="audioFile" accept=".mp3,.wav,.ogg" class="file-input">
            <label for="audioFile" class="upload-label">
                <i class="fas fa-music"></i> Выбрать файл
            </label>
            <div class="format-hint">
                <i class="fas fa-info-circle"></i> MP3, WAV, OGG до 10 МБ
            </div>
            <div class="progress-bar">
                <div class="progress-fill" id="uploadProgress"></div>
            </div>
            <div id="uploadStatus" style="margin-top: 1rem; font-size: 0.8rem;"></div>
        </div>
    `;
    
    document.getElementById("audioFile").addEventListener("change", handleUpload);
}

function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
        alert("Файл больше 10 МБ");
        return;
    }
    
    if (!["audio/mpeg", "audio/wav", "audio/ogg"].includes(file.type)) {
        alert("Поддерживаются только MP3, WAV, OGG");
        return;
    }
    
    const statusDiv = document.getElementById("uploadStatus");
    const progressFill = document.getElementById("uploadProgress");
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        progressFill.style.width = "100%";
        const audioUrl = evt.target.result;
        const newSound = {
            id: Date.now() + "_" + Math.random().toString(36).substr(2, 6),
            name: file.name,
            url: audioUrl,
            size: file.size,
            userId: currentUserId,
            createdAt: new Date().toISOString(),
            likesCount: 0
        };
        allSounds.unshift(newSound);
        saveSounds();
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> ✅ Загружено!';
        setTimeout(() => {
            setActiveTab("home");
        }, 1500);
    };
    reader.readAsDataURL(file);
}

// Запуск
init();