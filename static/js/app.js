/**
 * MusicWave - Main Client Application Bootstrap & Controller
 * Supports dual audio engines: HTML5 Audio API (for MP3/FLAC) & YouTube IFrame API
 */
const App = {
    audio: new Audio(),
    ytPlayer: null,
    isYtReady: false,
    ytProgressTimer: null,
    socket: null,

    async init() {
        console.log("🎵 MusicWave Engine Initializing...");
        
        // Setup Real-time Jam Socket Engine
        this.initSocket();

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

    initSocket() {
        if (typeof io !== 'undefined') {
            try {
                this.socket = io({ transports: ['websocket', 'polling'] });

                this.socket.on('connect', () => {
                    console.log('⚡ MusicWave Real-Time Jam Socket Connected (ID:', this.socket.id, ')');
                    const activeJam = State.get('activeJamRoom');
                    if (activeJam && activeJam.id) {
                        this.socket.emit('join_jam', {
                            room_id: activeJam.id,
                            user: State.get('user')
                        });
                    }
                });

                this.setupJamSocketListeners();
            } catch (err) {
                console.warn('[Socket Init Warning]:', err);
            }
        }
    },

    setupJamSocketListeners() {
        if (!this.socket) return;

        // 1. Host started or changed track
        this.socket.on('jam_track_changed', (data) => {
            const activeJam = State.get('activeJamRoom');
            if (!activeJam || activeJam.id !== data.room_id) return;
            const isHost = State.get('isJamHost');
            if (isHost) return; // Host triggered this

            UI.showToast(`🎧 Jam Host started: ${data.track.title}`, 'music');
            this.playTrack(data.track, { fromJam: true, startPosition: data.position || 0 });
        });

        // 2. Host paused, resumed, or scrubbed/seeked playback
        this.socket.on('jam_playback_synced', (data) => {
            const activeJam = State.get('activeJamRoom');
            if (!activeJam || activeJam.id !== data.room_id) return;
            const isHost = State.get('isJamHost');
            if (isHost) return;

            if (data.action === 'pause') {
                if (this.ytPlayer && this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
                if (this.audio) this.audio.pause();
                State.set('isPlaying', false);
            } else if (data.action === 'play') {
                if (this.ytPlayer && this.ytPlayer.playVideo) this.ytPlayer.playVideo();
                if (this.audio) this.audio.play();
                State.set('isPlaying', true);
            } else if (data.action === 'seek') {
                const pos = parseFloat(data.position || 0);
                if (this.ytPlayer && this.ytPlayer.seekTo) this.ytPlayer.seekTo(pos, true);
                if (this.audio) this.audio.currentTime = pos;
            }
        });

        // 3. Initial sync state when listener joins an ongoing jam
        this.socket.on('jam_sync_state', (data) => {
            const activeJam = State.get('activeJamRoom');
            if (!activeJam || activeJam.id !== data.room_id) return;

            if (data.track) {
                const isHost = State.get('isJamHost');
                if (!isHost) {
                    UI.showToast(`🎧 Live Jam Audio Synchronized: ${data.track.title}`, 'music');
                    if (data.status === 'playing') {
                        this.playTrack(data.track, { fromJam: true, startPosition: data.position || 0 });
                    }
                }
            }
        });

        // 4. Participant joined
        this.socket.on('user_joined', (data) => {
            const activeJam = State.get('activeJamRoom');
            if (activeJam && activeJam.id === data.room_id) {
                const name = data.user ? (data.user.display_name || data.user.username) : 'A listener';
                UI.showToast(`👋 ${name} joined the Jam!`, 'info');
                API.getJamRoom(activeJam.id).then(res => {
                    if (State.get('activePage') === 'jams' && res.room) {
                        UI.renderJamRoom(res);
                    }
                }).catch(() => {});
            }
        });

        // 5. Participant left
        this.socket.on('user_left', (data) => {
            const activeJam = State.get('activeJamRoom');
            if (activeJam && activeJam.id === data.room_id) {
                API.getJamRoom(activeJam.id).then(res => {
                    if (State.get('activePage') === 'jams' && res.room) {
                        UI.renderJamRoom(res);
                    }
                }).catch(() => {});
            }
        });
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
            const activeJam = State.get('activeJamRoom');
            const isHost = State.get('isJamHost');

            // In a Jam room, listeners synchronize to the host's queue; only host commands auto-next
            if (activeJam && !isHost) {
                this.syncWithHostNow();
                return;
            }

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
            const activeJam = State.get('activeJamRoom');
            const isHost = State.get('isJamHost');

            // In a Jam room, listeners synchronize to the host's queue; only host commands auto-next
            if (activeJam && !isHost) {
                this.syncWithHostNow();
                return;
            }

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
                let targetSec = 0;

                if (track?.provider_id === 'youtube' && this.ytPlayer && this.ytPlayer.seekTo) {
                    const dur = this.ytPlayer.getDuration() || 0;
                    targetSec = pos * dur;
                    this.ytPlayer.seekTo(targetSec, true);
                } else if (this.audio.duration) {
                    targetSec = pos * this.audio.duration;
                    this.audio.currentTime = targetSec;
                }

                // If host of active Jam, broadcast scrubbed position to all listeners via socket & HTTP sync
                const activeJam = State.get('activeJamRoom');
                const isHost = State.get('isJamHost');
                if (activeJam && isHost) {
                    if (this.socket) {
                        this.socket.emit('jam_playback_control', {
                            room_id: activeJam.id,
                            action: 'seek',
                            position: targetSec
                        });
                    }
                    API.request(`/api/jams/${activeJam.id}/sync`, {
                        method: 'POST',
                        body: {
                            track_id: track?.id,
                            playback_status: State.get('isPlaying') ? 'playing' : 'paused',
                            playback_position: targetSec
                        }
                    }).catch(() => {});
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
            const cachedUserStr = localStorage.getItem('musicwave_auth_user');
            let cachedUser = null;
            if (cachedUserStr) {
                try {
                    cachedUser = JSON.parse(cachedUserStr);
                    State.set('user', cachedUser);
                    this.updateUserUI(cachedUser);
                } catch (e) {}
            }

            const res = await API.getMe();
            if (res && res.authenticated && res.user) {
                State.set('user', res.user);
                this.updateUserUI(res.user);
                localStorage.setItem('musicwave_auth_user', JSON.stringify(res.user));
                localStorage.setItem('musicwave_user_id', res.user.id);
            } else if (!cachedUser || (cachedUser.username && cachedUser.username.startsWith('Guest_'))) {
                // Only provision new guest if no user or previous user was a guest
                const guestUser = await API.createGuestSession();
                if (guestUser) {
                    State.set('user', guestUser);
                    this.updateUserUI(guestUser);
                }
            }
        } catch (e) {
            console.warn('Auth check skipped (offline or unauthenticated):', e);
        }
    },

    updateUserUI(user) {
        const userBtn = document.getElementById('user-profile-btn');
        if (!userBtn) return;

        if (user && user.username && !user.username.startsWith('Guest_')) {
            // Full registered user
            const letter = (user.display_name || user.username || 'U').charAt(0).toUpperCase();
            userBtn.innerHTML = `
                <div class="user-avatar-sm">${letter}</div>
                <span style="font-weight: 600; font-size: 0.85rem;">${user.display_name || user.username}</span>
            `;
            userBtn.onclick = () => this.navigateTo('profile');
        } else if (user && user.username && user.username.startsWith('Guest_')) {
            // Active guest session
            userBtn.innerHTML = `
                <div class="user-avatar-sm" style="background: rgba(139, 92, 246, 0.25); color: var(--primary);">👤</div>
                <span style="font-weight: 600; font-size: 0.82rem; color: var(--text-secondary);">${user.username}</span>
                <button class="btn-primary" style="padding: 3px 10px; font-size: 0.74rem; margin-left: 4px;" onclick="event.stopPropagation(); App.openAuthModal('login')">Sign In</button>
            `;
            userBtn.onclick = () => this.navigateTo('profile');
        } else {
            // Unauthenticated
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
    playTrack(track, options = {}) {
        if (!track) {
            UI.showToast('Invalid track selection', 'error');
            return;
        }

        // Real-Time Music Jam Broadcast:
        // If current user is the host of an active Jam room, broadcast the song in real time to all listeners
        const activeJam = State.get('activeJamRoom');
        const isHost = State.get('isJamHost');
        if (activeJam && isHost && !options?.fromJam) {
            if (this.socket) {
                this.socket.emit('jam_play_track', {
                    room_id: activeJam.id,
                    track: track,
                    position: 0.0
                });
            }
            // Dual-channel reliability: also update backend room state via HTTP
            API.request(`/api/jams/${activeJam.id}/sync`, {
                method: 'POST',
                body: {
                    track_id: track.id,
                    playback_status: 'playing',
                    playback_position: 0.0
                }
            }).catch(() => {});
        }

        // Train recommendation transition matrix: previousTrack -> currentTrack
        const previousTrack = State.get('currentTrack');
        if (previousTrack && previousTrack.id && track.id && previousTrack.id !== track.id) {
            API.recordTransition(previousTrack.id, track.id).catch(() => {});
        }

        // Auto-sort track into mood/genre smart playlists (Punjabi, Retro, Sad, etc.)
        const lastQuery = State.get('lastSearchQuery') || '';
        API.autoSortTrack(track.id, lastQuery, track.title, track.artist_name).catch(() => {});

        // Queue synchronization & playback mode tracking
        const playbackSource = State.get('playbackSource');
        const playlistTracks = State.get('activePlaylistTracks') || [];
        const isPlaylistPlayback = playbackSource === 'playlist' || State.get('activePage') === 'playlist';

        if (isPlaylistPlayback && playlistTracks.length > 0) {
            // User is playing inside a playlist: queue ALL songs present in that playlist!
            State.set('playbackSource', 'playlist');
            const pIdx = playlistTracks.findIndex(t =>
                (t.id && track.id && t.id === track.id) ||
                (t.provider_track_id && track.provider_track_id && t.provider_track_id === track.provider_track_id) ||
                (t.title === track.title)
            );
            State.set('queue', [...playlistTracks]);
            State.set('queueIndex', pIdx !== -1 ? pIdx : 0);
        } else {
            // Outside of a playlist (from search results, explore, home, recommendations):
            // Strictly do NOT queue search results! Keep single track and engage recommendation engine for auto-next
            State.set('playbackSource', 'recommendation');
            State.set('queue', [track]);
            State.set('queueIndex', 0);
        }

        State.set('currentTrack', track);

        const startSec = Math.floor(options?.startPosition || 0);

        // 1. YouTube Playback Engine
        if (track.provider_id === 'youtube') {
            this.audio.pause();
            const videoId = track.provider_track_id || track.stream_url;

            const executeYtPlay = () => {
                if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                    try {
                        this.ytPlayer.loadVideoById({
                            videoId: videoId,
                            startSeconds: startSec
                        });
                        this.ytPlayer.playVideo();
                        State.set('isPlaying', true);
                        UI.showToast(`Playing from YouTube: ${track.title}`, 'music');
                        if (track.id) API.recordPlay(track.id).catch(() => {});
                    } catch (ytErr) {
                        console.warn("YouTube play attempt error, retrying:", ytErr);
                    }
                }
            };

            if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                executeYtPlay();
            } else {
                UI.showToast('Preparing YouTube player...', 'info');
                setTimeout(executeYtPlay, 800);
            }

            // Smart AI background pre-fetch: cache next single song for instant 0ms Next transition
            setTimeout(() => {
                this.prefetchNextTrack(track);
            }, 400);
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
        if (startSec > 0) {
            this.audio.currentTime = startSec;
        }
        this.audio.play().then(() => {
            State.set('isPlaying', true);
            UI.showToast(`Playing: ${track.title}`, 'music');
            if (track.id) API.recordPlay(track.id).catch(() => {});
        }).catch(err => {
            console.error('Playback prevented or stream error:', err);
            UI.showToast('Click play on player to start listening', 'info');
        });

        // Smart AI background pre-fetch: cache next single song for instant 0ms Next transition
        setTimeout(() => {
            this.prefetchNextTrack(track);
        }, 400);
    },

    togglePlay() {
        const track = State.get('currentTrack');
        if (!track) {
            UI.showToast('Select a track to start playing', 'info');
            return;
        }

        let willPlay = false;

        if (track.provider_id === 'youtube') {
            if (!this.ytPlayer) return;
            const ytState = this.ytPlayer.getPlayerState ? this.ytPlayer.getPlayerState() : -1;
            if (ytState === 1) {
                this.ytPlayer.pauseVideo();
                willPlay = false;
            } else {
                this.ytPlayer.playVideo();
                willPlay = true;
            }
        } else {
            if (this.audio.paused) {
                this.audio.play();
                willPlay = true;
            } else {
                this.audio.pause();
                willPlay = false;
            }
        }

        // Real-time broadcast if Jam host
        const activeJam = State.get('activeJamRoom');
        const isHost = State.get('isJamHost');
        if (activeJam && isHost) {
            const currentPos = State.get('currentTime') || 0;
            if (this.socket) {
                this.socket.emit('jam_playback_control', {
                    room_id: activeJam.id,
                    action: willPlay ? 'play' : 'pause',
                    position: currentPos
                });
            }
            API.request(`/api/jams/${activeJam.id}/sync`, {
                method: 'POST',
                body: {
                    track_id: track.id,
                    playback_status: willPlay ? 'playing' : 'paused',
                    playback_position: currentPos
                }
            }).catch(() => {});
        }
    },

    prevTrack() {
        const playbackSource = State.get('playbackSource');
        const queue = State.get('queue') || [];

        if (playbackSource === 'playlist' && queue.length > 0) {
            let idx = State.get('queueIndex') - 1;
            if (idx >= 0 && queue[idx]) {
                State.set('queueIndex', idx);
                this.playTrack(queue[idx]);
                return;
            }
        }

        // Check playbackHistory for previous songs in recommendation mode
        const history = State.get('playbackHistory') || [];
        if (history.length > 0) {
            const prevSong = history.pop();
            State.set('playbackHistory', history);
            State.set('playbackSource', 'recommendation');
            State.set('queue', [prevSong]);
            State.set('queueIndex', 0);
            this.playTrack(prevSong);
            return;
        }

        if (this.audio && this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
        } else if (this.ytPlayer && this.ytPlayer.seekTo) {
            this.ytPlayer.seekTo(0);
        }
    },

    isSingleTrack(track) {
        if (!track) return false;
        const dur = Number(track.duration) || 0;
        if (dur > 380) return false; // Reject any mix/show longer than 6:20
        if (dur > 0 && dur < 40) return false;

        const title = (track.title || '').toLowerCase();
        const artist = (track.artist_name || '').toLowerCase();
        const combined = `${title} ${artist}`;

        const banned = [
            'full album', 'complete album', 'jukebox', 'audio jukebox', 'video jukebox',
            'non stop', 'non-stop', 'nonstop', 'mashup', 'mega mix', 'megamix',
            'compilation', 'best of', 'all songs', 'greatest hits', 'hit collection',
            'carvaan', 'weekend classic', 'radio show', 'podcast', 'episode',
            'live stream', 'livestream', 'superhit songs', 'top 10 songs',
            'top 20 songs', 'top 50 songs', 'top 100 songs', 'evergreen songs',
            'purane gane', 'full songs jukebox', 'audio songs jukebox', 'continuous mix'
        ];

        for (const kw of banned) {
            if (combined.includes(kw)) return false;
        }
        if (/\b\d+\s*(?:hr|hour|hours)\b/.test(combined)) return false;
        if (/\b\d{2,}\s+songs\b/.test(combined)) return false;
        if (/\bradio\s*(?:show|station|broadcast|special)\b/.test(combined)) return false;

        return true;
    },

    async prefetchNextTrack(track) {
        if (!track) return;
        const trackKey = track.id || track.provider_track_id || track.title;
        if (this._lastPrefetchedSeedKey === trackKey) return;
        this._lastPrefetchedSeedKey = trackKey;

        try {
            const history = State.get('playbackHistory') || [];
            const recentIds = history.map(t => t.id).filter(Boolean);

            const res = await API.getNextRecommended(
                track.id || '',
                track.title,
                track.artist_name,
                track.genre || '',
                recentIds
            );

            if (res && res.next_track && this.isSingleTrack(res.next_track)) {
                State.set('prefetchedNextTrack', res.next_track);
                console.log(`[MusicWave AI] Pre-cached next single song: "${res.next_track.title}" (${res.next_track.artist_name})`);
            }
        } catch (err) {
            console.warn('[MusicWave AI Prefetch notice]:', err);
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

        const playbackSource = State.get('playbackSource');
        const queue = State.get('queue') || [];
        const shuffle = State.get('shuffle');

        // 1. Inside a playlist: play through ALL songs in the playlist
        if (playbackSource === 'playlist' && queue.length > 0) {
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
                return;
            } else if (repeatMode === 'all') {
                State.set('queueIndex', 0);
                this.playTrack(queue[0]);
                return;
            } else {
                UI.showToast('Playlist finished. Continuous recommendation engaged...', 'info');
                await this.playNextRecommended();
                return;
            }
        }

        // 2. Outside a playlist: INSTANT transition using pre-fetched AI single song (0ms latency!)
        const prefetched = State.get('prefetchedNextTrack');
        const current = State.get('currentTrack');
        if (prefetched && this.isSingleTrack(prefetched) && prefetched.title !== current?.title) {
            State.set('prefetchedNextTrack', null);
            if (current && current.id && prefetched.id) {
                API.recordTransition(current.id, prefetched.id).catch(() => {});
            }
            State.set('playbackSource', 'recommendation');
            State.set('queue', [prefetched]);
            State.set('queueIndex', 0);
            UI.showToast(`✨ Next track: ${prefetched.title} (${prefetched.artist_name})`, 'music');
            this.playTrack(prefetched);
            return;
        }

        // 3. Fallback if prefetch was not completed yet
        await this.playNextRecommended();
    },

    async playNextRecommended() {
        const current = State.get('currentTrack');
        if (!current) return;

        try {
            UI.showToast(`✨ Finding next single song...`, 'info');
            const history = State.get('playbackHistory') || [];
            if (!history.some(t => (t.id && t.id === current.id) || (t.title === current.title))) {
                history.push(current);
                State.set('playbackHistory', history);
            }
            const recentIds = history.map(t => t.id).filter(Boolean);

            const res = await API.getNextRecommended(
                current.id || '',
                current.title,
                current.artist_name,
                current.genre || '',
                recentIds
            );

            if (res && res.next_track && this.isSingleTrack(res.next_track)) {
                const nextSong = res.next_track;
                if (current.id && nextSong.id) {
                    API.recordTransition(current.id, nextSong.id).catch(() => {});
                }
                State.set('playbackSource', 'recommendation');
                State.set('queue', [nextSong]);
                State.set('queueIndex', 0);
                this.playTrack(nextSong);
                UI.showToast(`✨ Next track: ${nextSong.title} (${nextSong.artist_name})`, 'music');
                return;
            }

            // Dynamic discovery fallback: query sibling songs by same artist or genre (strictly singles)
            const fallbackQuery = `${current.artist_name || ''} ${current.genre || ''} official single song`.trim();
            const searchRes = await API.search(fallbackQuery, 8);
            if (searchRes && searchRes.results && searchRes.results.length > 0) {
                const validSingles = searchRes.results.filter(t => this.isSingleTrack(t) && t.title !== current.title);
                if (validSingles.length > 0) {
                    const fallbackTrack = validSingles[0];
                    State.set('playbackSource', 'recommendation');
                    State.set('queue', [fallbackTrack]);
                    State.set('queueIndex', 0);
                    this.playTrack(fallbackTrack);
                    return;
                }
            }

            const trendingRes = await API.getTrending(8);
            if (trendingRes && trendingRes.tracks && trendingRes.tracks.length > 0) {
                const validTrending = trendingRes.tracks.filter(t => this.isSingleTrack(t) && t.title !== current.title);
                if (validTrending.length > 0) {
                    const trTrack = validTrending[0];
                    State.set('playbackSource', 'recommendation');
                    State.set('queue', [trTrack]);
                    State.set('queueIndex', 0);
                    this.playTrack(trTrack);
                    return;
                }
            }
        } catch (e) {
            console.warn('Auto-next recommendation error, using fallback:', e);
            try {
                const searchRes = await API.search(`${current.artist_name || ''} official single song`.trim(), 8);
                if (searchRes && searchRes.results && searchRes.results.length > 0) {
                    const validSingles = searchRes.results.filter(t => this.isSingleTrack(t) && t.title !== current.title);
                    if (validSingles.length > 0) {
                        const fallbackTrack = validSingles[0];
                        State.set('playbackSource', 'recommendation');
                        State.set('queue', [fallbackTrack]);
                        State.set('queueIndex', 0);
                        this.playTrack(fallbackTrack);
                    }
                }
            } catch (fbErr) {
                console.error("Auto next fallback error:", fbErr);
            }
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
        let user = State.get('user');
        if (!user) {
            user = await API.createGuestSession();
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
        const registerGroup = document.getElementById('auth-register-group');
        const loginGroup = document.getElementById('auth-login-group');
        const passwordHint = document.getElementById('auth-password-hint');
        const errorMsg = document.getElementById('auth-error-msg');
        const identInput = document.getElementById('auth-identifier-input');
        const usernameInput = document.getElementById('auth-username-input');

        if (!overlay) return;
        if (errorMsg) errorMsg.style.display = 'none';
        overlay.classList.add('active');

        if (mode === 'login') {
            if (title) title.textContent = 'Sign In to MusicWave';
            if (submitBtn) submitBtn.textContent = 'Sign In';
            if (registerGroup) registerGroup.style.display = 'none';
            if (loginGroup) loginGroup.style.display = 'block';
            if (passwordHint) passwordHint.style.display = 'none';
            if (switchText) {
                switchText.innerHTML = `Don't have an account? <a href="javascript:void(0)" onclick="App.openAuthModal('register')" style="color:var(--primary); font-weight:600;">Create One</a>`;
            }
            overlay.dataset.mode = 'login';
            if (identInput) setTimeout(() => identInput.focus(), 150);
        } else {
            if (title) title.textContent = 'Create MusicWave Account';
            if (submitBtn) submitBtn.textContent = 'Create Free Account';
            if (registerGroup) registerGroup.style.display = 'block';
            if (loginGroup) loginGroup.style.display = 'none';
            if (passwordHint) passwordHint.style.display = 'inline';
            if (switchText) {
                switchText.innerHTML = `Already have an account? <a href="javascript:void(0)" onclick="App.openAuthModal('login')" style="color:var(--primary); font-weight:600;">Sign In</a>`;
            }
            overlay.dataset.mode = 'register';
            if (usernameInput) setTimeout(() => usernameInput.focus(), 150);
        }
    },

    closeAuthModal() {
        const overlay = document.getElementById('auth-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    togglePasswordVisibility(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            if (btn) btn.textContent = '🙈';
        } else {
            input.type = 'password';
            if (btn) btn.textContent = '👁️';
        }
    },

    async handleAuthSubmit(e) {
        e.preventDefault();
        const overlay = document.getElementById('auth-modal-overlay');
        const mode = overlay.dataset.mode;
        const errEl = document.getElementById('auth-error-msg');
        const submitBtn = document.getElementById('auth-modal-submit');
        const pwdInput = document.getElementById('auth-password-input');
        const pwd = pwdInput ? pwdInput.value : '';

        if (errEl) errEl.style.display = 'none';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'login' ? 'Signing In...' : 'Creating Account...';
        }

        try {
            let res;
            if (mode === 'login') {
                const identInput = document.getElementById('auth-identifier-input');
                const identifier = identInput ? identInput.value.trim() : '';
                if (!identifier) throw new Error('Please enter your username or email address.');
                if (!pwd) throw new Error('Please enter your password.');
                res = await API.login(identifier, pwd);
            } else {
                const usernameInput = document.getElementById('auth-username-input');
                const emailInput = document.getElementById('auth-email-input');
                const displayNameInput = document.getElementById('auth-displayname-input');

                const username = usernameInput ? usernameInput.value.trim() : '';
                const email = emailInput ? emailInput.value.trim() : '';
                const displayName = displayNameInput ? displayNameInput.value.trim() : '';

                if (!username || username.length < 3) {
                    throw new Error('Username must be at least 3 characters long.');
                }
                if (!email || !email.includes('@')) {
                    throw new Error('Please enter a valid email address.');
                }
                if (!pwd || pwd.length < 6) {
                    throw new Error('Password must be at least 6 characters long.');
                }

                res = await API.register(username, email, pwd, displayName || username);
            }

            State.set('user', res.user);
            localStorage.setItem('musicwave_auth_user', JSON.stringify(res.user));
            localStorage.setItem('musicwave_user_id', res.user.id);
            this.updateUserUI(res.user);
            this.closeAuthModal();
            UI.showToast(res.message || `Welcome, ${res.user.display_name || res.user.username}!`, 'success');
        } catch (err) {
            const msg = err.message || 'Authentication failed. Please try again.';
            if (errEl) {
                errEl.textContent = msg;
                errEl.style.display = 'block';
            } else {
                UI.showToast(msg, 'error');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Free Account';
            }
        }
    },

    async logout() {
        try {
            await API.logout();
        } catch (e) {}
        localStorage.removeItem('musicwave_auth_user');
        localStorage.removeItem('musicwave_user_id');
        State.set('user', null);
        this.updateUserUI(null);
        UI.showToast('You have been logged out.', 'info');
        // Provision a fresh guest identity for instant features without page refresh
        const guestUser = await API.createGuestSession();
        if (guestUser) {
            State.set('user', guestUser);
            this.updateUserUI(guestUser);
        }
        this.navigateTo('home');
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

        let user = State.get('user');
        if (!user) {
            user = await API.createGuestSession();
        }

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
            State.set('isJamHost', data.is_host);
            State.set('jamCurrentTrack', data.current_track);
            UI.renderJamRoom(data);

            // Connect to real-time socket room
            if (this.socket) {
                this.socket.emit('join_jam', {
                    room_id: roomId,
                    user: State.get('user')
                });
            }

            // Start dual-channel synchronization engine for 100% reliable continuous sync
            this.startJamSyncPoller(roomId);

            // If listener and host is already playing a track, auto-start in sync
            if (!data.is_host && data.current_track) {
                const pos = data.room.playback_position || 0;
                if (data.room.playback_status === 'playing') {
                    UI.showToast(`🎧 Synchronizing with host track: ${data.current_track.title}`, 'music');
                    this.playTrack(data.current_track, { fromJam: true, startPosition: pos });
                }
            }
        } catch (err) {
            UI.showToast(err.message || 'Failed to load Jam room', 'error');
        }
    },

    startJamSyncPoller(roomId) {
        this.stopJamSyncPoller();
        this.jamPoller = setInterval(async () => {
            const activeJam = State.get('activeJamRoom');
            if (!activeJam || activeJam.id !== roomId) {
                this.stopJamSyncPoller();
                return;
            }

            const isHost = State.get('isJamHost');
            // Listeners automatically synchronize to the host's room state
            if (isHost) return;

            try {
                const data = await API.getJamRoom(roomId);
                if (!data || !data.room) return;

                // Host ended room
                if (data.room.is_active === false) {
                    UI.showToast('The Jam host has ended this listening party.', 'info');
                    this.leaveCurrentJam(roomId, false);
                    return;
                }

                const hostTrack = data.current_track;
                const hostStatus = data.room.playback_status || 'paused';
                const hostPos = parseFloat(data.room.playback_position || 0.0);
                const currentTrack = State.get('currentTrack');
                const isPlaying = State.get('isPlaying');

                if (hostTrack) {
                    const isNewTrack = !currentTrack ||
                        (hostTrack.id && currentTrack.id && hostTrack.id !== currentTrack.id) ||
                        (hostTrack.provider_track_id && currentTrack.provider_track_id && hostTrack.provider_track_id !== currentTrack.provider_track_id) ||
                        (hostTrack.title !== currentTrack.title);

                    if (isNewTrack) {
                        console.log('[Jam Sync Poller] Detected new host track:', hostTrack.title);
                        UI.showToast(`🎧 Jam Host started: ${hostTrack.title}`, 'music');
                        State.set('jamCurrentTrack', hostTrack);
                        let startSec = hostPos;
                        if (hostStatus === 'playing' && data.room.playback_updated_at) {
                            const updatedTime = new Date(data.room.playback_updated_at).getTime();
                            if (!isNaN(updatedTime)) {
                                const elapsed = Math.max(0, (Date.now() - updatedTime) / 1000);
                                const dur = hostTrack.duration || 300;
                                if (elapsed < dur) {
                                    startSec = Math.min(dur - 2, hostPos + elapsed);
                                }
                            }
                        }
                        this.playTrack(hostTrack, { fromJam: true, startPosition: startSec });
                        return;
                    }

                    // Same track: sync play/pause status
                    if (hostStatus === 'paused' && isPlaying) {
                        if (this.ytPlayer && this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
                        if (this.audio) this.audio.pause();
                        State.set('isPlaying', false);
                    } else if (hostStatus === 'playing' && !isPlaying) {
                        if (hostTrack.provider_id === 'youtube') {
                            if (this.ytPlayer && this.ytPlayer.playVideo) this.ytPlayer.playVideo();
                        } else if (this.audio) {
                            this.audio.play()
                                .then(() => State.set('isPlaying', true))
                                .catch(() => this.showJamTuneInBanner(hostTrack));
                        }
                    }

                    // Drift alignment (> 4s drift)
                    const myPos = State.get('currentTime') || 0;
                    if (hostStatus === 'playing' && Math.abs(myPos - hostPos) > 4) {
                        if (hostTrack.provider_id === 'youtube') {
                            if (this.ytPlayer && this.ytPlayer.seekTo) this.ytPlayer.seekTo(hostPos, true);
                        } else if (this.audio) {
                            this.audio.currentTime = hostPos;
                        }
                    }
                }
            } catch (e) {
                // Background sync error tolerance
            }
        }, 2200);
    },

    stopJamSyncPoller() {
        if (this.jamPoller) {
            clearInterval(this.jamPoller);
            this.jamPoller = null;
        }
    },

    showJamTuneInBanner(track) {
        let banner = document.getElementById('jam-tune-in-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'jam-tune-in-banner';
            banner.style.cssText = `
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #8b5cf6, #ec4899);
                color: #fff;
                padding: 12px 24px;
                border-radius: 30px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(139,92,246,0.6);
                z-index: 99999;
                display: flex;
                align-items: center;
                gap: 14px;
                font-weight: 600;
                font-size: 0.92rem;
                cursor: pointer;
            `;
            document.body.appendChild(banner);
        }
        banner.innerHTML = `
            <span>🎧 Jam Playing: <strong>${track.title || 'Live Music'}</strong></span>
            <button style="background: #fff; color: #1e1035; border: none; padding: 6px 14px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 0.85rem;" onclick="App.unmuteAndSyncJam()">
                ▶ Tap to Listen Along
            </button>
        `;
        banner.style.display = 'flex';
    },

    hideJamTuneInBanner() {
        const banner = document.getElementById('jam-tune-in-banner');
        if (banner) banner.style.display = 'none';
    },

    unmuteAndSyncJam() {
        this.hideJamTuneInBanner();
        const current = State.get('currentTrack');
        if (current) {
            if (current.provider_id === 'youtube') {
                if (this.ytPlayer && this.ytPlayer.playVideo) {
                    this.ytPlayer.playVideo();
                    State.set('isPlaying', true);
                }
            } else if (this.audio) {
                this.audio.play().then(() => {
                    State.set('isPlaying', true);
                }).catch(() => {});
            }
        } else {
            this.syncWithHostNow();
        }
    },

    syncWithHostNow() {
        const activeJam = State.get('activeJamRoom');
        if (!activeJam) return;
        API.getJamRoom(activeJam.id).then(data => {
            if (data.current_track) {
                const pos = data.room.playback_position || 0;
                UI.showToast(`🎧 Syncing audio with host: ${data.current_track.title}...`, 'music');
                this.playTrack(data.current_track, { fromJam: true, startPosition: pos });
            } else {
                UI.showToast('Host has not started a song yet. Waiting for host...', 'info');
            }
        }).catch(err => {
            UI.showToast(err.message || 'Sync failed', 'error');
        });
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
        this.stopJamSyncPoller();
        this.hideJamTuneInBanner();
        if (this.jamTimer) {
            clearInterval(this.jamTimer);
            this.jamTimer = null;
        }
        if (this.socket) {
            this.socket.emit('leave_jam', {
                room_id: roomId,
                user: State.get('user')
            });
        }
        await API.leaveJam(roomId).catch(() => {});
        State.set('activeJamRoom', null);
        State.set('isJamHost', false);
        State.set('jamCurrentTrack', null);
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
            this.stopJamSyncPoller();
            this.hideJamTuneInBanner();
            if (this.jamTimer) {
                clearInterval(this.jamTimer);
                this.jamTimer = null;
            }
            if (this.socket) {
                this.socket.emit('leave_jam', {
                    room_id: roomId,
                    user: State.get('user')
                });
            }
            await API.endJam(roomId);
            State.set('activeJamRoom', null);
            State.set('isJamHost', false);
            State.set('jamCurrentTrack', null);
            UI.showToast('Jam room has been ended and closed.', 'success');
            this.navigateTo('jams');
        } catch (err) {
            UI.showToast(err.message || 'Failed to end Jam room', 'error');
        }
    },

    openCreateJamModal() {
        const overlay = document.getElementById('create-jam-modal-overlay');
        const input = document.getElementById('create-jam-name-input');
        const descInput = document.getElementById('create-jam-desc-input');
        const err = document.getElementById('create-jam-error-msg');
        if (err) err.style.display = 'none';
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 150);
        }
        if (descInput) descInput.value = '';
        if (overlay) overlay.classList.add('active');
    },

    closeCreateJamModal() {
        const overlay = document.getElementById('create-jam-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    async handleCreateJamSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('create-jam-name-input');
        const descInput = document.getElementById('create-jam-desc-input');
        const errEl = document.getElementById('create-jam-error-msg');
        const submitBtn = document.getElementById('create-jam-submit-btn');

        const name = input ? input.value.trim() : '';
        const description = descInput ? descInput.value.trim() : '';
        if (!name) return;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Room...';
        }

        try {
            let user = State.get('user');
            if (!user) {
                user = await API.createGuestSession();
            }

            UI.showToast('Setting up your Jam room...', 'info');
            const res = await API.createJam(name, description || 'Synchronized music listening party');
            if (res.user_id) {
                localStorage.setItem('musicwave_user_id', res.user_id);
                if (!State.get('user')) {
                    State.set('user', { id: res.user_id, username: `Guest_${res.user_id}`, role: 'user' });
                }
            }
            this.closeCreateJamModal();
            UI.showToast(`🎉 Jam room "${name}" created! 4-Digit Code: ${res.room.join_code}`, 'success');
            await this.enterJamRoom(res.room.id);
        } catch (err) {
            if (errEl) {
                errEl.textContent = err.message || 'Failed to create Jam room';
                errEl.style.display = 'block';
            } else {
                UI.showToast(err.message || 'Failed to create Jam room', 'error');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '🚀 Create Jam Room & Get 4-Digit Code';
            }
        }
    },

    openCreatePlaylistModal() {
        const overlay = document.getElementById('create-playlist-modal-overlay');
        const input = document.getElementById('create-playlist-title-input');
        const err = document.getElementById('create-playlist-error-msg');
        if (err) err.style.display = 'none';
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 150);
        }
        if (overlay) overlay.classList.add('active');
    },

    closeCreatePlaylistModal() {
        const overlay = document.getElementById('create-playlist-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    async handleCreatePlaylistSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('create-playlist-title-input');
        const errEl = document.getElementById('create-playlist-error-msg');
        const title = input ? input.value.trim() : '';
        if (!title) return;

        try {
            let user = State.get('user') || localStorage.getItem('musicwave_user_id');
            if (!user) {
                user = await API.createGuestSession();
            }
            await API.createPlaylist(title, '');
            this.closeCreatePlaylistModal();
            UI.showToast(`Playlist "${title}" created!`, 'success');
            this.navigateTo('library');
        } catch (err) {
            if (errEl) {
                errEl.textContent = err.message || 'Failed to create playlist';
                errEl.style.display = 'block';
            } else {
                UI.showToast(err.message || 'Failed to create playlist', 'error');
            }
        }
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
