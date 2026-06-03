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
    
    // ========== ИСПРАВЛЕННОЕ СКАЧИВАНИЕ (РАБОТАЕТ) ==========
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const s = allSounds.find(x => x.$id === btn.getAttribute('data-id'));
            if (s) {
                const url = storage.getFileView(BUCKET_ID, s.fileId);
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = s.name;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                    }, 100);
                } catch (err) {
                    console.error("Ошибка скачивания:", err);
                    alert("Не удалось скачать файл");
                }
            }
        };
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = () => deleteSound(btn.getAttribute('data-id'), currentUserId);
    });
}
