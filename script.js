// ========== APPWRITE ==========
const client = new Appwrite.Client();
const databases = new Appwrite.Databases(client);
const storage = new Appwrite.Storage(client);
const ID = Appwrite.ID;
const Query = Appwrite.Query;

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('6a1f05ec0025b498a9ec');

const DATABASE_ID = "6a1f0bc600288d9c3510";
const COLLECTION_ID = "sounds";
const BUCKET_ID = "6a20250b001555f062d9";

// ========== ПОЛЬЗОВАТЕЛЬ ==========
let currentUserId = localStorage.getItem("userId");
if (!currentUserId) {
    currentUserId = "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    localStorage.setItem("userId", currentUserId);
}

let allSounds = [];
let likedSounds = new Set();
let currentTab = "home";
let searchQuery = "";

// DOM элементы
const soundsGrid = document.getElementById('soundsGrid');
const searchInput = document.getElementById('searchInput');
const searchBar = document.getElementById('searchBar');
const searchToggle = document.getElementById('searchToggle');
const closeSearch = document.getElementById('closeSearch');
const welcomeMsg = document.getElementById('welcomeMsg');
const uploadBtn = document.getElementById('uploadBtn');
const uploadModal = document.getElementById('uploadModal');
const soundModal = document.getElementById('soundModal');
const modalContent = document.getElementById('modalContent');
const userNameSpan = document.getElementById('userName');

// ========== ЗАГРУЗКА ЗВУКОВ ==========
async function loadSounds() {
    try {
        const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
            Query.orderDesc("createdAt")
        ]);
        allSounds = response.documents;
        await loadLikes();
        renderSounds();
        updateStats();
    } catch (err) {
        console.error("Ошибка:", err);
    }
}

async function loadLikes() {
    const saved = localStorage.getItem(`likes_${currentUserId}`);
    if (saved) likedSounds = new Set(JSON.parse(saved));
}

function saveLikes() {
    localStorage.setItem(`likes_${currentUserId}`, JSON.stringify([...likedSounds]));
}

function updateStats() {
    // Обновляем статистику если нужно
}

// ========== ОТРИСОВКА КРУГЛЫХ КАРТОЧЕК ==========
function renderSounds() {
    let filtered = [...allSounds];
    if (searchQuery) {
        filtered = filtered.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (currentTab === "my") {
        filtered = filtered.filter(s => s.userId === currentUserId);
    } else if (currentTab === "favorites") {
        filtered = filtered.filter(s => likedSounds.has(s.$id));
    } else if (currentTab === "trending") {
        filtered = filtered.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    }
    
    if (filtered.length === 0) {
        soundsGrid.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-volume-off"></i>
                <h3>ЗВУКОВ НЕТ</h3>
                <p>Нажми на кнопку <i class="fas fa-cloud-upload-alt"></i> чтобы загрузить первый звук</p>
            </div>
        `;
        welcomeMsg.style.display = 'none';
        return;
    }
    
    welcomeMsg.style.display = 'none';
    soundsGrid.innerHTML = filtered.map(sound => `
        <div class="sound-circle" data-id="${sound.$id}">
            <div class="circle">
                <i class="fas fa-waveform"></i>
            </div>
            <div class="sound-name">${escapeHtml(sound.name)}</div>
            <div class="sound-meta">
                <span><i class="fas fa-heart"></i> ${sound.likesCount || 0}</span>
                <span><i class="fas fa-user"></i> ${sound.userId === currentUserId ? 'Вы' : 'Слушатель'}</span>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.sound-circle').forEach(el => {
        el.addEventListener('click', () => openSoundModal(el.getAttribute('data-id')));
    });
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// ========== ОТКРЫТИЕ МОДАЛКИ СО ЗВУКОМ ==========
async function openSoundModal(soundId) {
    const sound = allSounds.find(s => s.$id === soundId);
    if (!sound) return;
    
    const isLiked = likedSounds.has(sound.$id);
    const url = storage.getFileView(BUCKET_ID, sound.fileId);
    
    modalContent.innerHTML = `
        <div class="sound-player">
            <h3>${escapeHtml(sound.name)}</h3>
            <div class="player-stats">
                <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${sound.$id}">
                    <i class="fas fa-heart"></i> ${sound.likesCount || 0}
                </button>
                ${sound.userId === currentUserId ? `<button class="delete-btn" data-id="${sound.$id}"><i class="fas fa-trash"></i> УДАЛИТЬ</button>` : ''}
            </div>
            <audio controls src="${url}" autoplay></audio>
            <p class="hint">🎵 Загружено: ${new Date(sound.createdAt).toLocaleDateString()}</p>
            <p class="hint">⬇️ Скачать можно через три точки в плеере</p>
        </div>
    `;
    
    soundModal.classList.add('active');
    
    document.querySelector('.like-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        const s = allSounds.find(x => x.$id === id);
        if (s) {
            await toggleLike(id, s.likesCount || 0);
            openSoundModal(id);
        }
    });
    
    document.querySelector('.delete-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('Удалить звук?')) {
            await deleteSound(id, currentUserId);
            soundModal.classList.remove('active');
            loadSounds();
        }
    });
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
    try {
        const sound = allSounds.find(s => s.$id === soundId);
        if (sound?.fileId) await storage.deleteFile(BUCKET_ID, sound.fileId);
        await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, soundId);
    } catch (err) {
        alert("Ошибка удаления");
    }
}

// ========== ЗАГРУЗКА ЗВУКА ==========
function showUploadModal() {
    uploadModal.classList.add('active');
}

document.getElementById('uploadArea')?.addEventListener('click', () => {
    document.getElementById('audioFile').click();
});

document.getElementById('audioFile')?.addEventListener('change', handleUpload);

async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    let customName = prompt("Введите название звука (до 15 символов):", file.name.split('.')[0].slice(0, 15));
    if (customName === null) return;
    if (customName.trim() === "") customName = file.name.split('.')[0];
    customName = customName.slice(0, 15);
    
    if (file.size > 10 * 1024 * 1024) {
        alert("Файл больше 10 МБ");
        return;
    }
    if (!["audio/mpeg", "audio/wav", "audio/ogg"].includes(file.type)) {
        alert("Только MP3, WAV, OGG");
        return;
    }
    
    const progressDiv = document.getElementById('uploadProgress');
    const statusDiv = document.getElementById('uploadStatus');
    const progressFill = progressDiv.querySelector('.progress-fill');
    
    progressDiv.style.display = 'block';
    statusDiv.innerText = 'Загрузка...';
    
    try {
        const fileRes = await storage.createFile(BUCKET_ID, ID.unique(), file);
        progressFill.style.width = "100%";
        statusDiv.innerText = "Сохранение...";
        
        await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
            name: customName,
            fileId: fileRes.$id,
            size: file.size,
            userId: currentUserId,
            createdAt: new Date().toISOString(),
            likesCount: 0
        });
        
        statusDiv.innerText = "✅ Загружено!";
        setTimeout(() => {
            uploadModal.classList.remove('active');
            progressDiv.style.display = 'none';
            progressFill.style.width = '0%';
            loadSounds();
        }, 1000);
    } catch (err) {
        statusDiv.innerText = "❌ " + err.message;
    }
}

// ========== НАВИГАЦИЯ ==========
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.getAttribute('data-tab');
        loadSounds();
    });
});

// ========== ПОИСК ==========
searchToggle?.addEventListener('click', () => {
    searchBar.style.display = 'flex';
    searchInput.focus();
});

closeSearch?.addEventListener('click', () => {
    searchBar.style.display = 'none';
    searchInput.value = '';
    searchQuery = '';
    loadSounds();
});

searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderSounds();
});

uploadBtn?.addEventListener('click', showUploadModal);

// Закрытие модалок
document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el?.addEventListener('click', () => {
        soundModal.classList.remove('active');
        uploadModal.classList.remove('active');
    });
});

// ========== ЗАПУСК ==========
userNameSpan.innerText = localStorage.getItem('userName') || 'ГОСТЬ';
loadSounds();
