/**
 * MusicWave - Unified API Client
 * Clean Fetch API wrapper with standardized error handling and permanent session persistence
 */
const API = {
    async request(endpoint, options = {}) {
        const storedUserId = localStorage.getItem('musicwave_user_id');
        const headers = {
            'Content-Type': 'application/json',
            ...(storedUserId ? { 'X-User-Id': storedUserId } : {}),
            ...options.headers
        };

        const config = {
            headers,
            credentials: 'include',
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

    // Auth Endpoints (Permanent Lifetime Session)
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
    getByGenre(genre) {
        return this.request(`/api/music/genre/${encodeURIComponent(genre)}`);
    },
    recordPlay(trackId) {
        return this.request(`/api/music/track/${trackId}/play`, { method: 'POST' });
    },
    search(query) {
        return this.request(`/api/music/search?q=${encodeURIComponent(query)}`);
    },
    getTrackVersions(query, artist = '') {
        const params = new URLSearchParams({ q: query, artist: artist });
        return this.request(`/api/music/versions?${params.toString()}`);
    },
    importYouTube(urlOrId) {
        return this.request('/api/music/youtube/import', {
            method: 'POST',
            body: { url: urlOrId }
        });
    },

    // Recommendation Engine & Auto-Next Transition
    getNextRecommended(trackId, title = '', artist = '', genre = '', exclude = []) {
        const params = new URLSearchParams();
        if (trackId) params.append('current_track_id', trackId);
        if (title) params.append('title', title);
        if (artist) params.append('artist', artist);
        if (genre) params.append('genre', genre);
        if (exclude && exclude.length > 0) params.append('exclude', exclude.join(','));
        return this.request(`/api/recommendations/next?${params.toString()}`);
    },
    recordTransition(fromTrackId, toTrackId) {
        return this.request('/api/recommendations/transition', {
            method: 'POST',
            body: { from_track_id: fromTrackId, to_track_id: toTrackId }
        });
    },

    // Playlists & Smart Auto-Sort
    getPlaylists() {
        return this.request('/api/playlists/');
    },
    getPlaylistTracks(playlistId) {
        return this.request(`/api/playlists/${playlistId}/tracks`);
    },
    createPlaylist(title, description, isPublic = true) {
        return this.request('/api/playlists/', {
            method: 'POST',
            body: { title, description, is_public: isPublic }
        });
    },
    autoSortTrack(trackId, query = '', title = '', artist = '') {
        return this.request('/api/playlists/auto-sort', {
            method: 'POST',
            body: { track_id: trackId, query, title, artist }
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
