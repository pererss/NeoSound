import { Client, Databases, Storage, ID, Query } from "https://esm.sh/appwrite@10.0.0";

const PROJECT_ID = "6a1f05ec0025b498a9ec";
const API_KEY = "standard_1b1f59d1dfa0e414c3682724e6d54a405ec4a0c727f00fc6666870b340c922a9e04a18e282ff5ecd9a11fef4910c2403f86b011eea5739f48130d308bd4895c7aaf9a86de6c476103529ed205484e9eddb4174cd9f5b04053ab46fb53396687841398499e47088b567af112502c97dc7e1fa7b412cb56c7a2db410854320d478";
const DATABASE_ID = "AudioDB";
const COLLECTION_ID = "sounds";
const BUCKET_ID = "audio-files";

const client = new Client();
client.setEndpoint("https://cloud.appwrite.io/v1");
client.setProject(PROJECT_ID);
client.setKey(API_KEY);  // Теперь работает

const databases = new Databases(client);
const storage = new Storage(client);

// Остальной код без изменений (такой же, как был)
let currentUserId = localStorage.getItem("userId");
if (!currentUserId) {
    currentUserId = "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    localStorage.setItem("userId", currentUserId);
}

let allSounds = [];
let likedSounds = new Set();
let currentTab = "home";
let currentAudio = null;
let searchQuery = "";

const heroSection = document.getElementById("heroSection");
const mainInterface = document.getElementById("mainInterface");
const exploreBtn = document.getElementById("exploreBtn");
const uploadHeroBtn = document.getElementById("uploadBtn");
const mainContent = document.getElementById("main-content");
const searchInput = document.getElementById("searchInput");
const nowPlayingDiv = document.getElementById("nowPlaying");
const npTitle = document.getElementById("npTitle");
const npArtist = document.getElementById("npArtist");
const npPlayPause = document.getElementById("npPlayPause");
const npPrev = document.getElementById("npPrev");
const npNext = document.getElementById("npNext");
const totalSoundsSpan = document.getElementById("totalSoundsCount");
const totalLikesSpan = document.getElementById("totalLikesCount");
const userNameSpan = document.getElementById("userName");
const volumeSlider = document.getElementById("volumeSlider");

async function loadSounds() {
    try {
        const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [Query.orderDesc("createdAt")]);
        allSounds = response.documents;
        await loadLikes();
        renderCurrentTab();
        updateStats();
    } catch (err) {
        console.error(err);
        mainContent.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Ошибка</h3><p>${err.message}</p></div>`;
    }
}

async function loadLikes() {
    const saved = localStorage.getItem(`likes_${currentUserId}`);
    if (saved) likedSounds = new Set(JSON.parse(saved));
}

function saveLikes() {
    localStorage.setItem(`likes_${currentUserId}`, JSON.stringify([...likedSounds]));
}

async function toggleLike(soundId, currentLikes) {
    if (likedSounds.has(soundId)) {
        likedSounds.delete(soundId);
        await databases.updateDocument(DATABASE_ID, COLLECTION_ID, soundId, { likesCount: currentLikes - 1 });
    } else {
        likedSounds.add(soundId);
        await databases.updateDocument(DATABASE_ID, COLLECTION_ID, soundId, { likesCount: currentLikes + 1 });
    }
    saveLikes();
    await loadSounds();
}

async function deleteSound(soundId, userId) {
    if (userId !== currentUserId) return;
    if (!confirm("Удалить звук?")) return;
    try {
        const sound = allSounds.find(s => s.$id === soundId);
        if (sound?.fileId) await storage.deleteFile(BUCKET_ID, sound.fileId);
        await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, soundId);
        await loadSounds();
    } catch (err) {
        alert("Ошибка удаления");
    }
}

async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert("Файл больше 10 МБ");
    if (!["audio/mpeg", "audio/wav", "audio/ogg"].includes(file.type)) return alert("Только MP3, WAV, OGG");

    const statusDiv = document.getElementById("uploadStatus");
    const progressFill = document.getElementById("uploadProgress");

    try {
        const fileRes = await storage.createFile(BUCKET_ID, ID.unique(), file);
        if (progressFill) progressFill.style.width = "100%";
        if (statusDiv) statusDiv.innerHTML = "Сохранение...";
        await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
            name: file.name,
            fileId: fileRes.$id,
            size: file.size,
            userId: currentUserId,
            createdAt: new Date().toISOString(),
            likesCount: 0
        });
        if (statusDiv) statusDiv.innerHTML = "✅ Загружено!";
        await loadSounds();
        setActiveTab("home");
    } catch (err) {
        if (statusDiv) statusDiv.innerHTML = "❌ " + err.message;
    }
}

function playSound(soundId) {
    const sound = allSounds.find(s => s.$id === soundId);
    if (!sound) return;
    if (currentAudio) currentAudio.pause();
    const url = storage.getFileView(BUCKET_ID, sound.fileId);
    const audio = new Audio(url);
    audio.volume = volumeSlider ? volumeSlider.value / 100 : 0.7;
    audio.play();
    currentAudio = audio;
    if (npTitle) npTitle.textContent = sound.name;
    if (npArtist) npArtist.textContent = sound.userId === currentUserId ? "Вы" : "Автор";
    if (nowPlayingDiv) nowPlayingDiv.style.display = "block";
    if (npPlayPause) npPlayPause.innerHTML = '<i class="fas fa-pause"></i>';
    audio.onended = () => { if (npPlayPause) npPlayPause.innerHTML = '<i class="fas fa-play"></i>'; };
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
    const list = getFilteredSounds();
    const current = currentAudio ? allSounds.find(s => storage.getFileView(BUCKET_ID, s.fileId) === currentAudio.src) : null;
    if (current) {
        const idx = list.findIndex(s => s.$id === current.$id);
        if (list[idx + 1]) playSound(list[idx + 1].$id);
    }
}

function playPrev() {
    const list = getFilteredSounds();
    const current = currentAudio ? allSounds.find(s => storage.getFileView(BUCKET_ID, s.fileId) === currentAudio.src) : null;
    if (current) {
        const idx = list.findIndex(s => s.$id === current.$id);
        if (list[idx - 1]) playSound(list[idx - 1].$id);
    }
}

function updateStats() {
    if (totalSoundsSpan) totalSoundsSpan.textContent = allSounds.length;
    const totalLikes = allSounds.reduce((sum, s) => sum + (s.likesCount || 0), 0);
    if (totalLikesSpan) totalLikesSpan.textContent = totalLikes;
}

function formatDate(dateStr) {
    if (!dateStr) return "новое";
    const hours = Math.floor((new Date() - new Date(dateStr)) / 3600000);
    if (hours < 1) return "только что";
    if (hours < 24) return `${hours} ч назад`;
    return `${Math.floor(hours / 24)} д назад`;
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

function getFilteredSounds() {
    let filtered = [...allSounds];
    if (searchQuery) filtered = filtered.filter(s => s.name.toLowerCase().includes(searchQuery));
    if (currentTab === "my") filtered = filtered.filter(s => s.userId === currentUserId);
    if (currentTab === "favorites") filtered = filtered.filter(s => likedSounds.has(s.$id));
    if (currentTab === "trending") filtered = filtered.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    return filtered;
}

function renderSoundsList(soundsArray) {
    if (!soundsArray.length) {
        mainContent.innerHTML = `<div class="empty-state"><i class="fas fa-head-side-vr"></i><h3>Звуков нет</h3><p>Загрузи первый звук!</p></div>`;
        return;
    }
    let html = `<div class="sounds-grid">`;
    for (const s of soundsArray) {
        const isLiked = likedSounds.has(s.$id);
        const isMine = s.userId === currentUserId;
        html += `
            <div class="sound-card">
                <div class="card-header">
                    <div class="sound-title"><i class="fas fa-waveform"></i> ${escapeHtml(s.name.length > 35 ? s.name.substr(0,32)+'...' : s.name)}</div>
                    <div class="sound-duration">${formatDate(s.createdAt)}</div>
                </div>
                <div class="sound-meta">
                    <span><i class="fas fa-user"></i> ${s.userId === currentUserId ? 'Вы' : 'Слушатель'}</span>
                    <span><i class="fas fa-database"></i> ${(s.size/1024).toFixed(1)} KB</span>
                </div>
                <div class="card-actions">
                    <button class="btn-like ${isLiked ? 'liked' : ''}" data-id="${s.$id}" data-likes="${s.likesCount || 0}">
                        <i class="fas fa-heart"></i> <span>${s.likesCount || 0}</span>
                    </button>
                    <button class="btn-play" data-id="${s.$id}"><i class="fas fa-play"></i></button>
                    <button class="btn-download" data-id="${s.$id}"><i class="fas fa-download"></i></button>
                    ${isMine ? `<button class="btn-delete" data-id="${s.$id}"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
        `;
    }
    html += `</div>`;
    mainContent.innerHTML = html;

    document.querySelectorAll('.btn-like').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            const likes = parseInt(btn.getAttribute('data-likes'));
            await toggleLike(id, likes);
        };
    });
    document.querySelectorAll('.btn-play').forEach(btn => {
        btn.onclick = () => playSound(btn.getAttribute('data-id'));
    });
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.onclick = async () => {
            const s = allSounds.find(x => x.$id === btn.getAttribute('data-id'));
            if (s) {
                const url = storage.getFileView(BUCKET_ID, s.fileId);
                const a = document.createElement('a');
                a.href = url;
                a.download = s.name;
                a.click();
            }
        };
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = () => deleteSound(btn.getAttribute('data-id'), currentUserId);
    });
}

function renderCurrentTab() {
    if (currentTab === "upload") showUploadForm();
    else renderSoundsList(getFilteredSounds());
}

function showUploadForm() {
    mainContent.innerHTML = `
        <div class="upload-area">
            <div class="upload-icon"><i class="fas fa-cloud-upload-alt"></i></div>
            <h3>Загрузи свой звук</h3>
            <p>MP3, WAV, OGG до 10 МБ</p>
            <input type="file" id="audioFile" accept=".mp3,.wav,.ogg" class="file-input">
            <label for="audioFile" class="upload-label"><i class="fas fa-music"></i> Выбрать файл</label>
            <div class="progress-bar"><div class="progress-fill" id="uploadProgress"></div></div>
            <div id="uploadStatus" style="margin-top:1rem;"></div>
        </div>
    `;
    document.getElementById("audioFile").onchange = handleUpload;
}

function setActiveTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    renderCurrentTab();
}

function showMainInterface() {
    if (heroSection) heroSection.style.display = "none";
    if (mainInterface) mainInterface.style.display = "block";
    loadSounds();
}

if (exploreBtn) exploreBtn.onclick = showMainInterface;
if (uploadHeroBtn) uploadHeroBtn.onclick = () => { showMainInterface(); setActiveTab("upload"); };
if (searchInput) searchInput.oninput = (e) => { searchQuery = e.target.value.toLowerCase(); renderCurrentTab(); };
if (npPlayPause) npPlayPause.onclick = togglePlayPause;
if (npPrev) npPrev.onclick = playPrev;
if (npNext) npNext.onclick = playNext;
if (volumeSlider) volumeSlider.oninput = (e) => { if (currentAudio) currentAudio.volume = e.target.value / 100; };
if (userNameSpan) userNameSpan.textContent = localStorage.getItem("userName") || "Listener";

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => setActiveTab(btn.getAttribute('data-tab'));
});

showMainInterface();
