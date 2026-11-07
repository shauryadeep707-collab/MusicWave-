/**
 * MusicWave - Unified API Client
 * Clean Fetch API wrapper with standardized error handling
 */
const API = {
    async request(endpoint, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(endpoint, config);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const error = new Error(data.error || `HTTP ${response.status}: Request failed`);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (err) {
            console.error(`[API Error] ${endpoint}:`, err);
            throw err;
        }
    },

    // Auth Endpoints
    getMe() {
        return this.request('/api/auth/me');
    },
    login(identifier, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: { identifier, password }
        });
    },
    register(username, email, password, displayName) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: { username, email, password, display_name: displayName }
        });
    },
    logout() {
        return this.request('/api/auth/logout', { method: 'POST' });
    },

    // Music Endpoints
    getGenres() {
        return this.request('/api/music/genres');
    },
    getTrending() {
        return this.request('/api/music/trending');
    },
    getRecommendations(genre) {
        return this.request(`/api/music/recommendations${genre ? `?genre=${encodeURIComponent(genre)}` : ''}`);
    },
    search(query) {
        return this.request(`/api/music/search?q=${encodeURIComponent(query)}`);
    },

    // Playlists
    getPlaylists() {
        return this.request('/api/playlists/');
    },
    createPlaylist(title, description, isPublic = true) {
        return this.request('/api/playlists/', {
            method: 'POST',
            body: { title, description, is_public: isPublic }
        });
    },

    // Favourites
    getFavourites() {
        return this.request('/api/favourites/');
    },
    toggleFavourite(trackId) {
        return this.request('/api/favourites/toggle', {
            method: 'POST',
            body: { track_id: trackId }
        });
    },

    // Downloads
    checkDownloadPermission(trackId) {
        return this.request(`/api/downloads/permissions/${trackId}`);
    },
    registerDownload(trackId, fileSize, mimeType) {
        return this.request('/api/downloads/register', {
            method: 'POST',
            body: { track_id: trackId, file_size: fileSize, mime_type: mimeType }
        });
    },

    // Music Jams
    getJams() {
        return this.request('/api/jams/');
    },
    createJam(name, description, isPublic = true) {
        return this.request('/api/jams/', {
            method: 'POST',
            body: { name, description, is_public: isPublic }
        });
    },
    getJamRoom(roomId) {
        return this.request(`/api/jams/${roomId}`);
    },

    // Friends
    getFriends() {
        return this.request('/api/friends/');
    },

    // Notifications
    getNotifications() {
        return this.request('/api/notifications/');
    },
    markNotificationsRead() {
        return this.request('/api/notifications/read-all', { method: 'POST' });
    },

    // Admin
    getAdminStats() {
        return this.request('/api/admin/stats');
    }
};

window.API = API;
