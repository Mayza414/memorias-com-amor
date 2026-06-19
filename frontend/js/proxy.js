// Proxy para evitar CORS
const API_URL = 'http://172.24.208.1:8000/api';

// Substitui o fetch original para adicionar o proxy
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    // Se for uma requisição para a API, usa o proxy
    if (url.startsWith('/api/') || url.includes('/api/')) {
        const newUrl = url.replace('/api/', API_URL + '/');
        return originalFetch(newUrl, options);
    }
    return originalFetch(url, options);
};
