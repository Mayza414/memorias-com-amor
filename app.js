/* =====================================================
   MEMÓRIAS COM AMOR — app.js (Versão Completa Cloud Pro)
   ===================================================== */

const App = (() => {

    /* =================================================
       1. CONFIGURAÇÃO E CONEXÃO COM O BANCO DE DADOS
       ================================================= */
    // 💡 IMPORTANTE: Substitua com as credenciais do seu painel do Supabase
    const SUPABASE_URL = "https://SUA_URL_AQUI.supabase.co";
    const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_AQUI";

    const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    /* ========== STATE (ESTADO LOCAL) ========== */
    let state = {
        user: null,
        albums: [],
        currentAlbumId: null,
        pendingFiles: [],
        lightbox: { photos: [], index: 0 },
    };

    /* ========== STORAGE (Sincronização com PostgreSQL) ========== */
    const DB = {
        async loadUserData(usuarioId) {
            try {
                // Busca os álbuns do usuário logado
                const { data: albuns, error: errAlbuns } = await supabase
                    .from('albuns')
                    .select('*')
                    .eq('usuario_id', usuarioId)
                    .order('created_at', { ascending: false });

                if (errAlbuns) throw errAlbuns;

                // Busca as fotos de cada um dos álbuns
                for (let album of albuns) {
                    const { data: fotos, error: errFotos } = await supabase
                        .from('fotos')
                        .select('*')
                        .eq('album_id', album.id)
                        .order('date', { ascending: false });

                    if (!errFotos) album.photos = fotos || [];
                }

                state.albums = albuns || [];
                return true;
            } catch (e) {
                console.error('Erro ao carregar dados do Supabase:', e);
                toast('❌ Erro ao sincronizar suas memórias com a nuvem.');
                return false;
            }
        }
    };

    /* ========== COMPRESSÃO DE IMAGENS (Essencial para Performance) ========== */
    function compressImage(file, maxWidth = 1200, quality = 0.7) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Retorna a imagem otimizada em JPEG (Múltiplas vezes mais leve)
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
            };
        });
    }

    /* ========== AUTENTICAÇÃO (Login e Cadastro no Banco) ========== */
    async function login() {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value;
        const errEl = document.getElementById('login-error');
        errEl.classList.add('hidden');

        if (!email || !pass) { showError(errEl, 'Preencha e-mail e senha.'); return; }

        showLoadingBtn('btn-submit-login', true);

        try {
            const { data: user, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', email)
                .eq('password', hashSimple(pass))
                .single();

            if (error || !user) {
                showError(errEl, 'E-mail ou senha incorretos.');
                return;
            }

            state.user = user;
            await DB.loadUserData(user.id);
            bootApp();
        } catch (e) {
            showError(errEl, 'Erro de comunicação com o servidor.');
        } finally {
            showLoadingBtn('btn-submit-login', false);
        }
    }

    async function register() {
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value;
        const errEl = document.getElementById('reg-error');
        errEl.classList.add('hidden');

        if (!name) { showError(errEl, 'Informe seu nome.'); return; }
        if (!email || !email.includes('@')) { showError(errEl, 'Informe um e-mail válido.'); return; }
        if (pass.length < 6) { showError(errEl, 'A senha precisa ter no mínimo 6 caracteres.'); return; }

        showLoadingBtn('btn-submit-register', true);

        try {
            const { data: newUser, error } = await supabase
                .from('usuarios')
                .insert([{ name, email, password: hashSimple(pass), initials: getInitials(name) }])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') showError(errEl, 'Este e-mail já está cadastrado.');
                else showError(errEl, 'Erro ao criar conta. Tente novamente.');
                return;
            }

            state.user = newUser;
            state.albums = [];
            bootApp();
            toast('Conta criada com sucesso! 🎉');
        } catch (e) {
            showError(errEl, 'Erro de conexão no cadastro.');
        } finally {
            showLoadingBtn('btn-submit-register', false);
        }
    }

    function logout() {
        state.user = null;
        state.albums = [];
        document.getElementById('screen-app').classList.replace('active', 'hidden');
        document.getElementById('screen-auth').classList.replace('hidden', 'active');
        toast('Sessão encerrada com segurança.');
    }

    function showLogin() {
        document.getElementById('tab-register').classList.add('hidden');
        document.getElementById('tab-login').classList.remove('hidden');
    }

    function showRegister() {
        document.getElementById('tab-login').classList.add('hidden');
        document.getElementById('tab-register').classList.remove('hidden');
    }

    /* ========== BOOT (INICIALIZAÇÃO DA ÁREA LOGADA) ========== */
    function bootApp() {
        document.getElementById('screen-auth').classList.remove('active', 'hidden');
        document.getElementById('screen-auth').classList.add('hidden');
        document.getElementById('screen-app').classList.remove('hidden');
        document.getElementById('screen-app').classList.add('active');
        renderSidebarUser();
        navigate('albums');
    }

    function renderSidebarUser() {
        const u = state.user;
        document.getElementById('sidebar-user').innerHTML = `
            <div class="user-avatar">${u.initials || getInitials(u.name)}</div>
            <div class="user-info-meta">
                <div class="user-name">${escHtml(u.name)}</div>
                <div class="user-email">${escHtml(u.email)}</div>
            </div>
        `;
    }

    /* ========== NAVEGAÇÃO ENTRE TELAS ========== */
    function navigate(view) {
        document.querySelectorAll('.view').forEach(v => v.classList.replace('active', 'hidden'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        const el = document.getElementById('view-' + view);
        if (el) el.classList.replace('hidden', 'active');

        const navMap = { albums: 0, favorites: 1, timeline: 2 };
        const navItems = document.querySelectorAll('.nav-item');
        if (navMap[view] !== undefined && navItems[navMap[view]]) navItems[navMap[view]].classList.add('active');

        if (view === 'albums') renderAlbums();
        if (view === 'favorites') renderFavorites();
        if (view === 'timeline') renderTimeline();

        document.getElementById('sidebar').classList.remove('open');
    }

    function toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
    }

    /* ========== GERENCIAMENTO DE ÁLBUNS ========== */
    function renderAlbums() {
        const grid = document.getElementById('albums-grid');
        const empty = document.getElementById('albums-empty');
        const count = document.getElementById('albums-count');

        if (!state.albums.length) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            count.textContent = '';
            return;
        }

        empty.classList.add('hidden');
        count.textContent = `${state.albums.length} álbum${state.albums.length !== 1 ? 's' : ''}`;

        grid.innerHTML = state.albums.map(album => {
            const cover = album.photos && album.photos[0];
            const coverHtml = cover
                ? `<div class="album-cover"><img src="${cover.url}" alt="" loading="lazy" /></div>`
                : `<div class="album-cover-placeholder">${categoryEmoji(album.category)}</div>`;

            const dateLabel = album.commemorative_date
                ? `<span class="album-date-badge">${formatDate(album.commemorative_date)}</span>`
                : '';

            return `
                <div class="album-card" onclick="App.openAlbum('${album.id}')">
                    ${coverHtml}
                    <div class="album-info">
                        <span class="album-category-badge">${categoryEmoji(album.category)} ${categoryLabel(album.category)}</span>
                        <div class="album-title">${escHtml(album.title)}</div>
                        <div class="album-meta">
                            <span>${album.photos ? album.photos.length : 0} foto${album.photos?.length !== 1 ? 's' : ''}</span>
                            ${dateLabel}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function openAlbum(id) {
        state.currentAlbumId = id;
        const album = state.albums.find(a => a.id === id);
        if (!album) return;

        navigate('album-detail');

        const dateInfo = album.commemorative_date
            ? `<span class="album-date-badge">📅 ${formatDate(album.commemorative_date)}</span>` : '';
        const favCount = album.photos ? album.photos.filter(p => p.fav).length : 0;

        document.getElementById('album-detail-header').innerHTML = `
            <div class="album-detail-main">
                <div class="album-detail-title">${escHtml(album.title)}</div>
                ${album.description ? `<div class="album-detail-desc">${escHtml(album.description)}</div>` : ''}
                <div class="album-detail-badges">
                    <span class="album-category-badge">${categoryEmoji(album.category)} ${categoryLabel(album.category)}</span>
                    ${dateInfo}
                    <span class="album-category-badge" style="background:var(--purple-light);color:var(--purple-dark)">
                        ${album.photos ? album.photos.length : 0} foto${album.photos?.length !== 1 ? 's' : ''}
                    </span>
                    ${favCount ? `<span class="album-category-badge" style="background:#FFF0F3;color:#c0392b">♥ ${favCount} favorita${favCount !== 1 ? 's' : ''}</span>` : ''}
                </div>
            </div>
        `;

        renderPhotoGrid('album-photos-grid', 'album-photos-empty', album.photos || []);
    }

    function openNewAlbum() {
        document.getElementById('album-title').value = '';
        document.getElementById('album-desc').value = '';
        document.getElementById('album-date').value = '';
        document.getElementById('album-category').value = 'amor';
        openModal('modal-album');
    }

    async function createAlbum() {
        const title = document.getElementById('album-title').value.trim();
        if (!title) { toast('Dê um nome ao álbum ♥'); return; }

        const albumData = {
            usuario_id: state.user.id,
            title,
            description: document.getElementById('album-desc').value.trim(),
            category: document.getElementById('album-category').value,
            commemorative_date: document.getElementById('album-date').value || null
        };

        try {
            const { data: newAlbum, error } = await supabase
                .from('albuns')
                .insert([albumData])
                .select()
                .single();

            if (error) throw error;

            newAlbum.photos = [];
            state.albums.unshift(newAlbum);

            closeModalById('modal-album');
            toast('Álbum criado com sucesso! ✨');
            openAlbum(newAlbum.id);
        } catch (e) {
            console.error(e);
            toast('❌ Erro ao criar álbum no banco.');
        }
    }

    async function deleteAlbum() {
        if (!confirm('Tem certeza que deseja excluir este álbum e todas as fotos dele permanentemente?')) return;

        try {
            const { error } = await supabase
                .from('albuns')
                .delete()
                .eq('id', state.currentAlbumId);

            if (error) throw error;

            state.albums = state.albums.filter(a => a.id !== state.currentAlbumId);
            toast('Álbum removido da nuvem.');
            navigate('albums');
        } catch (e) {
            console.error(e);
            toast('❌ Erro ao deletar álbum.');
        }
    }

    /* ========== EXIBIÇÃO DE FOTOS (GRIDS) ========== */
    function renderPhotoGrid(gridId, emptyId, photos) {
        const grid = document.getElementById(gridId);
        const empty = document.getElementById(emptyId);

        if (!photos || !photos.length) {
            grid.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }

        if (empty) empty.classList.add('hidden');

        grid.innerHTML = photos.map((photo, i) => `
            <div class="photo-item ${photo.fav ? 'is-fav' : ''}" onclick="App.openLightbox('${gridId}', ${i})">
                <img src="${photo.url}" alt="${escHtml(photo.caption)}" loading="lazy" />
                <div class="photo-overlay">
                    ${photo.caption ? `<span class="photo-caption">${escHtml(photo.caption)}</span>` : ''}
                </div>
                <button class="photo-fav" onclick="App.toggleFav(event, '${photo.id}')" title="${photo.fav ? 'Remover favorito' : 'Favoritar'}">
                    ${photo.fav ? '♥' : '♡'}
                </button>
            </div>
        `).join('');
    }

    async function toggleFav(event, photoId) {
        if (event) event.stopPropagation();

        let targetPhoto = null;
        state.albums.forEach(a => {
            const p = a.photos.find(photo => photo.id === photoId);
            if (p) targetPhoto = p;
        });

        if (!targetPhoto) return;
        const novoStatusFav = !targetPhoto.fav;

        try {
            const { error } = await supabase
                .from('fotos')
                .update({ fav: novoStatusFav })
                .eq('id', photoId);

            if (error) throw error;

            targetPhoto.fav = novoStatusFav;

            if (document.getElementById('view-album-detail').classList.contains('active')) {
                const a = state.albums.find(album => album.id === state.currentAlbumId);
                if (a) renderPhotoGrid('album-photos-grid', 'album-photos-empty', a.photos);
            } else if (document.getElementById('view-favorites').classList.contains('active')) {
                renderFavorites();
            }
        } catch (e) {
            console.error(e);
            toast('❌ Erro ao salvar favorito.');
        }
    }

    /* ========== FAVORITOS EM TEMPO REAL ========== */
    function renderFavorites() {
        const allFavs = [];
        state.albums.forEach(a => a.photos.filter(p => p.fav).forEach(p => allFavs.push({ ...p, _albumId: a.id })));

        const grid = document.getElementById('favorites-grid');
        const empty = document.getElementById('favorites-empty');

        if (!allFavs.length) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        grid.innerHTML = allFavs.map((photo, i) => `
            <div class="photo-item is-fav" onclick="App.openGlobalLightbox(${i})">
                <img src="${photo.url}" alt="${escHtml(photo.caption)}" loading="lazy" />
                <div class="photo-overlay">
                    <span class="photo-caption">${photo.caption ? escHtml(photo.caption) : 'Favorita'}</span>
                </div>
                <button class="photo-fav" onclick="App.toggleFavGlobal(event, '${photo.id}')">♥</button>
            </div>
        `).join('');

        state.lightbox = { photos: allFavs, index: 0 };
    }

    function toggleFavGlobal(event, photoId) {
        event.stopPropagation();
        toggleFav(null, photoId);
        renderFavorites();
    }

    function openGlobalLightbox(index) {
        const allFavs = [];
        state.albums.forEach(a => a.photos.filter(p => p.fav).forEach(p => allFavs.push({ ...p, _albumId: a.id })));
        state.lightbox = { photos: allFavs, index };
        showLightbox();
    }

    /* ========== LINHA DO TEMPO CRONOLÓGICA ========== */
    function renderTimeline() {
        const container = document.getElementById('timeline-content');
        const allPhotos = [];
        state.albums.forEach(a => a.photos.forEach(p => allPhotos.push({ ...p, _albumTitle: a.title, _albumId: a.id })));

        if (!allPhotos.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <h3>Sua linha do tempo está vazia</h3>
                    <p>Adicione fotos com datas aos seus álbuns para construir sua história.</p>
                </div>`;
            return;
        }

        allPhotos.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const groups = {};
        allPhotos.forEach(p => {
            const key = p.date ? p.date.substring(0, 7) : 'sem-data';
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });

        container.innerHTML = Object.entries(groups).map(([month, photos]) => `
            <div class="timeline-group">
                <div class="timeline-month">${formatMonth(month)}</div>
                <div class="photo-grid">
                    ${photos.map((photo) => `
                        <div class="photo-item" onclick="App.openTimelineLightbox('${photo.id}')">
                            <img src="${photo.url}" alt="${escHtml(photo.caption)}" loading="lazy" />
                            <div class="photo-overlay">
                                <span class="photo-caption">${escHtml(photo._albumTitle)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    function openTimelineLightbox(photoId) {
        const allPhotos = [];
        state.albums.forEach(a => a.photos.forEach(p => allPhotos.push(p)));
        allPhotos.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const idx = allPhotos.findIndex(p => p.id === photoId);
        if (idx !== -1) {
            state.lightbox = { photos: allPhotos, index: idx };
            showLightbox();
        }
    }

    /* ========== UPLOAD E DRAG & DROP ========== */
    function openUpload() {
        state.pendingFiles = [];
        document.getElementById('preview-grid').innerHTML = '';
        document.getElementById('preview-grid').classList.add('hidden');
        document.getElementById('btn-upload').disabled = true;
        document.getElementById('file-input').value = '';
        openModal('modal-upload');
    }

    function onDragOver(e) { e.preventDefault(); document.getElementById('upload-zone').classList.add('drag-over'); }
    function onDragLeave(e) { document.getElementById('upload-zone').classList.remove('drag-over'); }
    function onDrop(e) { e.preventDefault(); document.getElementById('upload-zone').classList.remove('drag-over'); handleFiles(Array.from(e.dataTransfer.files)); }
    function onFileSelect(e) { handleFiles(Array.from(e.target.files)); }

    async function handleFiles(files) {
        const valid = files.filter(f => f.type.startsWith('image/'));
        if (valid.length < files.length) toast('Apenas arquivos de imagem são suportados.');

        toast('Otimizando tamanho das fotos... ⚡');

        for (const file of valid) {
            const compressedUrl = await compressImage(file, 1200, 0.7);
            const entry = {
                id: 'temp_' + Date.now(),
                url: compressedUrl,
                caption: '',
                date: new Date().toISOString().split('T')[0]
            };
            state.pendingFiles.push(entry);
            renderPreview();
        }
    }

    function renderPreview() {
        const grid = document.getElementById('preview-grid');
        if (!state.pendingFiles.length) {
            grid.classList.add('hidden');
            document.getElementById('btn-upload').disabled = true;
            return;
        }
        grid.classList.remove('hidden');
        document.getElementById('btn-upload').disabled = false;
        grid.innerHTML = state.pendingFiles.map((f, i) => `
            <div class="preview-item">
                <img src="${f.url}" alt="" />
                <button class="preview-remove" onclick="App.removePreview(${i})">×</button>
            </div>
        `).join('');
    }

    function removePreview(i) {
        state.pendingFiles.splice(i, 1);
        renderPreview();
    }

    async function uploadPhotos() {
        if (!state.pendingFiles.length) return;
        const album = state.albums.find(a => a.id === state.currentAlbumId);
        if (!album) return;

        const photosToInsert = state.pendingFiles.map(file => ({
            album_id: state.currentAlbumId,
            url: file.url,
            caption: file.caption || '',
            date: file.date || new Date().toISOString().split('T')[0]
        }));

        toast('Enviando memórias para a nuvem... ☁️');

        try {
            const { data: insertedPhotos, error } = await supabase
                .from('fotos')
                .insert(photosToInsert)
                .select();

            if (error) throw error;

            album.photos.push(...insertedPhotos);
            closeModalById('modal-upload');
            toast(`${insertedPhotos.length} foto(s) guardada(s) com sucesso! ♥`);
            state.pendingFiles = [];
            openAlbum(album.id);
        } catch (e) {
            console.error(e);
            toast('❌ Falha ao salvar fotos no banco.');
        }
    }

    /* ========== LIGHTBOX AVANÇADO DE FOTOS ========== */
    function openLightbox(gridId, index) {
        const album = state.albums.find(a => a.id === state.currentAlbumId);
        if (!album) return;
        state.lightbox = { photos: album.photos, index };
        showLightbox();
    }

    function showLightbox() {
        const { photos, index } = state.lightbox;
        const photo = photos[index];
        if (!photo) return;

        document.getElementById('lb-img').src = photo.url;
        document.getElementById('lb-caption').textContent = photo.caption || 'Sem legenda';
        document.getElementById('lb-counter').textContent = `${index + 1} / ${photos.length}`;
        updateLbFavBtn(photo.fav);

        document.getElementById('lightbox').classList.replace('hidden', 'active');
        document.body.style.overflow = 'hidden';
    }

    function updateLbFavBtn(isFav) {
        const btn = document.getElementById('lb-fav-btn');
        if (btn) isFav ? btn.classList.add('is-fav') : btn.classList.remove('is-fav');
    }

    function closeLightbox(event) {
        if (event.target === document.getElementById('lightbox')) closeLightboxDirect();
    }

    function closeLightboxDirect() {
        document.getElementById('lightbox').classList.replace('active', 'hidden');
        document.body.style.overflow = '';
    }

    function lbPrev(e) { if (e) e.stopPropagation(); const len = state.lightbox.photos.length; if (!len) return; state.lightbox.index = (state.lightbox.index - 1 + len) % len; showLightbox(); }
    function lbNext(e) { if (e) e.stopPropagation(); const len = state.lightbox.photos.length; if (!len) return; state.lightbox.index = (state.lightbox.index + 1) % len; showLightbox(); }

    async function toggleLightboxFav() {
        const { photos, index } = state.lightbox;
        const photo = photos[index];
        if (!photo) return;

        await toggleFav(null, photo.id);
        photo.fav = !photo.fav;
        updateLbFavBtn(photo.fav);
    }

    async function deletePhoto() {
        if (!confirm('Remover esta foto permanentemente da nuvem?')) return;
        const { photos, index } = state.lightbox;
        const photo = photos[index];

        try {
            const { error } = await supabase.from('fotos').delete().eq('id', photo.id);
            if (error) throw error;

            state.albums.forEach(a => { a.photos = a.photos.filter(p => p.id !== photo.id); });
            closeLightboxDirect();
            toast('Foto removida da nuvem.');
            if (state.currentAlbumId) openAlbum(state.currentAlbumId);
        } catch (e) {
            console.error(e); toast('❌ Erro ao deletar foto.');
        }
    }

    async function editLightboxCaption() {
        const { photos, index } = state.lightbox;
        const photo = photos[index];
        if (!photo) return;

        const newCaption = prompt("Digite uma nova legenda para essa memória:", photo.caption || "");
        if (newCaption === null) return;

        try {
            const { error } = await supabase.from('fotos').update({ caption: newCaption }).eq('id', photo.id);
            if (error) throw error;

            photo.caption = newCaption;
            state.albums.forEach(a => { const p = a.photos.find(p => p.id === photo.id); if (p) p.caption = newCaption; });

            document.getElementById('lb-caption').textContent = newCaption;
            toast('Legenda salva! 📝');
            if (state.currentAlbumId) openAlbum(state.currentAlbumId);
        } catch (e) {
            console.error(e); toast('❌ Erro ao salvar legenda.');
        }
    }

    /* ========== SISTEMA DE COMPARTILHAMENTO DE LINKS ========== */
    function shareAlbum() {
        const link = `${window.location.origin}${window.location.pathname}?share=${state.currentAlbumId}`;
        document.getElementById('share-link').value = link;
        openModal('modal-share');
    }

    function copyLink() {
        const input = document.getElementById('share-link');
        input.select();
        navigator.clipboard.writeText(input.value)
            .then(() => toast('Link copiado! Envie para quem você ama ✓'))
            .catch(() => { document.execCommand('copy'); toast('Link copiado! ✓'); });
    }

    /* ========== CONTROLE DE MODAL ========== */
    function openModal(id) { const el = document.getElementById(id); if (el) el.classList.replace('hidden', 'active'); }
    function closeModalById(id) { const el = document.getElementById(id); if (el) el.classList.replace('active', 'hidden'); }
    function closeModal(id, event) { if (event.target === document.getElementById(id)) closeModalById(id); }

    /* ========== AUXILIARES / UTILITÁRIOS ========== */
    function showLoadingBtn(btnId, isLoading) {
        const btn = document.getElementById(btnId); if (!btn) return;
        if (isLoading) { btn.dataset.oldText = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span> Carregando...`; btn.disabled = true; }
        else { btn.innerHTML = btn.dataset.oldText || btn.innerHTML; btn.disabled = false; }
    }

    function hashSimple(str) {
        let h = 0; for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        return 'h_' + Math.abs(h).toString(36);
    }

    function getInitials(name) { return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); }
    function escHtml(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatMonth(key) {
        if (key === 'sem-data') return 'Sem data';
        const [y, m] = key.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    function categoryLabel(cat) { return { amor: 'Amor', viagem: 'Viagem', aniversario: 'Aniversário', cotidiano: 'Cotidiano', especial: 'Especial', familia: 'Família' }[cat] || cat; }
    function categoryEmoji(cat) { return { amor: '💑', viagem: '✈️', aniversario: '🎂', cotidiano: '🌿', especial: '⭐', familia: '👨‍👩‍👧' }[cat] || '📷'; }

    /* ========== TOAST NOTIFICATION ========== */
    let toastTimer;
    function toast(msg) {
        let el = document.getElementById('toast');
        if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'hidden'; document.body.appendChild(el); }
        el.textContent = msg; el.classList.replace('hidden', 'active');
        clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.replace('active', 'hidden'), 3500);
    }

    function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }

    /* ========== CONTROLES DE TECLADO (LIGHTBOX) ========== */
    document.addEventListener('keydown', e => {
        const lb = document.getElementById('lightbox');
        if (lb && !lb.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') lbPrev(e);
            if (e.key === 'ArrowRight') lbNext(e);
            if (e.key === 'Escape') closeLightboxDirect();
        }
    });

    /* ========== INICIALIZAÇÃO SISTEMA ========== */
    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedAlbumId = urlParams.get('share');
        if (sharedAlbumId) { setTimeout(() => openAlbum(sharedAlbumId), 500); }
    }

    document.addEventListener('DOMContentLoaded', init);

    /* ========== INTERFACE PÚBLICA (API) ========== */
    return {
        login, register, logout, showLogin, showRegister, navigate, toggleSidebar,
        openAlbum, openNewAlbum, createAlbum, deleteAlbum,
        openUpload, onDragOver, onDragLeave, onDrop, onFileSelect, removePreview, uploadPhotos,
        shareAlbum, copyLink, openLightbox, openGlobalLightbox, openTimelineLightbox, closeLightbox, closeLightboxDirect,
        lbPrev, lbNext, toggleLightboxFav, deletePhoto, toggleFav, toggleFavGlobal, editLightboxCaption, openModal, closeModal
    };
})();