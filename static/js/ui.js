/**
 * MusicWave - Dynamic UI Rendering & View Engine
 */
const UI = {
    // Utility: Format seconds to M:SS
    formatTime(seconds) {
        if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    },

    // Utility: Show Toast Notifications
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '⚠️';
        if (type === 'music') icon = '🎵';

        toast.innerHTML = `<span>${icon}</span><span style="flex:1;">${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // Render Navigation Active Link
    updateActiveNav(page) {
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.page === page) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    },

    // Render Home View
    renderHome() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <!-- Hero Banner: Album / Feature of the day -->
            <section class="hero-banner">
                <div class="hero-content">
                    <span class="hero-tag">⚡ FEATURED JAM</span>
                    <h1 class="hero-title">Late Night Lo-Fi Beats</h1>
                    <p class="hero-desc">Discover mellow grooves and chill rhythms with listeners worldwide. Powered by open-license independent creators.</p>
                    <div class="hero-actions">
                        <button class="btn-primary" onclick="App.navigateTo('jams')">
                            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            Join Jam Room
                        </button>
                        <button class="btn-secondary" onclick="App.navigateTo('explore')">
                            Explore Catalog
                        </button>
                    </div>
                </div>
            </section>

            <!-- Browse by Genre / Moods -->
            <section style="margin-bottom: 36px;">
                <div class="section-header">
                    <h2 class="section-title">Browse by Genre</h2>
                    <a href="javascript:void(0)" class="section-link" onclick="App.navigateTo('explore')">See All</a>
                </div>
                <div class="genre-cards-grid" id="home-genres-grid">
                    <div style="color: var(--text-muted); padding: 20px;">Loading genres...</div>
                </div>
            </section>

            <!-- Trending Music -->
            <section style="margin-bottom: 36px;">
                <div class="section-header">
                    <h2 class="section-title">Trending Music</h2>
                    <a href="javascript:void(0)" class="section-link" onclick="App.navigateTo('explore')">See All</a>
                </div>
                <div class="grid-cards" id="home-trending-grid">
                    <div style="color: var(--text-muted); padding: 20px;">Fetching free legal music...</div>
                </div>
            </section>

            <!-- Active Jam Rooms Activity -->
            <section style="margin-bottom: 36px;">
                <div class="section-header">
                    <h2 class="section-title">Live Music Jams</h2>
                    <button class="btn-primary" style="padding: 6px 16px; font-size: 0.82rem;" onclick="App.openCreateJamModal()">+ Create Jam</button>
                </div>
                <div class="grid-cards" id="home-jams-grid">
                    <div style="color: var(--text-muted); padding: 20px;">Checking active rooms...</div>
                </div>
            </section>
        `;

        this.loadHomeData();
    },

    async loadHomeData() {
        // Load Genres
        try {
            const data = await API.getGenres();
            const grid = document.getElementById('home-genres-grid');
            if (grid && data.genres) {
                grid.innerHTML = data.genres.slice(0, 6).map(g => `
                    <div class="genre-card" style="background: linear-gradient(135deg, ${g.color_accent} 0%, rgba(18, 18, 28, 0.9) 100%);" onclick="App.browseGenre('${g.name}')">
                        <span>${g.name}</span>
                        ${g.image_url ? `<img src="${g.image_url}" class="genre-card-img" alt="${g.name}" loading="lazy"/>` : ''}
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error('Failed to load genres:', e);
        }

        // Load Trending Tracks
        try {
            const data = await API.getTrending();
            const grid = document.getElementById('home-trending-grid');
            if (grid) {
                if (data.tracks && data.tracks.length > 0) {
                    grid.innerHTML = data.tracks.slice(0, 8).map(t => this.createMusicCardHTML(t)).join('');
                } else {
                    grid.innerHTML = `
                        <div style="grid-column: 1/-1; padding: 30px; text-align: center; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                            <p style="color: var(--text-secondary); margin-bottom: 10px;">Free music providers are ready to stream.</p>
                            <button class="btn-secondary" onclick="App.navigateTo('explore')">Discover Open Catalog</button>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error('Failed to load trending tracks:', e);
        }

        // Load Jams
        try {
            const data = await API.getJams();
            const grid = document.getElementById('home-jams-grid');
            if (grid) {
                if (data.jams && data.jams.length > 0) {
                    grid.innerHTML = data.jams.map(j => `
                        <div class="music-card" onclick="App.joinJam('${j.id}')">
                            <div class="music-card-cover-wrapper">
                                <img src="${j.cover_url || '/static/images/default-jam.png'}" class="music-card-cover" alt="${j.name}"/>
                                <div class="music-card-play-overlay">
                                    <div class="play-circle-btn">
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                    </div>
                                </div>
                            </div>
                            <div class="music-card-title truncate">${j.name}</div>
                            <div class="music-card-subtitle truncate">Hosted by ${j.host_name} • ${j.participant_count} listening</div>
                        </div>
                    `).join('');
                } else {
                    grid.innerHTML = `
                        <div style="grid-column: 1/-1; padding: 24px; text-align: center; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                            <p style="color: var(--text-secondary); margin-bottom: 12px;">No active public jams at the moment.</p>
                            <button class="btn-primary" onclick="App.openCreateJamModal()">Start the First Jam</button>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error('Failed to load jams:', e);
        }
    },

    createMusicCardHTML(track) {
        const title = track.title || 'Untitled Track';
        const artist = track.artist_name || 'Unknown Artist';
        const artwork = track.artwork_url || '/static/images/default-cover.png';
        const trackJSON = JSON.stringify(track).replace(/"/g, '&quot;');

        return `
            <div class="music-card" onclick="App.playTrack(${trackJSON})">
                <div class="music-card-cover-wrapper">
                    <img src="${artwork}" class="music-card-cover" alt="${title}" loading="lazy"/>
                    <div class="music-card-play-overlay">
                        <div class="play-circle-btn">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </div>
                </div>
                <div class="music-card-title truncate" title="${title}">${title}</div>
                <div class="music-card-subtitle truncate" title="${artist}">${artist}</div>
            </div>
        `;
    },

    // Render Explore View
    renderExplore() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="section-header">
                <h1 class="section-title">Explore Free Music</h1>
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                Stream and download high-quality legally licensed music from Jamendo, Internet Archive, and curated open vaults.
            </p>
            <div id="explore-genres-section">
                <h2 class="section-title" style="font-size: 1.15rem; margin-bottom: 16px;">All Genres</h2>
                <div class="genre-cards-grid" id="explore-genres-grid"></div>
            </div>
        `;
        API.getGenres().then(res => {
            const grid = document.getElementById('explore-genres-grid');
            if (grid && res.genres) {
                grid.innerHTML = res.genres.map(g => `
                    <div class="genre-card" style="background: linear-gradient(135deg, ${g.color_accent} 0%, rgba(18, 18, 28, 0.9) 100%);" onclick="App.browseGenre('${g.name}')">
                        <span>${g.name}</span>
                        ${g.image_url ? `<img src="${g.image_url}" class="genre-card-img" alt="${g.name}" loading="lazy"/>` : ''}
                    </div>
                `).join('');
            }
        });
    },

    // Render Search View with typo tolerance
    renderSearch(query = '') {
        State.set('lastSearchQuery', query);
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="section-header">
                <div>
                    <h1 class="section-title">${query ? `Search results for "${query}"` : 'Search Music'}</h1>
                    <div id="search-spell-correction" style="font-size: 0.88rem; color: var(--accent-amber); margin-top: 4px;"></div>
                </div>
            </div>
            <div id="search-results-container">
                ${query ? '<div style="color: var(--text-muted); padding: 20px;">Searching across all songs and providers...</div>' : '<p style="color: var(--text-secondary);">Type any song title, artist, or genre above to find and play music.</p>'}
            </div>
        `;

        if (query) {
            API.search(query).then(res => {
                const resultsEl = document.getElementById('search-results-container');
                const correctionEl = document.getElementById('search-spell-correction');
                if (!resultsEl) return;

                if (res.correction && correctionEl) {
                    correctionEl.innerHTML = `✨ Showing results for <strong>${res.correction}</strong> (auto-corrected from "${query}")`;
                }

                if (res.results && res.results.length > 0) {
                    resultsEl.innerHTML = `
                        <div class="grid-cards">
                            ${res.results.map(t => this.createMusicCardHTML(t)).join('')}
                        </div>
                    `;
                } else {
                    resultsEl.innerHTML = `
                        <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
                            No tracks found matching "<strong>${query}</strong>". Try another keyword or genre.
                        </div>
                    `;
                }
            }).catch(err => {
                const resultsEl = document.getElementById('search-results-container');
                if (resultsEl) resultsEl.innerHTML = `<div style="color: var(--accent-rose);">Search error: ${err.message}</div>`;
            });
        }
    },

    // Render Library View (Smart Mixes & Custom Playlists)
    renderLibrary() {
        const container = document.getElementById('main-content');
        const user = State.get('user');
        container.innerHTML = `
            <div class="section-header">
                <div>
                    <h1 class="section-title">Your Library</h1>
                    <p style="color: var(--text-secondary); font-size: 0.88rem; margin-top: 4px;">Smart auto-curated playlists and your personal custom collections.</p>
                </div>
                ${user ? '<button class="btn-primary" onclick="App.openCreatePlaylistModal()">+ New Custom Playlist</button>' : ''}
            </div>

            ${!user ? `
                <div style="padding: 40px; text-align: center; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
                    <h3 style="margin-bottom: 8px;">Sign in to view your library & smart mixes</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">Keep your account logged in permanently on this laptop and auto-sort every song you listen to.</p>
                    <button class="btn-primary" onclick="App.openAuthModal('login')">Sign In</button>
                </div>
            ` : `
                <!-- 1. Smart Auto-Generated Playlists (By Genre & Mood) -->
                <section style="margin-bottom: 36px;">
                    <div class="section-header">
                        <h2 class="section-title" style="font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
                            <span>✨ Smart Mixes</span>
                            <span class="badge" style="background: rgba(139, 92, 246, 0.2); color: var(--primary); font-size: 0.72rem;">Auto-Generated for You</span>
                        </h2>
                    </div>
                    <div class="grid-cards" id="library-smart-playlists-grid">
                        <div style="color: var(--text-muted); padding: 10px;">Loading smart mixes...</div>
                    </div>
                </section>

                <!-- 2. User Custom Playlists -->
                <section style="margin-bottom: 36px;">
                    <div class="section-header">
                        <h2 class="section-title" style="font-size: 1.15rem;">Your Custom Playlists</h2>
                    </div>
                    <div class="grid-cards" id="library-custom-playlists-grid">
                        <div style="color: var(--text-muted); padding: 10px;">Loading custom playlists...</div>
                    </div>
                </section>
            `}
        `;

        if (user) {
            API.getPlaylists().then(res => {
                const smartGrid = document.getElementById('library-smart-playlists-grid');
                const customGrid = document.getElementById('library-custom-playlists-grid');

                // Render Smart Playlists
                if (smartGrid) {
                    const smartList = res.smart_playlists || [];
                    if (smartList.length > 0) {
                        smartGrid.innerHTML = smartList.map(p => `
                            <div class="music-card" onclick="App.openPlaylist(${p.id})">
                                <div class="music-card-cover-wrapper">
                                    <img src="${p.cover_url || '/static/images/default-playlist.png'}" class="music-card-cover" alt="${p.title}"/>
                                </div>
                                <div class="music-card-title truncate">${p.title}</div>
                                <div class="music-card-subtitle truncate">${p.track_count} tracks • Auto-sorted</div>
                            </div>
                        `).join('');
                    } else {
                        smartGrid.innerHTML = `
                            <div style="grid-column: 1/-1; padding: 24px; text-align: center; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle); color: var(--text-secondary);">
                                Search and play Punjabi, Retro, Bollywood, or Sad songs to see them automatically sorted into smart playlists here!
                            </div>
                        `;
                    }
                }

                // Render Custom Playlists
                if (customGrid) {
                    const customList = res.custom_playlists || [];
                    if (customList.length > 0) {
                        customGrid.innerHTML = customList.map(p => `
                            <div class="music-card" onclick="App.openPlaylist(${p.id})">
                                <div class="music-card-cover-wrapper">
                                    <img src="${p.cover_url || '/static/images/default-playlist.png'}" class="music-card-cover" alt="${p.title}"/>
                                </div>
                                <div class="music-card-title truncate">${p.title}</div>
                                <div class="music-card-subtitle truncate">${p.track_count} tracks</div>
                            </div>
                        `).join('');
                    } else {
                        customGrid.innerHTML = `
                            <div style="grid-column: 1/-1; padding: 24px; text-align: center; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle); color: var(--text-secondary);">
                                No custom playlists yet. Click "+ New Custom Playlist" to create one.
                            </div>
                        `;
                    }
                }
            });
        }
    },

    // Render Playlist Detail View (Tracks in the Playlist)
    renderPlaylistView(playlist, tracks) {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div style="display: flex; align-items: flex-end; gap: 24px; margin-bottom: 32px; padding: 24px; background: linear-gradient(180deg, rgba(139, 92, 246, 0.15) 0%, transparent 100%); border-radius: var(--radius-lg);">
                <img src="${playlist.cover_url || '/static/images/default-playlist.png'}" style="width: 140px; height: 140px; border-radius: var(--radius-md); object-fit: cover; box-shadow: var(--shadow-lg);" />
                <div>
                    <span class="badge" style="background: rgba(139, 92, 246, 0.25); color: var(--primary);">${playlist.is_auto_generated ? 'Smart Auto-Mix' : 'Custom Playlist'}</span>
                    <h1 style="font-size: 2rem; font-weight: 800; margin: 8px 0;">${playlist.title}</h1>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${playlist.description || ''}</p>
                    <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">${tracks.length} tracks</p>
                </div>
            </div>

            <div class="section-header">
                <button class="btn-primary" onclick="App.playPlaylistFirstTrack()" ${tracks.length === 0 ? 'disabled' : ''}>
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    Play All
                </button>
                <button class="btn-secondary" onclick="App.navigateTo('library')">← Back to Library</button>
            </div>

            <div style="margin-top: 20px;">
                ${tracks.length > 0 ? `
                    <div class="grid-cards">
                        ${tracks.map(t => this.createMusicCardHTML(t)).join('')}
                    </div>
                ` : `
                    <div style="padding: 40px; text-align: center; color: var(--text-secondary); background: var(--bg-surface); border-radius: var(--radius-md);">
                        This playlist has no tracks yet.
                    </div>
                `}
            </div>
        `;
    },

    // Render Downloads View (Offline Storage)
    renderDownloads() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="section-header">
                <h1 class="section-title">Downloaded Tracks (Offline Storage)</h1>
                <span class="status-pill" id="storage-status-pill">IndexedDB Storage</span>
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                These tracks are saved directly in your browser's IndexedDB and can be played anytime, even without an active internet connection.
            </p>
            <div id="downloads-list-container">
                <div style="padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-md);">
                    Scanning local offline database...
                </div>
            </div>
        `;
    },

    // Render Favourites View
    renderFavourites() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="section-header">
                <h1 class="section-title">Your Favourites</h1>
            </div>
            <div id="favourites-list-container">
                <div style="color: var(--text-muted); padding: 20px;">Loading your favourites...</div>
            </div>
        `;
        API.getFavourites().then(res => {
            const listEl = document.getElementById('favourites-list-container');
            if (!listEl) return;
            if (res.favourites && res.favourites.length > 0) {
                listEl.innerHTML = `
                    <div class="grid-cards">
                        ${res.favourites.map(t => this.createMusicCardHTML(t)).join('')}
                    </div>
                `;
            } else {
                listEl.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: var(--text-secondary); background: var(--bg-surface); border-radius: var(--radius-md);">
                        No favourite tracks yet. Click the heart icon on any song to save it here!
                    </div>
                `;
            }
        });
    },

    // Render Jams View
    renderJams() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="section-header">
                <div>
                    <h1 class="section-title">Music Jams</h1>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 4px;">Listen to synchronized music together with friends in real-time rooms.</p>
                </div>
                <button class="btn-primary" onclick="App.openCreateJamModal()">+ Create Jam</button>
            </div>
            <div class="grid-cards" id="jams-page-grid" style="margin-top: 24px;">
                <div style="color: var(--text-muted); padding: 20px;">Fetching active rooms...</div>
            </div>
        `;
        API.getJams().then(res => {
            const grid = document.getElementById('jams-page-grid');
            if (!grid) return;
            if (res.jams && res.jams.length > 0) {
                grid.innerHTML = res.jams.map(j => `
                    <div class="music-card" onclick="App.joinJam('${j.id}')">
                        <div class="music-card-cover-wrapper">
                            <img src="${j.cover_url || '/static/images/default-jam.png'}" class="music-card-cover" alt="${j.name}"/>
                            <div class="music-card-play-overlay">
                                <div class="play-circle-btn">
                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                            </div>
                        </div>
                        <div class="music-card-title truncate">${j.name}</div>
                        <div class="music-card-subtitle truncate">Host: ${j.host_name} • ${j.participant_count} listening</div>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary); background: var(--bg-surface); border-radius: var(--radius-md);">
                        <p style="margin-bottom: 14px;">No active public Jam rooms found.</p>
                        <button class="btn-primary" onclick="App.openCreateJamModal()">Host the First Jam Room</button>
                    </div>
                `;
            }
        });
    },

    // Render Friends View
    renderFriends() {
        const container = document.getElementById('main-content');
        const user = State.get('user');
        container.innerHTML = `
            <div class="section-header">
                <h1 class="section-title">Friends & Social</h1>
            </div>
            ${!user ? `
                <div style="padding: 40px; text-align: center; background: var(--bg-surface); border-radius: var(--radius-lg);">
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">Log in to connect with friends and invite them to Jam listening parties.</p>
                    <button class="btn-primary" onclick="App.openAuthModal('login')">Sign In</button>
                </div>
            ` : `
                <div id="friends-list-container">
                    <div style="color: var(--text-muted); padding: 20px;">Loading your friends list...</div>
                </div>
            `}
        `;
        if (user) {
            API.getFriends().then(res => {
                const listEl = document.getElementById('friends-list-container');
                if (listEl && res.friends) {
                    if (res.friends.length > 0) {
                        listEl.innerHTML = res.friends.map(f => `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: var(--bg-surface); border-radius: var(--radius-md); margin-bottom: 8px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <img src="${f.avatar_url || '/static/images/default-avatar.png'}" style="width: 40px; height: 40px; border-radius: 50%;" />
                                    <div>
                                        <div style="font-weight: 600;">${f.display_name || f.username}</div>
                                        <div style="font-size: 0.8rem; color: var(--text-muted);">@${f.username}</div>
                                    </div>
                                </div>
                                <button class="btn-secondary" style="font-size: 0.8rem; padding: 6px 14px;">Invite to Jam</button>
                            </div>
                        `).join('');
                    } else {
                        listEl.innerHTML = `<div style="color: var(--text-secondary); padding: 20px;">No friends added yet. Connect with other music lovers!</div>`;
                    }
                }
            });
        }
    },

    // Render Profile View
    renderProfile() {
        const container = document.getElementById('main-content');
        const user = State.get('user');
        if (!user) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; background: var(--bg-surface); border-radius: var(--radius-lg);">
                    <h2 style="margin-bottom: 8px;">Profile Access</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">Please sign in to view and manage your profile settings.</p>
                    <button class="btn-primary" onclick="App.openAuthModal('login')">Sign In</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="section-header">
                <h1 class="section-title">User Profile</h1>
            </div>
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 28px; max-width: 600px;">
                <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 24px;">
                    <img src="${user.avatar_url || '/static/images/default-avatar.png'}" style="width: 72px; height: 72px; border-radius: 50%; border: 2px solid var(--primary);" />
                    <div>
                        <h2 style="font-size: 1.3rem;">${user.display_name || user.username}</h2>
                        <p style="color: var(--text-muted);">@${user.username} • Role: ${user.role}</p>
                        <p style="font-size: 0.85rem; color: var(--text-secondary);">${user.email}</p>
                        <p style="font-size: 0.8rem; color: var(--accent-emerald); margin-top: 4px;">🔒 Permanent Login Active on this Laptop</p>
                    </div>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn-secondary" onclick="App.navigateTo('settings')">Settings</button>
                    <button class="btn-secondary" style="color: var(--accent-rose); border-color: rgba(244, 63, 94, 0.3);" onclick="App.logout()">Sign Out</button>
                </div>
            </div>
        `;
    },

    // Render Settings View
    renderSettings() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="section-header">
                <h1 class="section-title">Application Settings</h1>
            </div>
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 24px; max-width: 600px; display: flex; flex-direction: column; gap: 20px;">
                <div>
                    <h3 style="font-size: 1rem; margin-bottom: 4px;">Audio Playback Quality</h3>
                    <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 8px;">Select default streaming fidelity</p>
                    <select style="width: 100%; padding: 10px; border-radius: var(--radius-md);">
                        <option value="high" selected>High (320kbps MP3 / Flac / HD Audio)</option>
                        <option value="medium">Medium (192kbps)</option>
                        <option value="saver">Data Saver (128kbps)</option>
                    </select>
                </div>
                <div>
                    <h3 style="font-size: 1rem; margin-bottom: 4px;">Smart Playlist Auto-Sorting</h3>
                    <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 8px;">Automatically categorize searched songs into Punjabi, Retro, Bollywood, Sad, and Lo-fi smart playlists</p>
                    <input type="checkbox" id="setting-auto-sort" checked style="width: 18px; height: 18px; accent-color: var(--primary);" />
                </div>
                <div>
                    <h3 style="font-size: 1rem; margin-bottom: 4px;">Permanent Laptop Session</h3>
                    <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 8px;">Never log out automatically on this browser</p>
                    <input type="checkbox" id="setting-permanent-session" checked disabled style="width: 18px; height: 18px; accent-color: var(--primary);" />
                </div>
            </div>
        `;
    },

    // Render Admin View
    renderAdmin() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="section-header">
                <h1 class="section-title">Admin Management Dashboard</h1>
            </div>
            <div id="admin-content-area">
                <div style="color: var(--text-muted); padding: 20px;">Loading platform statistics...</div>
            </div>
        `;
        API.getAdminStats().then(res => {
            const area = document.getElementById('admin-content-area');
            if (area && res.stats) {
                area.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 30px;">
                        <div style="background: var(--bg-surface); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                            <div style="font-size: 0.8rem; color: var(--text-muted);">Registered Users</div>
                            <div style="font-size: 1.8rem; font-weight: 700; color: var(--primary);">${res.stats.users}</div>
                        </div>
                        <div style="background: var(--bg-surface); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                            <div style="font-size: 0.8rem; color: var(--text-muted);">Total Tracks Indexed</div>
                            <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent-amber);">${res.stats.tracks}</div>
                        </div>
                        <div style="background: var(--bg-surface); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                            <div style="font-size: 0.8rem; color: var(--text-muted);">Active Jam Rooms</div>
                            <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent-emerald);">${res.stats.active_jams}</div>
                        </div>
                    </div>
                `;
            }
        }).catch(err => {
            const area = document.getElementById('admin-content-area');
            if (area) {
                area.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">${err.message}</div>`;
            }
        });
    }
};

window.UI = UI;
