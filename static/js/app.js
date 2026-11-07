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
                        'onStateChange': (e) => this.onYouTubeStateChange(e),
                        'onError': (e) => {
                            console.warn("YouTube player error:", e.data);
                            UI.showToast('Track stream unavailable. Auto-playing next...', 'error');
                            setTimeout(() => this.nextTrack(), 1200);
                        }
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

        // Search Input with Live Instant Autofill & Keyboard Support
        const searchInput = document.getElementById('global-search-input');
        const autofillDropdown = document.getElementById('search-autofill-dropdown');
        let autocompleteTimeout = null;

        if (searchInput) {
            // Live instant autofill suggestions on typing
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                clearTimeout(autocompleteTimeout);

                if (!autofillDropdown) return;

                if (query.length < 2) {
                    autofillDropdown.classList.remove('active');
                    autofillDropdown.innerHTML = '';
                    return;
                }

                autocompleteTimeout = setTimeout(() => {
                    this.fetchAndRenderAutofill(query);
                }, 140);
            });

            // Enter key directly triggers search; Escape closes dropdown
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(autocompleteTimeout);
                    if (autofillDropdown) autofillDropdown.classList.remove('active');
                    const q = searchInput.value.trim();
                    if (q) this.navigateTo('search', q);
                } else if (e.key === 'Escape') {
                    if (autofillDropdown) autofillDropdown.classList.remove('active');
                }
            });

            // Re-open on focus if text present
            searchInput.addEventListener('focus', () => {
                const q = searchInput.value.trim();
                if (autofillDropdown && q.length >= 2 && autofillDropdown.children.length > 0) {
                    autofillDropdown.classList.add('active');
                }
            });

            // Dismiss dropdown on outside click
            document.addEventListener('click', (e) => {
                if (autofillDropdown && !searchInput.contains(e.target) && !autofillDropdown.contains(e.target)) {
                    autofillDropdown.classList.remove('active');
                }
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

        // Queue synchronization & history tracking
        const queue = State.get('queue') || [];
        const trackIdx = queue.findIndex(t => 
            (t.id && track.id && t.id === track.id) ||
            (t.provider_track_id && track.provider_track_id && t.provider_track_id === track.provider_track_id) ||
            (t.title === track.title && t.artist_name === track.artist_name)
        );

        if (trackIdx !== -1) {
            State.set('queueIndex', trackIdx);
        } else {
            // Check if track is part of the current search results
            const searchResults = State.get('lastSearchResults') || [];
            const searchIdx = searchResults.findIndex(t =>
                (t.id && track.id && t.id === track.id) ||
                (t.provider_track_id && track.provider_track_id && t.provider_track_id === track.provider_track_id) ||
                (t.title === track.title)
            );
            if (searchIdx !== -1) {
                State.set('queue', [...searchResults]);
                State.set('queueIndex', searchIdx);
            } else {
                queue.push(track);
                State.set('queue', queue);
                State.set('queueIndex', queue.length - 1);
            }
        }

        State.set('currentTrack', track);

        // 1. YouTube Playback Engine
        if (track.provider_id === 'youtube') {
            this.audio.pause();
            const videoId = track.provider_track_id || track.stream_url;
            if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                try {
                    this.ytPlayer.loadVideoById(videoId);
                    this.ytPlayer.playVideo();
                    State.set('isPlaying', true);
                    UI.showToast(`Playing from YouTube: ${track.title}`, 'music');
                    if (track.id) API.recordPlay(track.id).catch(() => {});
                } catch (ytErr) {
                    console.warn("YouTube play attempt failed, retrying:", ytErr);
                    setTimeout(() => {
                        if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                            this.ytPlayer.loadVideoById(videoId);
                            this.ytPlayer.playVideo();
                            State.set('isPlaying', true);
                        }
                    }, 500);
                }
            } else {
                UI.showToast('Preparing YouTube player...', 'info');
                setTimeout(() => {
                    if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                        this.ytPlayer.loadVideoById(videoId);
                        this.ytPlayer.playVideo();
                        State.set('isPlaying', true);
                    }
                }, 800);
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
        const repeatMode = State.get('repeatMode');
        if (repeatMode === 'one') {
            const current = State.get('currentTrack');
            if (current) {
                if (current.provider_id === 'youtube' && this.ytPlayer && this.ytPlayer.seekTo) {
                    this.ytPlayer.seekTo(0);
                    this.ytPlayer.playVideo();
                } else if (this.audio) {
                    this.audio.currentTime = 0;
                    this.audio.play();
                }
                return;
            }
        }

        const queue = State.get('queue') || [];
        const shuffle = State.get('shuffle');

        if (shuffle && queue.length > 1) {
            let nextIdx = Math.floor(Math.random() * queue.length);
            if (nextIdx === State.get('queueIndex')) {
                nextIdx = (nextIdx + 1) % queue.length;
            }
            State.set('queueIndex', nextIdx);
            this.playTrack(queue[nextIdx]);
            return;
        }

        let idx = State.get('queueIndex') + 1;
        if (idx < queue.length && queue[idx]) {
            State.set('queueIndex', idx);
            this.playTrack(queue[idx]);
        } else if (repeatMode === 'all' && queue.length > 0) {
            State.set('queueIndex', 0);
            this.playTrack(queue[0]);
        } else {
            // Queue ended or playing single song: seamlessly auto-recommend and auto-play the next song matching the previous track
            await this.playNextRecommended();
        }
    },

    async playNextRecommended() {
        const current = State.get('currentTrack');
        if (!current) return;

        try {
            UI.showToast(`✨ Auto-finding next song matching "${current.title}"...`, 'info');
            const recent = (State.get('queue') || []).map(t => t.id).filter(Boolean);
            const res = await API.getNextRecommended(
                current.id || '',
                current.title,
                current.artist_name,
                current.genre || '',
                recent
            );

            if (res && res.next_track) {
                const nextSong = res.next_track;
                const queue = State.get('queue') || [];
                queue.push(nextSong);
                State.set('queue', queue);
                State.set('queueIndex', queue.length - 1);

                if (current.id && nextSong.id) {
                    API.recordTransition(current.id, nextSong.id).catch(() => {});
                }

                this.playTrack(nextSong);
                UI.showToast(`📻 Auto-Playing Next: ${nextSong.title}`, 'music');
            } else {
                UI.showToast('End of recommended radio queue.', 'info');
            }
        } catch (e) {
            console.warn('Auto-next recommendation failed:', e);
            UI.showToast('Unable to auto-fetch next track.', 'error');
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

    jamTimer: null,

    openJoinJamModal() {
        const overlay = document.getElementById('join-jam-modal-overlay');
        const input = document.getElementById('join-jam-input');
        const err = document.getElementById('join-jam-error-msg');
        if (err) err.style.display = 'none';
        if (input) {
            input.value = '';
            input.focus();
        }
        if (overlay) overlay.classList.add('active');
    },

    closeJoinJamModal() {
        const overlay = document.getElementById('join-jam-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    async handleJoinJamSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('join-jam-input');
        const errEl = document.getElementById('join-jam-error-msg');
        const codeOrId = input ? input.value.trim() : '';
        if (!codeOrId) return;

        try {
            UI.showToast('Connecting to Music Jam...', 'info');
            const res = await API.joinJam(codeOrId);
            this.closeJoinJamModal();
            UI.showToast(`Joined ${res.room_name}!`, 'success');
            await this.enterJamRoom(res.room_id);
        } catch (err) {
            if (errEl) {
                errEl.textContent = err.message || 'Failed to join Jam room';
                errEl.style.display = 'block';
            } else {
                UI.showToast(err.message || 'Failed to join Jam room', 'error');
            }
        }
    },

    async enterJamRoom(roomId) {
        try {
            const data = await API.getJamRoom(roomId);
            State.set('activeJamRoom', data.room);
            UI.renderJamRoom(data);
        } catch (err) {
            UI.showToast(err.message || 'Failed to load Jam room', 'error');
        }
    },

    async regenerateJamCode(roomId) {
        try {
            UI.showToast('Generating fresh 4-digit code...', 'info');
            const res = await API.regenerateJamCode(roomId);
            const codeDisplay = document.getElementById('jam-room-code-display');
            if (codeDisplay) codeDisplay.textContent = res.join_code;

            UI.showToast(`New code: ${res.join_code} (valid for 10 min)`, 'success');
            this.startJamCountdown(600, true, roomId);
        } catch (err) {
            UI.showToast(err.message || 'Only host can generate new code', 'error');
        }
    },

    startJamCountdown(remSec, isHost, roomId) {
        if (this.jamTimer) {
            clearInterval(this.jamTimer);
            this.jamTimer = null;
        }

        let seconds = remSec;
        const updateUI = () => {
            const timerBadge = document.getElementById('jam-code-timer-badge');
            const countdownText = document.getElementById('jam-countdown-text');
            if (!timerBadge) {
                clearInterval(this.jamTimer);
                return;
            }

            if (seconds <= 0) {
                timerBadge.className = 'jam-timer-badge expired';
                timerBadge.innerHTML = '⚠️ Code Expired (10 min passed)';
                clearInterval(this.jamTimer);
                if (isHost) {
                    UI.showToast('Your 4-digit Jam code has expired. Click "Generate New 4-Digit Code" to renew it.', 'info');
                }
            } else {
                timerBadge.className = 'jam-timer-badge';
                if (countdownText) countdownText.textContent = UI.formatTime(seconds);
                seconds--;
            }
        };

        updateUI();
        if (seconds > 0) {
            this.jamTimer = setInterval(updateUI, 1000);
        }
    },

    async leaveCurrentJam(roomId, isHost = false) {
        if (this.jamTimer) {
            clearInterval(this.jamTimer);
            this.jamTimer = null;
        }
        await API.leaveJam(roomId).catch(() => {});
        State.set('activeJamRoom', null);
        if (isHost) {
            UI.showToast('Stepped out. Your Jam room remains active until you choose to end it.', 'info');
        } else {
            UI.showToast('Left Jam party.', 'info');
        }
        this.navigateTo('jams');
    },

    async endCurrentJam(roomId, roomName = 'this Jam room') {
        const confirmed = confirm(`Are you sure you want to END "${roomName}"?\n\nThis will permanently close the Jam room for all listeners.\n\nNote: your Jam room stays active forever until you confirm here.`);
        if (!confirmed) return;

        try {
            UI.showToast('Ending Jam room...', 'info');
            if (this.jamTimer) {
                clearInterval(this.jamTimer);
                this.jamTimer = null;
            }
            await API.endJam(roomId);
            State.set('activeJamRoom', null);
            UI.showToast('Jam room has been ended and closed.', 'success');
            this.navigateTo('jams');
        } catch (err) {
            UI.showToast(err.message || 'Failed to end Jam room', 'error');
        }
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
    },

    async fetchAndRenderAutofill(query) {
        const dropdown = document.getElementById('search-autofill-dropdown');
        if (!dropdown) return;

        try {
            const res = await API.getAutocomplete(query);
            const suggestions = res.suggestions || [];
            const tracks = res.tracks || [];

            if (suggestions.length === 0 && tracks.length === 0) {
                dropdown.classList.remove('active');
                dropdown.innerHTML = '';
                return;
            }

            let html = '';

            // 1. Direct Matching Songs (Instant Play)
            if (tracks.length > 0) {
                html += `<div class="autofill-section-title">🎵 Direct Song Matches</div>`;
                tracks.forEach(track => {
                    const trackJSON = JSON.stringify(track).replace(/"/g, '&quot;');
                    const isLofi = track.version_type === 'lofi' || /lofi|lo-fi|slowed/i.test(track.title);
                    const badge = isLofi 
                        ? `<span class="badge" style="background: rgba(245, 158, 11, 0.25); color: var(--accent-amber); font-size: 0.65rem; margin-left: auto;">☕ Lo-Fi</span>`
                        : `<span class="badge" style="background: rgba(139, 92, 246, 0.25); color: var(--primary); font-size: 0.65rem; margin-left: auto;">👑 Official</span>`;

                    html += `
                        <div class="autofill-track-item" onclick="App.selectAutofillTrack(${trackJSON})">
                            <img src="${track.artwork_url || '/static/images/default-cover.png'}" class="autofill-track-img" alt="${track.title}"/>
                            <div style="min-width: 0; flex: 1;">
                                <div class="autofill-track-title truncate">${track.title}</div>
                                <div class="autofill-track-artist truncate">${track.artist_name}</div>
                            </div>
                            ${badge}
                        </div>
                    `;
                });
            }

            // 2. Query Autocomplete Suggestions (Fill & Search)
            if (suggestions.length > 0) {
                html += `<div class="autofill-section-title">🔍 Search Suggestions</div>`;
                suggestions.forEach(s => {
                    const safe = s.replace(/'/g, "\\'");
                    html += `
                        <div class="autofill-query-item" onclick="App.selectAutofillQuery('${safe}')">
                            <svg class="autofill-query-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <span class="truncate">${s}</span>
                        </div>
                    `;
                });
            }

            dropdown.innerHTML = html;
            dropdown.classList.add('active');
        } catch (e) {
            console.warn('Autofill error:', e);
        }
    },

    selectAutofillTrack(track) {
        const dropdown = document.getElementById('search-autofill-dropdown');
        if (dropdown) dropdown.classList.remove('active');
        this.playTrack(track);
    },

    selectAutofillQuery(query) {
        const input = document.getElementById('global-search-input');
        const dropdown = document.getElementById('search-autofill-dropdown');
        if (input) input.value = query;
        if (dropdown) dropdown.classList.remove('active');
        this.navigateTo('search', query);
    }
};

window.App = App;

// Bootstrap on DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
