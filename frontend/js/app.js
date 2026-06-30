/* =====================================================
   MEMÓRIAS COM AMOR — app.js (VERSÃO COMPLETA)
   ===================================================== */

const API_URL = 'https://memorias-com-amor.onrender.com/api';

/* ========== API CLIENT ========== */
const ApiClient = {
  async request(endpoint, method = 'GET', body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.message || 'Erro na requisição');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Sem conexão com o servidor.');
      }
      throw err;
    }
  },
};

/* ========== AUTH ========== */
const Auth = {
  signUp: (email, password, name) => ApiClient.request('/auth/register', 'POST', { name, email, password }),
  signIn: (email, password) => ApiClient.request('/auth/login', 'POST', { email, password }),
  refresh: (refresh_token) => ApiClient.request('/auth/refresh', 'POST', { refresh_token }),
};

/* ========== DATABASE ========== */
const DB = {
  getAlbums: (token) => ApiClient.request('/albums', 'GET', null, token),
  createAlbum: (album, token) => ApiClient.request('/albums', 'POST', album, token),
  updateAlbum: (id, data, token) => ApiClient.request(`/albums/${id}`, 'PATCH', data, token),
  deleteAlbum: (id, token) => ApiClient.request(`/albums/${id}`, 'DELETE', null, token),
  getPhotos: (albumId, token) => ApiClient.request(`/photos/album/${albumId}`, 'GET', null, token),
  getAllPhotos: (token) => ApiClient.request('/photos/all', 'GET', null, token),
  updatePhoto: (id, data, token) => ApiClient.request(`/photos/${id}`, 'PATCH', data, token),
  deletePhoto: (id, token) => ApiClient.request(`/photos/${id}`, 'DELETE', null, token),
  toggleFav: (id, token) => ApiClient.request(`/photos/${id}/fav`, 'POST', null, token),

  async getFavorites(token) {
    const all = await ApiClient.request('/photos/all', 'GET', null, token);
    return all.filter(p => p.is_fav);
  },
};

/* ========== STORAGE ========== */
const Storage = {
  async upload(file, albumId, token, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('album_id', albumId);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/photos/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.detail || 'Erro no upload'));
        } catch {
          reject(new Error('Resposta inválida do servidor'));
        }
      };

      xhr.onerror = () => reject(new Error('Falha na conexão'));
      xhr.send(formData);
    });
  },
};

/* ========== APP ========== */
const App = {
  user: null,
  albums: [],
  currentAlbumId: null,
  currentPhotos: [],
  pendingFiles: [],
  lightbox: { photos: [], index: 0 },

  // ========== SESSÃO ==========
  saveSession() {
    try {
      localStorage.setItem('mca_session', JSON.stringify({
        id: this.user.id,
        email: this.user.email,
        name: this.user.name,
        token: this.user.token,
        refreshToken: this.user.refreshToken,
      }));
    } catch { }
  },

  clearSession() {
    try { localStorage.removeItem('mca_session'); } catch { }
  },

  async restoreSession() {
    try {
      const saved = JSON.parse(localStorage.getItem('mca_session') || 'null');
      if (!saved?.refreshToken) return false;
      const tokens = await Auth.refresh(saved.refreshToken);
      this.user = { ...saved, token: tokens.access_token, refreshToken: tokens.refresh_token };
      this.saveSession();
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  },

  // ========== AUTH ==========
  async login() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');

    errEl.classList.add('hidden');
    if (!email || !pass) {
      errEl.textContent = 'Preencha e-mail e senha.';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.querySelector('#tab-login .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Entrando…';

    try {
      const auth = await Auth.signIn(email, pass);
      this.user = {
        id: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        token: auth.access_token,
        refreshToken: auth.refresh_token,
      };
      this.saveSession();
      this.bootApp();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  },

  async register() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const errEl = document.getElementById('reg-error');

    errEl.classList.add('hidden');

    if (!name) {
      errEl.textContent = 'Informe seu nome.';
      errEl.classList.remove('hidden');
      return;
    }
    if (!email || !email.includes('@')) {
      errEl.textContent = 'E-mail inválido.';
      errEl.classList.remove('hidden');
      return;
    }
    if (pass.length < 6) {
      errEl.textContent = 'Senha mínima de 6 caracteres.';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.querySelector('#tab-register .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Criando conta…';

    try {
      const auth = await Auth.signUp(email, pass, name);
      this.user = {
        id: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        token: auth.access_token,
        refreshToken: auth.refresh_token,
      };
      this.saveSession();
      this.bootApp();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Criar conta';
    }
  },

  async loginDemo() {
    document.getElementById('login-email').value = 'demo@email.com';
    document.getElementById('login-pass').value = '123456';
    await this.login();
  },

  logout() {
    this.clearSession();
    this.user = null;
    this.albums = [];
    this.currentPhotos = [];

    document.getElementById('screen-auth').classList.remove('hidden');
    document.getElementById('screen-auth').classList.add('active');
    document.getElementById('screen-app').classList.add('hidden');
    document.getElementById('screen-app').classList.remove('active');

    this.toast('Até logo! 👋');
  },

  showLogin() {
    document.getElementById('tab-login').classList.remove('hidden');
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.add('hidden');
  },

  showRegister() {
    document.getElementById('tab-register').classList.remove('hidden');
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.add('hidden');
  },

  // ========== BOOT ==========
  bootApp() {
    document.getElementById('screen-auth').classList.add('hidden');
    document.getElementById('screen-auth').classList.remove('active');
    document.getElementById('screen-app').classList.remove('hidden');
    document.getElementById('screen-app').classList.add('active');

    this.renderSidebarUser();
    this.restoreSidebarState();
    this.navigate('albums');
  },

  renderSidebarUser() {
    const u = this.user;
    const avatar = document.querySelector('.user-avatar');
    const name = document.querySelector('.user-name');
    const email = document.querySelector('.user-email');

    if (avatar) avatar.textContent = this.getInitials(u.name);
    if (name) name.textContent = u.name;
    if (email) email.textContent = u.email;
  },

  // ========== NAVEGAÇÃO ==========
  navigate(view) {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.classList.add('hidden');
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    const el = document.getElementById('view-' + view);
    if (el) {
      el.classList.remove('hidden');
      el.classList.add('active');
    }

    const navMap = { albums: 0, favorites: 1, timeline: 2, profile: 3, shared: 4 };
    const navItems = document.querySelectorAll('.nav-item');
    if (navMap[view] !== undefined) {
      const ni = navItems[navMap[view]];
      if (ni) ni.classList.add('active');
    }

    if (view === 'albums') {
      this.loadAlbums();
      this.loadSharedAlbums();
    }
    if (view === 'shared') this.loadSharedAlbumsView();
    if (view === 'favorites') this.loadFavorites();
    if (view === 'timeline') this.loadTimeline();
    if (view === 'profile') this.loadProfile();

    this.closeSidebar();
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  },

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  },

  // ========== MINIMIZAR SIDEBAR ==========
  toggleSidebarMinimize() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('minimized');
      const isMinimized = sidebar.classList.contains('minimized');
      localStorage.setItem('sidebar_minimized', isMinimized);
    }
  },

  restoreSidebarState() {
    const isMinimized = localStorage.getItem('sidebar_minimized') === 'true';
    const sidebar = document.getElementById('sidebar');
    if (sidebar && isMinimized) {
      sidebar.classList.add('minimized');
    }
  },

  // ========== SOCIAL LOGIN ==========
  handleRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const authError = urlParams.get('auth_error');
    
    if (authError) {
      this.toast('Erro no login social: ' + authError, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    if (token) {
      window.history.replaceState({}, document.title, window.location.pathname);
      this.fetchUserFromToken(token);
    }
  },

  async fetchUserFromToken(token) {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Erro ao buscar usuário');
      
      const userData = await response.json();
      
      this.user = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        token: token,
        refreshToken: null,
      };
      
      this.saveSession();
      this.bootApp();
      this.toast('Login realizado com sucesso! 🎉', 'success');
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      this.toast('Erro ao fazer login social', 'error');
      this.showLogin();
    }
  },

  loginWithGoogle() {
    window.location.href = 'https://memorias-com-amor.onrender.com/api/auth/google/login';
  },

  loginWithGitHub() {
    window.location.href = 'https://memorias-com-amor.onrender.com/api/auth/github/login';
  },

  // ========== CHECAR PARÂMETRO DO ÁLBUM ==========
  checkAlbumParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get('album');
    
    if (albumId) {
      const checkAlbums = setInterval(() => {
        if (this.albums.length > 0) {
          clearInterval(checkAlbums);
          const album = this.albums.find(a => a.id === albumId);
          if (album) {
            this.openAlbum(albumId);
          } else {
            this.toast('Álbum não encontrado ou não compartilhado', 'error');
          }
        }
      }, 500);
      
      setTimeout(() => clearInterval(checkAlbums), 10000);
    }
  },

  // ========== ÁLBUNS ==========
  async loadAlbums() {
    const grid = document.getElementById('albums-grid');
    const empty = document.getElementById('albums-empty');

    if (empty) empty.classList.add('hidden');
    if (grid) grid.innerHTML = '<div style="color:var(--text-muted);padding:2rem;text-align:center;grid-column:1/-1">Carregando...</div>';

    try {
      this.albums = await DB.getAlbums(this.user.token);
      this.renderAlbums();
    } catch (e) {
      if (grid) grid.innerHTML = '';
      this.toast('Erro: ' + e.message, 'error');
    }
  },

  renderAlbums() {
    const grid = document.getElementById('albums-grid');
    const empty = document.getElementById('albums-empty');
    const count = document.getElementById('albums-count');

    if (!this.albums.length) {
      if (grid) grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      if (count) count.textContent = '';
      return;
    }

    if (empty) empty.classList.add('hidden');
    if (count) count.textContent = `${this.albums.length} álbum${this.albums.length !== 1 ? 's' : ''}`;

    if (grid) {
      grid.innerHTML = this.albums.map(album => `
        <div class="album-card" onclick="App.openAlbum('${album.id}')">
          ${album.cover_url
          ? `<div class="album-cover"><img src="${album.cover_url}" alt="" loading="lazy" /></div>`
          : `<div class="album-cover-placeholder">${this.categoryEmoji(album.category)}</div>`}
          <div class="album-info">
            <span class="album-category-badge">${this.categoryEmoji(album.category)} ${this.categoryLabel(album.category)}</span>
            <div class="album-title">${album.title}</div>
            <div class="album-meta">
              <span>${album.photo_count || 0} foto${album.photo_count !== 1 ? 's' : ''}</span>
              ${album.commemorative_date ? `<span class="album-date-badge">${this.formatDate(album.commemorative_date)}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }
  },

  async openAlbum(id) {
    this.currentAlbumId = id;
    const album = this.albums.find(a => a.id === id);
    if (!album) return;

    this.navigate('album-detail');

    const detailView = document.getElementById('view-album-detail');
    if (detailView) {
      detailView.classList.remove('hidden');
      detailView.classList.add('active');
    }

    this.renderAlbumDetailHeader(album, []);

    const grid = document.getElementById('album-photos-grid');
    if (grid) {
      grid.innerHTML = '<div style="color:var(--text-muted);padding:2rem;text-align:center">Carregando fotos…</div>';
    }

    document.getElementById('album-photos-empty').classList.add('hidden');

    try {
      this.currentPhotos = await DB.getPhotos(id, this.user.token);
      this.renderAlbumDetailHeader(album, this.currentPhotos);
      this.renderPhotoGrid('album-photos-grid', 'album-photos-empty', this.currentPhotos);
    } catch (e) {
      if (grid) grid.innerHTML = '';
      this.toast('Erro: ' + e.message, 'error');
    }
  },

  renderAlbumDetailHeader(album, photos) {
    const header = document.getElementById('album-detail-header');
    if (!header) return;
    header.innerHTML = `
      <div class="album-detail-title">${album.title}</div>
      ${album.description ? `<div class="album-detail-desc">${album.description}</div>` : ''}
      <div class="album-detail-badges">
        <span class="album-category-badge">${this.categoryEmoji(album.category)} ${this.categoryLabel(album.category)}</span>
        ${album.commemorative_date ? `<span class="album-date-badge">📅 ${this.formatDate(album.commemorative_date)}</span>` : ''}
        <span class="album-category-badge" style="background:var(--purple-light);color:var(--purple-dark)">
          ${photos.length} foto${photos.length !== 1 ? 's' : ''}
        </span>
      </div>`;
  },

  openNewAlbum() {
    document.getElementById('album-title').value = '';
    document.getElementById('album-desc').value = '';
    document.getElementById('album-date').value = '';
    document.getElementById('album-category').value = 'amor';
    this.openModal('modal-album');
  },

  async createAlbum() {
    const title = document.getElementById('album-title').value.trim();
    if (!title) {
      this.toast('Dê um nome ao álbum ♥', 'error');
      return;
    }

    const album = {
      title,
      description: document.getElementById('album-desc').value.trim(),
      category: document.getElementById('album-category').value,
      commemorative_date: document.getElementById('album-date').value || null,
    };

    const btn = document.querySelector('#modal-album .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Criando…';

    try {
      const created = await DB.createAlbum(album, this.user.token);
      this.toast('Álbum criado! ✨', 'success');
      this.closeModalById('modal-album');
      this.albums.unshift(created);
      this.currentAlbumId = created.id;
      this.currentPhotos = [];

      this.navigate('album-detail');
      const detailView = document.getElementById('view-album-detail');
      if (detailView) {
        detailView.classList.remove('hidden');
        detailView.classList.add('active');
      }

      this.renderAlbumDetailHeader(created, []);
      this.renderPhotoGrid('album-photos-grid', 'album-photos-empty', []);
    } catch (e) {
      this.toast('Erro: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Criar álbum';
    }
  },

  async deleteAlbum() {
    if (!confirm('Excluir este álbum e todas as fotos?')) return;
    try {
      await DB.deleteAlbum(this.currentAlbumId, this.user.token);
      this.albums = this.albums.filter(a => a.id !== this.currentAlbumId);
      this.toast('Álbum excluído.', 'success');
      this.navigate('albums');
      this.renderAlbums();
    } catch (e) {
      this.toast('Erro: ' + e.message, 'error');
    }
  },

  // ========== FOTOS ==========
  renderPhotoGrid(gridId, emptyId, photos) {
    const grid = document.getElementById(gridId);
    const empty = document.getElementById(emptyId);

    if (!grid) return;

    if (!photos.length) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    grid.innerHTML = photos.map((photo, i) => `
      <div class="photo-item ${photo.is_fav ? 'is-fav' : ''}" onclick="App.openLightbox(${i})">
        <img src="${photo.url}" alt="${photo.caption || ''}" loading="lazy" />
        <div class="photo-overlay">
          ${photo.caption ? `<span class="photo-caption">${photo.caption}</span>` : ''}
        </div>
        <button class="photo-fav" onclick="App.toggleFav(event,'${photo.id}',${photo.is_fav})">
          ${photo.is_fav ? '♥' : '♡'}
        </button>
      </div>
    `).join('');
  },

  async toggleFav(event, photoId, currentFav) {
    if (event) event.stopPropagation();
    try {
      await DB.toggleFav(photoId, this.user.token);
      const p = this.currentPhotos.find(p => p.id === photoId);
      if (p) p.is_fav = !p.is_fav;
      this.renderPhotoGrid('album-photos-grid', 'album-photos-empty', this.currentPhotos);
    } catch (e) {
      this.toast('Erro: ' + e.message, 'error');
    }
  },

  // ========== FAVORITOS ==========
  async loadFavorites() {
    const grid = document.getElementById('favorites-grid');
    const empty = document.getElementById('favorites-empty');

    if (!grid) return;
    grid.innerHTML = '<div style="color:var(--text-muted);padding:2rem;text-align:center">Carregando…</div>';

    try {
      const favs = await DB.getFavorites(this.user.token);

      if (!favs.length) {
        grid.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
      }

      if (empty) empty.classList.add('hidden');
      this.lightbox = { photos: favs, index: 0 };

      grid.innerHTML = favs.map((photo, i) => `
        <div class="photo-item is-fav" onclick="App.openGlobalLightbox(${i})">
          <img src="${photo.url}" alt="" loading="lazy" />
          <div class="photo-overlay">
            ${photo.caption ? `<span class="photo-caption">${photo.caption}</span>` : ''}
          </div>
          <button class="photo-fav" onclick="App.toggleFavGlobal(event,'${photo.id}')">♥</button>
        </div>
      `).join('');
    } catch (e) {
      grid.innerHTML = '';
      this.toast('Erro: ' + e.message, 'error');
    }
  },

  async toggleFavGlobal(event, photoId) {
    if (event) event.stopPropagation();
    try {
      await DB.toggleFav(photoId, this.user.token);
      this.toast('Removido dos favoritos', 'success');
      this.loadFavorites();
    } catch (e) {
      this.toast('Erro: ' + e.message, 'error');
    }
  },

  openGlobalLightbox(index) {
    this.lightbox.index = index;
    this.showLightbox();
  },

  // ========== TIMELINE ==========
  async loadTimeline() {
    const container = document.getElementById('timeline-content');
    if (!container) return;

    container.innerHTML = '<div style="color:var(--text-muted);padding:2rem;text-align:center">Carregando…</div>';

    try {
      const allPhotos = await DB.getAllPhotos(this.user.token);

      if (!allPhotos.length) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <h3>Ainda sem fotos</h3>
            <p>Adicione fotos aos seus álbuns para vê-las aqui</p>
          </div>`;
        return;
      }

      const groups = {};
      allPhotos.forEach(p => {
        const key = p.photo_date ? p.photo_date.substring(0, 7) : 'sem-data';
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });

      const sortedKeys = Object.keys(groups).sort((a, b) => {
        if (a === 'sem-data') return 1;
        if (b === 'sem-data') return -1;
        return b.localeCompare(a);
      });

      container.innerHTML = sortedKeys.map(month => `
        <div class="timeline-group">
          <div class="timeline-month">${this.formatMonth(month)}</div>
          <div class="photo-grid">
            ${groups[month].map(photo => `
              <div class="photo-item">
                <img src="${photo.url}" alt="" loading="lazy" />
                <div class="photo-overlay">
                  <span class="photo-caption">${photo.album?.title || ''}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = '';
      this.toast('Erro: ' + e.message, 'error');
    }
  },

  // ========== PERFIL ==========
  async loadProfile() {
    try {
      if (!this.user?.token) {
        this.logout();
        return;
      }

      const response = await fetch(`${API_URL}/profile/me`, {
        headers: {
          'Authorization': `Bearer ${this.user.token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.toast('Sessão expirada, faça login novamente', 'error');
          this.logout();
          return;
        }
        throw new Error('Erro ao carregar perfil');
      }

      const data = await response.json();
      document.getElementById('profile-name').textContent = data.name || 'Usuário';
      document.getElementById('profile-email').textContent = data.email || '';
      document.getElementById('profile-bio').textContent = data.bio || 'Sem bio ainda...';
      document.getElementById('stat-albums').textContent = data.albums_count || 0;
      document.getElementById('stat-photos').textContent = data.photos_count || 0;
      document.getElementById('stat-favorites').textContent = data.favorites_count || 0;

      const profileImg = document.getElementById('profile-img');
      if (profileImg) {
        profileImg.src = data.profile_pic || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">👤</text></svg>';
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      this.toast('Erro ao carregar perfil', 'error');
    }
  },

  editProfile() {
    const name = document.getElementById('profile-name').textContent;
    const bio = document.getElementById('profile-bio').textContent;

    document.getElementById('edit-name').value = name === 'Usuário' ? '' : name;
    document.getElementById('edit-bio').value = bio === 'Sem bio ainda...' ? '' : bio;

    this.openModal('modal-edit-profile');
  },

  async saveProfile() {
    const name = document.getElementById('edit-name').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();

    if (!this.user?.token) {
      this.logout();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/profile/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.user.token}`,
        },
        body: JSON.stringify({ name, bio }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.toast('Sessão expirada', 'error');
          this.logout();
          return;
        }
        throw new Error('Erro ao atualizar perfil');
      }

      if (name) {
        this.user.name = name;
        this.saveSession();
        this.renderSidebarUser();
      }

      this.closeModalById('modal-edit-profile');
      this.toast('Perfil atualizado! ✅', 'success');
      await this.loadProfile();
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      this.toast('Erro ao atualizar perfil', 'error');
    }
  },

  // ========== UPLOAD FOTO DE PERFIL ==========
  async uploadProfilePic(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.toast('Imagem muito grande (máx 5MB)', 'error');
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.toast('Formato não suportado', 'error');
      return;
    }

    if (!this.user?.token) {
      this.logout();
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/profile/upload-pic`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.user.token}` },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.toast('Sessão expirada', 'error');
          this.logout();
          return;
        }
        throw new Error('Erro no upload');
      }

      this.toast('Foto atualizada! 📸', 'success');
      await this.loadProfile();
    } catch (error) {
      console.error('Erro ao enviar foto:', error);
      this.toast('Erro ao atualizar foto', 'error');
    }
  },

  // ========== UPLOAD ==========
  openUpload() {
    this.pendingFiles = [];
    document.getElementById('preview-grid').innerHTML = '';
    document.getElementById('preview-grid').classList.add('hidden');
    document.getElementById('btn-upload').disabled = true;
    document.getElementById('file-input').value = '';
    this.openModal('modal-upload');
  },

  onDragOver(e) {
    e.preventDefault();
    document.getElementById('upload-zone').classList.add('drag-over');
  },

  onDragLeave() {
    document.getElementById('upload-zone').classList.remove('drag-over');
  },

  onDrop(e) {
    e.preventDefault();
    document.getElementById('upload-zone').classList.remove('drag-over');
    this.handleFiles(Array.from(e.dataTransfer.files));
  },

  onFileSelect(e) {
    this.handleFiles(Array.from(e.target.files));
  },

  handleFiles(files) {
    const MAX_MB = 20;
    const valid = files.filter(f => f.type.startsWith('image/') && f.size <= MAX_MB * 1024 * 1024);
    const ignored = files.length - valid.length;
    if (ignored) this.toast(`${ignored} arquivo(s) ignorado(s) — máx. ${MAX_MB}MB.`, 'error');

    valid.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        this.pendingFiles.push({ id: crypto.randomUUID(), url: ev.target.result, _file: file });
        this.renderPreviews();
      };
      reader.readAsDataURL(file);
    });
  },

  renderPreviews() {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;

    grid.innerHTML = this.pendingFiles.map((f, i) => `
      <div class="preview-item">
        <img src="${f.url}" alt="" />
        <button class="preview-remove" onclick="App.removePreview(${i})" aria-label="Remover imagem">×</button>
      </div>
    `).join('');
    grid.classList.toggle('hidden', this.pendingFiles.length === 0);
    document.getElementById('btn-upload').disabled = this.pendingFiles.length === 0;
  },

  removePreview(i) {
    this.pendingFiles.splice(i, 1);
    this.renderPreviews();
  },

  async uploadPhotos() {
    if (!this.currentAlbumId || !this.pendingFiles.length) return;

    const btn = document.getElementById('btn-upload');
    btn.disabled = true;

    const total = this.pendingFiles.length;

    try {
      for (let i = 0; i < this.pendingFiles.length; i++) {
        const f = this.pendingFiles[i];
        btn.textContent = `Enviando ${i + 1}/${total}...`;

        const photo = await Storage.upload(f._file, this.currentAlbumId, this.user.token);
        this.currentPhotos.push(photo);
      }

      const album = this.albums.find(a => a.id === this.currentAlbumId);
      if (album) {
        album.photo_count = (album.photo_count || 0) + total;
        if (!album.cover_url && this.currentPhotos.length > 0) {
          album.cover_url = this.currentPhotos[0].url;
          await DB.updateAlbum(album.id, { cover_url: album.cover_url }, this.user.token).catch(() => { });
        }
      }

      this.closeModalById('modal-upload');
      this.toast(`${total} foto(s) enviadas! 📸`, 'success');
      this.pendingFiles = [];
      this.renderPhotoGrid('album-photos-grid', 'album-photos-empty', this.currentPhotos);
      const currentAlbum = this.albums.find(a => a.id === this.currentAlbumId);
      if (currentAlbum) this.renderAlbumDetailHeader(currentAlbum, this.currentPhotos);
    } catch (e) {
      this.toast('Erro ao enviar: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Adicionar fotos';
    }
  },

  // ========== COMPARTILHAMENTO ==========
  shareAlbum() {
    const shareLink = `${window.location.origin}${window.location.pathname}?album=${this.currentAlbumId}`;
    document.getElementById('share-link').value = shareLink;
    this.openModal('modal-share');
  },

  copyLink() {
    const input = document.getElementById('share-link');
    input.select();
    navigator.clipboard?.writeText(input.value).catch(() => document.execCommand('copy'));
    this.toast('Link copiado! ✓', 'success');
  },

  async shareAlbumWithUser() {
    const email = document.getElementById('share-email').value.trim();
    const token = this.user?.token;
    
    if (!email) {
      this.toast('Digite o e-mail do usuário', 'error');
      return;
    }
    
    if (!email.includes('@')) {
      this.toast('E-mail inválido', 'error');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/albums/${this.currentAlbumId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao compartilhar');
      }
      
      document.getElementById('share-link-output').value = data.share_link;
      document.getElementById('share-link-container').style.display = 'block';
      
      this.toast(`✅ ${data.message}`, 'success');
    } catch (error) {
      this.toast('Erro: ' + error.message, 'error');
    }
  },

  copyShareLink() {
    const input = document.getElementById('share-link-output');
    input.select();
    navigator.clipboard?.writeText(input.value).catch(() => document.execCommand('copy'));
    this.toast('Link copiado! ✓', 'success');
  },

  openShareModal() {
    document.getElementById('share-email').value = '';
    document.getElementById('share-link-container').style.display = 'none';
    document.getElementById('share-link-output').value = '';
    this.openModal('modal-share-album');
  },

  async loadSharedAlbums() {
    const grid = document.getElementById('shared-albums-grid');
    const empty = document.getElementById('shared-albums-empty');
    const section = document.getElementById('shared-albums-section');
    
    if (!grid || !empty || !section) return;
    
    try {
      const response = await fetch(`${API_URL}/albums/shared`, {
        headers: { 'Authorization': `Bearer ${this.user.token}` }
      });
      
      if (!response.ok) throw new Error('Erro ao carregar álbuns compartilhados');
      
      const albums = await response.json();
      
      if (!albums.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        section.classList.add('hidden');
        return;
      }
      
      section.classList.remove('hidden');
      empty.classList.add('hidden');
      
      grid.innerHTML = albums.map(album => `
        <div class="album-card" onclick="App.openSharedAlbum('${album.id}')">
          ${album.cover_url
            ? `<div class="album-cover"><img src="${album.cover_url}" alt="" loading="lazy" /></div>`
            : `<div class="album-cover-placeholder">${this.categoryEmoji(album.category)}</div>`}
          <div class="album-info">
            <span class="album-category-badge">${this.categoryEmoji(album.category)} ${this.categoryLabel(album.category)}</span>
            <div class="album-title">${album.title}</div>
            <div class="album-meta">
              <span>${album.photo_count || 0} fotos</span>
              <span class="shared-badge">🔗 Compartilhado</span>
            </div>
            <div class="album-owner" style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
              👤 Criado por: <strong>${album.owner_name || 'Usuário'}</strong>
            </div>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Erro ao carregar álbuns compartilhados:', error);
    }
  },

  async loadSharedAlbumsView() {
    const grid = document.getElementById('shared-albums-grid-full');
    const empty = document.getElementById('shared-albums-empty-full');
    
    if (!grid || !empty) return;
    
    try {
      const response = await fetch(`${API_URL}/albums/shared`, {
        headers: { 'Authorization': `Bearer ${this.user.token}` }
      });
      
      if (!response.ok) throw new Error('Erro ao carregar álbuns compartilhados');
      
      const albums = await response.json();
      
      if (!albums.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      
      empty.classList.add('hidden');
      
      grid.innerHTML = albums.map(album => `
        <div class="album-card" onclick="App.openSharedAlbum('${album.id}')">
          ${album.cover_url
            ? `<div class="album-cover"><img src="${album.cover_url}" alt="" loading="lazy" /></div>`
            : `<div class="album-cover-placeholder">${this.categoryEmoji(album.category)}</div>`}
          <div class="album-info">
            <span class="album-category-badge">${this.categoryEmoji(album.category)} ${this.categoryLabel(album.category)}</span>
            <div class="album-title">${album.title}</div>
            <div class="album-meta">
              <span>${album.photo_count || 0} fotos</span>
              <span class="shared-badge">🔗 Compartilhado</span>
            </div>
            <div class="album-owner" style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
              👤 Criado por: <strong>${album.owner_name || 'Usuário'}</strong>
            </div>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Erro ao carregar álbuns compartilhados:', error);
      grid.innerHTML = '';
      empty.classList.remove('hidden');
    }
  },

  async openSharedAlbum(albumId) {
    try {
      const response = await fetch(`${API_URL}/albums/${albumId}`, {
        headers: { 'Authorization': `Bearer ${this.user.token}` }
      });
      
      if (!response.ok) throw new Error('Erro ao carregar álbum');
      
      const album = await response.json();
      
      this.currentAlbumId = albumId;
      this.albums = [album, ...this.albums.filter(a => a.id !== albumId)];
      
      this.openAlbum(albumId);
    } catch (error) {
      this.toast('Erro ao abrir álbum compartilhado', 'error');
    }
  },

  // ========== LIGHTBOX ==========
  openLightbox(index) {
    this.lightbox = { photos: this.currentPhotos, index };
    this.showLightbox();
  },

  showLightbox() {
    const { photos, index } = this.lightbox;
    const photo = photos[index];
    if (!photo) return;

    document.getElementById('lb-img').src = photo.url;
    document.getElementById('lb-caption').textContent = photo.caption || '';
    document.getElementById('lb-counter').textContent = `${index + 1} / ${photos.length}`;

    const favIcon = document.getElementById('lb-fav-icon');
    const favBtn = document.getElementById('lb-fav-btn');
    if (favIcon) favIcon.setAttribute('fill', photo.is_fav ? '#D4537E' : 'none');
    if (favBtn) favBtn.classList.toggle('is-fav', !!photo.is_fav);

    document.getElementById('lightbox').classList.remove('hidden');
    document.getElementById('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  closeLightboxDirect() {
    document.getElementById('lightbox').classList.add('hidden');
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = '';
  },

  closeLightbox(e) {
    if (e.target.id === 'lightbox') this.closeLightboxDirect();
  },

  lbPrev(e) {
    if (e) e.stopPropagation();
    const len = this.lightbox.photos.length;
    this.lightbox.index = (this.lightbox.index - 1 + len) % len;
    this.showLightbox();
  },

  lbNext(e) {
    if (e) e.stopPropagation();
    this.lightbox.index = (this.lightbox.index + 1) % this.lightbox.photos.length;
    this.showLightbox();
  },

  async toggleLightboxFav() {
    const photo = this.lightbox.photos[this.lightbox.index];
    if (!photo) return;
    try {
      await DB.toggleFav(photo.id, this.user.token);
      photo.is_fav = !photo.is_fav;
      const p = this.currentPhotos.find(p => p.id === photo.id);
      if (p) p.is_fav = photo.is_fav;
      this.showLightbox();
    } catch (e) {
      this.toast('Erro ao favoritar: ' + e.message, 'error');
    }
  },

  async deletePhoto() {
    if (!confirm('Remover esta foto?')) return;
    const photo = this.lightbox.photos[this.lightbox.index];
    try {
      const response = await fetch(`${API_URL}/photos/${photo.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.user.token}` }
      });

      if (response.status === 204) {
        this.currentPhotos = this.currentPhotos.filter(p => p.id !== photo.id);
        this.lightbox.photos = this.lightbox.photos.filter(p => p.id !== photo.id);
        this.closeLightboxDirect();
        this.renderPhotoGrid('album-photos-grid', 'album-photos-empty', this.currentPhotos);
        
        const album = this.albums.find(a => a.id === this.currentAlbumId);
        if (album) {
          album.photo_count = Math.max(0, (album.photo_count || 1) - 1);
        }
        
        this.toast('Foto removida.', 'success');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Erro ao remover foto');
      
      this.toast('Foto removida.', 'success');
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      this.toast('Erro ao remover foto: ' + error.message, 'error');
    }
  },

  // ========== MODAIS ==========
  openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('active');
  },

  closeModalById(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('active');
  },

  closeModal(id, e) {
    if (e.target.id === id) this.closeModalById(id);
  },

  // ========== TOAST ==========
  toast(msg, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast' + (type ? ` toast-${type}` : '');
    el.classList.remove('hidden');
    el.classList.add('active');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('active');
    }, 3000);
  },

  // ========== HELPERS ==========
  getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  },

  formatDate(d) {
    if (!d) return '';
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  },

  formatMonth(ym) {
    if (ym === 'sem-data') return 'Sem data';
    const [y, m] = ym.split('-');
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${months[parseInt(m) - 1]} de ${y}`;
  },

  categoryEmoji(c) {
    const map = { amor: '💑', viagem: '✈️', aniversario: '🎂', cotidiano: '🌿', especial: '⭐', familia: '👨‍👩‍👧' };
    return map[c] || '📁';
  },

  categoryLabel(c) {
    const map = { amor: 'Amor', viagem: 'Viagem', aniversario: 'Aniversário', cotidiano: 'Cotidiano', especial: 'Especial', familia: 'Família' };
    return map[c] || c;
  },
};

/* ========== INIT ========== */
App.restoreSession().then(logado => {
  if (logado) {
    App.bootApp();
    App.checkAlbumParam();
  } else {
    App.handleRedirect();
  }
});

/* ========== EXPOSE ========== */
window.App = App;