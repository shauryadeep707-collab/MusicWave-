/**
 * MusicWave - Main Client Application Bootstrap & Controller
 * Supports dual audio engines: HTML5 Audio API (for MP3/FLAC) & YouTube IFrame API
 */
const App = {
    audio: new Audio(),
    ytPlayer: null,
    isYtReady: false,
    ytProgressTimer: null,

    async init() {
        console.log("🎵 MusicWave Engine Initializing...");
        
        // Setup Native Audio Player Event Listeners
        this.setupAudioListeners();

        // Setup Network Status Listeners
        this.setupNetworkListeners();

        // Setup UI State Subscriptions
        this.setupSubscriptions();

        // Setup Global DOM Listeners
        this.setupDOMListeners();

        // Setup YouTube Player
        this.initYouTubePlayer();

        // Check current session
        await this.checkAuth();

        // Initial Routing based on path
        this.handleInitialRoute();
    },

    initYouTubePlayer() {
        const checkYT = () => {
            if (window.YT && window.YT.Player) {
                this.ytPlayer = new window.YT.Player('youtube-iframe-player', {
                    height: '200',
                    width: '200',
                    playerVars: {
                        'autoplay': 0,
                        'controls': 0,
                        'disablekb': 1,
                        'fs': 0,
                        'rel': 0
                    },
                    events: {
                        'onReady': () => {
                            this.isYtReady = true;
                            console.log("▶️ YouTube Embedded Audio Engine Ready");
                        },
                        'onStateChange': (e) => this.onYouTubeStateChange(e)
                    }
                });
            } else {
                setTimeout(checkYT, 200);
            }
        };
        checkYT();
    },

    onYouTubeStateChange(event) {
        // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0
        if (event.data === 1) {
            State.set('isPlaying', true);
            this.startYtProgressTracker();
        } else if (event.data === 2) {
            State.set('isPlaying', false);
            this.stopYtProgressTracker();
        } else if (event.data === 0) {
            this.stopYtProgressTracker();
            const repeatMode = State.get('repeatMode');
            if (repeatMode === 'one' && this.ytPlayer) {
                this.ytPlayer.seekTo(0);
                this.ytPlayer.playVideo();
            } else {
                this.nextTrack();
            }
        }
    },

    startYtProgressTracker() {
        this.stopYtProgressTracker();
        this.ytProgressTimer = setInterval(() => {
            if (this.ytPlayer && this.ytPlayer.getCurrentTime && this.ytPlayer.getDuration) {
                const current = this.ytPlayer.getCurrentTime();
                const duration = this.ytPlayer.getDuration();
                State.set('currentTime', current);
                State.set('duration', duration);
                this.updateProgressBar(current, duration);
                const totalEl = document.getElementById('player-total-time');
                if (totalEl && duration) totalEl.textContent = UI.formatTime(duration);
            }
        }, 500);
    },

    stopYtProgressTracker() {
        if (this.ytProgressTimer) {
            clearInterval(this.ytProgressTimer);
            this.ytProgressTimer = null;
        }
    },

    setupAudioListeners() {
        const audio = this.audio;

        audio.addEventListener('play', () => {
            State.set('isPlaying', true);
        });

        audio.addEventListener('pause', () => {
            State.set('isPlaying', false);
        });

        audio.addEventListener('timeupdate', () => {
            if (State.get('currentTrack')?.provider_id !== 'youtube') {
                State.set('currentTime', audio.currentTime);
                this.updateProgressBar(audio.currentTime, audio.duration);
            }
        });

        audio.addEventListener('loadedmetadata', () => {
            if (State.get('currentTrack')?.provider_id !== 'youtube') {
                State.set('duration', audio.duration);
                const totalEl = document.getElementById('player-total-time');
                if (totalEl) totalEl.textContent = UI.formatTime(audio.duration);
            }
        });

        audio.addEventListener('ended', () => {
            const repeatMode = State.get('repeatMode');
            if (repeatMode === 'one') {
                audio.currentTime = 0;
                audio.play();
            } else {
                this.nextTrack();
            }
        });

        audio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            if (State.get('currentTrack')?.provider_id !== 'youtube') {
                UI.showToast('Audio source unavailable. Skipping...', 'error');
                setTimeout(() => this.nextTrack(), 1500);
            }
        });
    },

    setupNetworkListeners() {
        const updateOnlineStatus = () => {
            const isOnline = navigator.onLine;
            State.set('isOnline', isOnline);
            const pill = document.getElementById('online-status-pill');
            if (pill) {
                if (isOnline) {
                    pill.className = 'status-pill';
                    pill.innerHTML = '<span class="status-indicator-dot"></span> Online';
                    UI.showToast('Back online! Syncing services...', 'success');
                } else {
                    pill.className = 'status-pill offline';
                    pill.innerHTML = '<span class="status-indicator-dot"></span> Offline';
                    UI.showToast('Offline Mode. Accessing local downloads.', 'error');
                }
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
    },

    setupSubscriptions() {
        // Track change subscription
        State.subscribe('currentTrack', (track) => {
            if (!track) return;
            const artworkEl = document.getElementById('player-current-artwork');
            const titleEl = document.getElementById('player-current-title');
            const artistEl = document.getElementById('player-current-artist');
            const likeBtn = document.getElementById('player-like-btn');

            if (artworkEl) artworkEl.src = track.artwork_url || '/static/images/default-cover.png';
            if (titleEl) titleEl.textContent = track.title || 'Unknown Track';
            if (artistEl) artistEl.textContent = track.artist_name || 'Unknown Artist';
            if (likeBtn) likeBtn.classList.remove('liked');

            // Update Version Switcher Button in Player
            const versionBtn = document.getElementById('player-version-switch-btn');
            if (versionBtn) {
                versionBtn.style.display = 'inline-flex';
                const isLofi = track.version_type === 'lofi' || /lofi|lo-fi|slowed|reverb|chillhop/i.test(track.title);
                if (isLofi) {
                    versionBtn.innerHTML = '👑 Switch to Official';
                    versionBtn.title = 'Switch to Official Studio Version';
                    versionBtn.dataset.targetVersion = 'official';
                } else {
                    versionBtn.innerHTML = '☕ Switch to Lo-Fi';
                    versionBtn.title = 'Switch to Relaxing Lo-Fi Chill Version';
                    versionBtn.dataset.targetVersion = 'lofi';
                }
            }
        });

        // Playback state subscription
        State.subscribe('isPlaying', (isPlaying) => {
            const playBtn = document.getElementById('player-play-btn');
            if (!playBtn) return;
            if (isPlaying) {
                playBtn.innerHTML = '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
            } else {
                playBtn.innerHTML = '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            }
        });

        // Current time subscription
        State.subscribe('currentTime', (curr) => {
            const currentEl = document.getElementById('player-current-time');
            if (currentEl) currentEl.textContent = UI.formatTime(curr);
        });

        // Repeat mode
        State.subscribe('repeatMode', (mode) => {
            const btn = document.getElementById('player-repeat-btn');
            if (btn) btn.classList.toggle('active', mode !== 'off');
        });

        // Shuffle
        State.subscribe('shuffle', (shuffle) => {
            const btn = document.getElementById('player-shuffle-btn');
            if (btn) btn.classList.toggle('active', shuffle);
        });
    },

    setupDOMListeners() {
        // Navigation links
        document.querySelectorAll('[data-route]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const route = el.dataset.route;
                this.navigateTo(route);
            });
        });

        // Search Input debounced
        const searchInput = document.getElementById('global-search-input');
        let searchTimeout = null;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (query.length > 0) {
                        this.navigateTo('search', query);
                    }
                }, 350);
            });
        }

        // Seek Bar Click / Drag
        const progressContainer = document.getElementById('player-progress-container');
        if (progressContainer) {
            progressContainer.addEventListener('click', (e) => {
                const rect = progressContainer.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                const track = State.get('currentTrack');

                if (track?.provider_id === 'youtube' && this.ytPlayer && this.ytPlayer.seekTo) {
                    const dur = this.ytPlayer.getDuration() || 0;
                    this.ytPlayer.seekTo(pos * dur, true);
                } else if (this.audio.duration) {
                    this.audio.currentTime = pos * this.audio.duration;
                }
            });
        }

        // Volume Slider
        const volumeSlider = document.getElementById('player-volume-slider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const vol = parseFloat(e.target.value);
                this.audio.volume = vol;
                if (this.ytPlayer && this.ytPlayer.setVolume) {
                    this.ytPlayer.setVolume(vol * 100);
                }
                State.set('volume', vol);
            });
        }
    },

    updateProgressBar(current, duration) {
        if (!duration) return;
        const pct = (current / duration) * 100;
        const fill = document.getElementById('player-progress-fill');
        if (fill) fill.style.width = `${pct}%`;
    },

    async checkAuth() {
        try {
            // Restore immediately from localStorage for permanent session continuity
            const cachedUser = localStorage.getItem('musicwave_auth_user');
            if (cachedUser) {
                try {
                    const parsed = JSON.parse(cachedUser);
                    State.set('user', parsed);
                    this.updateUserUI(parsed);
                } catch (e) {}
            }

            const res = await API.getMe();
            if (res.authenticated && res.user) {
                State.set('user', res.user);
                this.updateUserUI(res.user);
                localStorage.setItem('musicwave_auth_user', JSON.stringify(res.user));
                localStorage.setItem('musicwave_user_id', res.user.id);
            }
        } catch (e) {
            console.warn('Auth check skipped (offline or unauthenticated)');
        }
    },

    updateUserUI(user) {
        const userBtn = document.getElementById('user-profile-btn');
        if (!userBtn) return;
        if (user) {
            userBtn.innerHTML = `
                <div class="user-avatar-sm">${user.username.charAt(0).toUpperCase()}</div>
                <span style="font-weight: 600; font-size: 0.85rem;">${user.display_name || user.username}</span>
            `;
            userBtn.onclick = () => this.navigateTo('profile');
        } else {
            userBtn.innerHTML = `<span style="font-weight: 600; font-size: 0.85rem; padding: 4px 8px;">Sign In</span>`;
            userBtn.onclick = () => this.openAuthModal('login');
        }
    },

    handleInitialRoute() {
        const path = window.location.pathname.replace(/^\//, '') || 'home';
        this.navigateTo(path);
    },

    navigateTo(page, param = null) {
        State.set('activePage', page);
        UI.updateActiveNav(page);
        window.history.pushState({}, '', `/${page === 'home' ? '' : page}`);

        switch (page) {
            case 'home':
                UI.renderHome();
                break;
            case 'explore':
                UI.renderExplore();
                break;
            case 'search':
                UI.renderSearch(param || '');
                break;
            case 'library':
                UI.renderLibrary();
                break;
            case 'downloads':
                UI.renderDownloads();
                break;
            case 'favourites':
                UI.renderFavourites();
                break;
            case 'jams':
                UI.renderJams();
                break;
            case 'friends':
                UI.renderFriends();
                break;
            case 'profile':
                UI.renderProfile();
                break;
            case 'settings':
                UI.renderSettings();
                break;
            case 'admin':
                UI.renderAdmin();
                break;
            default:
                UI.renderHome();
        }
    },

    // Audio Playback Controls (Unified Native MP3 & YouTube)
    playTrack(track) {
        if (!track) {
            UI.showToast('Invalid track selection', 'error');
            return;
        }

        // Train recommendation transition matrix: previousTrack -> currentTrack
        const previousTrack = State.get('currentTrack');
        if (previousTrack && previousTrack.id && track.id && previousTrack.id !== track.id) {
            API.recordTransition(previousTrack.id, track.id).catch(() => {});
        }

        // Auto-sort track into mood/genre smart playlists (Punjabi, Retro, Sad, etc.)
        const lastQuery = State.get('lastSearchQuery') || '';
        API.autoSortTrack(track.id, lastQuery, track.title, track.artist_name).catch(() => {});

        State.set('currentTrack', track);

        // 1. YouTube Playback Engine
        if (track.provider_id === 'youtube') {
            this.audio.pause();
            const videoId = track.provider_track_id || track.stream_url;
            if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                this.ytPlayer.loadVideoById(videoId);
                this.ytPlayer.playVideo();
                State.set('isPlaying', true);
                UI.showToast(`Playing from YouTube: ${track.title}`, 'music');
                if (track.id) API.recordPlay(track.id).catch(() => {});
            } else {
                UI.showToast('YouTube player is preparing, please try again in a second', 'info');
            }
            return;
        }

        // 2. Native HTML5 Audio Engine
        if (this.ytPlayer && this.ytPlayer.stopVideo) {
            this.ytPlayer.stopVideo();
            this.stopYtProgressTracker();
        }

        if (!track.stream_url) {
            UI.showToast('No audio stream URL available for this track', 'error');
            return;
        }

        this.audio.src = track.stream_url;
        this.audio.play().then(() => {
            State.set('isPlaying', true);
            UI.showToast(`Playing: ${track.title}`, 'music');
            if (track.id) API.recordPlay(track.id).catch(() => {});
        }).catch(err => {
            console.error('Playback prevented or stream error:', err);
            UI.showToast('Click play on player to start listening', 'info');
        });
    },

    togglePlay() {
        const track = State.get('currentTrack');
        if (!track) {
            UI.showToast('Select a track to start playing', 'info');
            return;
        }

        if (track.provider_id === 'youtube') {
            if (!this.ytPlayer) return;
            const ytState = this.ytPlayer.getPlayerState ? this.ytPlayer.getPlayerState() : -1;
            if (ytState === 1) {
                this.ytPlayer.pauseVideo();
            } else {
                this.ytPlayer.playVideo();
            }
        } else {
            if (this.audio.paused) {
                this.audio.play();
            } else {
                this.audio.pause();
            }
        }
    },

    prevTrack() {
        const queue = State.get('queue');
        let idx = State.get('queueIndex') - 1;
        if (idx >= 0 && queue[idx]) {
            State.set('queueIndex', idx);
            this.playTrack(queue[idx]);
        } else if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
        }
    },

    async nextTrack() {
        const queue = State.get('queue') || [];
        let idx = State.get('queueIndex') + 1;
        if (idx < queue.length && queue[idx]) {
            State.set('queueIndex', idx);
            this.playTrack(queue[idx]);
        } else {
            // Queue ended: seamlessly auto-predict and play the next song matching the previous track
            await this.playNextRecommended();
        }
    },

    async playNextRecommended() {
        const current = State.get('currentTrack');
        if (!current) return;

        try {
            UI.showToast(`✨ Finding next song matching "${current.title}"...`, 'info');
            const recent = (State.get('queue') || []).map(t => t.id).filter(Boolean);
            const res = await API.getNextRecommended(
                current.id,
                current.title,
                current.artist_name,
                current.genre || '',
                recent
            );

            if (res && res.next_track) {
                const queue = State.get('queue') || [];
                queue.push(res.next_track);
                State.set('queue', queue);
                State.set('queueIndex', queue.length - 1);

                if (current.id && res.next_track.id) {
                    API.recordTransition(current.id, res.next_track.id).catch(() => {});
                }

                this.playTrack(res.next_track);
                UI.showToast(`📻 Auto-Playing Next: ${res.next_track.title}`, 'music');
            } else {
                UI.showToast('No further recommendations available.', 'info');
            }
        } catch (e) {
            console.warn('Auto-next recommendation failed:', e);
        }
    },

    toggleShuffle() {
        const current = State.get('shuffle');
        State.set('shuffle', !current);
        UI.showToast(`Shuffle ${!current ? 'Enabled' : 'Disabled'}`);
    },

    toggleRepeat() {
        const current = State.get('repeatMode');
        const modes = ['off', 'all', 'one'];
        const next = modes[(modes.indexOf(current) + 1) % modes.length];
        State.set('repeatMode', next);
        UI.showToast(`Repeat mode: ${next.toUpperCase()}`);
    },

    async toggleCurrentFavourite() {
        const track = State.get('currentTrack');
        if (!track) return;
        const user = State.get('user');
        if (!user) {
            this.openAuthModal('login');
            return;
        }
        try {
            const res = await API.toggleFavourite(track.id);
            const btn = document.getElementById('player-like-btn');
            if (btn) btn.classList.toggle('liked', res.is_favourite);
            UI.showToast(res.is_favourite ? 'Added to Favourites' : 'Removed from Favourites', 'success');
        } catch (e) {
            UI.showToast(e.message, 'error');
        }
    },

    browseGenre(genre) {
        this.navigateTo('search', genre);
    },

    // YouTube Import Modal
    openYouTubeModal() {
        const overlay = document.getElementById('youtube-modal-overlay');
        if (overlay) overlay.classList.add('active');
        const input = document.getElementById('youtube-link-input');
        if (input) {
            input.value = '';
            input.focus();
        }
    },

    closeYouTubeModal() {
        const overlay = document.getElementById('youtube-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    async handleYouTubeImport(e) {
        e.preventDefault();
        const input = document.getElementById('youtube-link-input');
        const link = input.value.trim();
        if (!link) return;

        UI.showToast('Fetching YouTube track information...', 'info');
        try {
            const res = await API.importYouTube(link);
            this.closeYouTubeModal();
            UI.showToast(`Imported: ${res.track.title}`, 'success');
            this.playTrack(res.track);
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    },

    // Modal Operations
    openAuthModal(mode = 'login') {
        const overlay = document.getElementById('auth-modal-overlay');
        const title = document.getElementById('auth-modal-title');
        const submitBtn = document.getElementById('auth-modal-submit');
        const switchText = document.getElementById('auth-modal-switch');
        const nameField = document.getElementById('auth-name-group');

        if (!overlay) return;
        overlay.classList.add('active');

        if (mode === 'login') {
            title.textContent = 'Sign In to MusicWave';
            submitBtn.textContent = 'Sign In';
            nameField.style.display = 'none';
            switchText.innerHTML = `Don't have an account? <a href="javascript:void(0)" onclick="App.openAuthModal('register')" style="color:var(--primary); font-weight:600;">Create One</a>`;
            overlay.dataset.mode = 'login';
        } else {
            title.textContent = 'Create MusicWave Account';
            submitBtn.textContent = 'Create Account';
            nameField.style.display = 'block';
            switchText.innerHTML = `Already have an account? <a href="javascript:void(0)" onclick="App.openAuthModal('login')" style="color:var(--primary); font-weight:600;">Sign In</a>`;
            overlay.dataset.mode = 'register';
        }
    },

    closeAuthModal() {
        const overlay = document.getElementById('auth-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    async handleAuthSubmit(e) {
        e.preventDefault();
        const overlay = document.getElementById('auth-modal-overlay');
        const mode = overlay.dataset.mode;
        const email = document.getElementById('auth-email-input').value.trim();
        const pwd = document.getElementById('auth-password-input').value;
        const username = document.getElementById('auth-username-input').value.trim();

        try {
            let res;
            if (mode === 'login') {
                res = await API.login(email, pwd);
            } else {
                res = await API.register(username, email, pwd, username);
            }
            State.set('user', res.user);
            localStorage.setItem('musicwave_auth_user', JSON.stringify(res.user));
            localStorage.setItem('musicwave_user_id', res.user.id);
            this.updateUserUI(res.user);
            this.closeAuthModal();
            UI.showToast(`Welcome ${res.user.display_name || res.user.username}!`, 'success');
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    },

    async logout() {
        await API.logout();
        localStorage.removeItem('musicwave_auth_user');
        localStorage.removeItem('musicwave_user_id');
        State.set('user', null);
        this.updateUserUI(null);
        this.navigateTo('home');
        UI.showToast('You have been logged out.', 'info');
    },

    openCreateJamModal() {
        const user = State.get('user');
        if (!user) {
            this.openAuthModal('login');
            return;
        }
        const name = prompt('Enter a name for your Music Jam room:');
        if (!name) return;
        API.createJam(name, 'A real-time music jam room').then(res => {
            UI.showToast(`Jam room "${name}" created!`, 'success');
            this.navigateTo('jams');
        }).catch(err => UI.showToast(err.message, 'error'));
    },

    openCreatePlaylistModal() {
        const name = prompt('Enter a title for your new playlist:');
        if (!name) return;
        API.createPlaylist(name, '').then(res => {
            UI.showToast(`Playlist "${name}" created!`, 'success');
            this.navigateTo('library');
        }).catch(err => UI.showToast(err.message, 'error'));
    },

    async openPlaylist(playlistId) {
        try {
            const res = await API.getPlaylistTracks(playlistId);
            if (res.playlist) {
                State.set('activePlaylist', res.playlist);
                State.set('activePlaylistTracks', res.tracks || []);
                UI.renderPlaylistView(res.playlist, res.tracks || []);
            }
        } catch (err) {
            UI.showToast(err.message || 'Failed to load playlist', 'error');
        }
    },

    playPlaylistFirstTrack() {
        const tracks = State.get('activePlaylistTracks') || [];
        if (tracks.length > 0) {
            State.set('queue', tracks);
            State.set('queueIndex', 0);
            this.playTrack(tracks[0]);
        }
    },

    async switchCurrentTrackVersion() {
        const track = State.get('currentTrack');
        if (!track) return;
        const btn = document.getElementById('player-version-switch-btn');
        const targetVersion = btn ? (btn.dataset.targetVersion || 'lofi') : 'lofi';
        await this.playAlternativeVersion(track.title, track.artist_name, targetVersion);
    },

    async playAlternativeVersion(title, artist, targetVersion) {
        try {
            UI.showToast(`Finding ${targetVersion === 'lofi' ? '☕ Lo-Fi' : '👑 Official'} version...`, 'info');
            const res = await API.getTrackVersions(title, artist);
            const targetTrack = targetVersion === 'lofi' ? res.lofi_version : res.official_version;
            if (targetTrack) {
                this.playTrack(targetTrack);
                UI.showToast(`Switched to ${targetVersion === 'lofi' ? '☕ Lo-Fi Version' : '👑 Official Version'}!`, 'success');
            } else {
                UI.showToast(`No ${targetVersion} version available for this song.`, 'info');
            }
        } catch (e) {
            UI.showToast('Could not load version: ' + e.message, 'error');
        }
    }
};

window.App = App;

// Bootstrap on DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
