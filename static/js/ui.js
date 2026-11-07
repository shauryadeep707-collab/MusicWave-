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
        const safeTitle = (track.title || '').replace(/'/g, "\\'");
        const safeArtist = (track.artist_name || '').replace(/'/g, "\\'");

        const isLofi = track.version_type === 'lofi' || /lofi|lo-fi|slowed|reverb|chillhop/i.test(title);
        const versionBadge = isLofi 
            ? `<span class="version-badge lofi-badge" title="Lo-Fi Chill Version">☕ Lo-Fi</span>`
            : `<span class="version-badge official-badge" title="Official Studio Version">👑 Official</span>`;

        const switchVersionBtn = isLofi
            ? `<button class="card-version-switch-btn" onclick="event.stopPropagation(); App.playAlternativeVersion('${safeTitle}', '${safeArtist}', 'official')" title="Play Official Version">👑 Official</button>`
            : `<button class="card-version-switch-btn" onclick="event.stopPropagation(); App.playAlternativeVersion('${safeTitle}', '${safeArtist}', 'lofi')" title="Play Lo-Fi Version">☕ Lo-Fi</button>`;

        return `
            <div class="music-card" onclick="App.playTrack(${trackJSON})">
                <div class="music-card-cover-wrapper">
                    <img src="${artwork}" class="music-card-cover" alt="${title}" loading="lazy"/>
                    ${versionBadge}
                    <div class="music-card-play-overlay">
                        <div class="play-circle-btn">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </div>
                    ${switchVersionBtn}
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

    // Render Search View with typo tolerance & lyrics recognition
    renderSearch(query = '') {
        State.set('lastSearchQuery', query);
        const container = document.getElementById('main-content');
        const isLyrics = query.trim().split(/\s+/).length >= 3;

        container.innerHTML = `
            <div class="section-header">
                <div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <h1 class="section-title">${query ? `Search: "${query}"` : 'Search Music & Lyrics'}</h1>
                        ${isLyrics ? '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 0.75rem;">🎤 Lyrics Search Active</span>' : ''}
                    </div>
                    <div id="search-spell-correction" style="font-size: 0.88rem; color: var(--accent-amber); margin-top: 4px;"></div>
                </div>
            </div>

            ${query ? `
                <div class="search-version-tabs" id="search-version-tabs">
                    <button class="search-version-tab active" data-filter="all" onclick="UI.filterSearchResults('all')">🌟 All Versions</button>
                    <button class="search-version-tab" data-filter="official" onclick="UI.filterSearchResults('official')">👑 Official Releases</button>
                    <button class="search-version-tab" data-filter="lofi" onclick="UI.filterSearchResults('lofi')">☕ Lo-Fi / Slowed</button>
                </div>
                <div id="search-dual-version-container"></div>
            ` : `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 32px; text-align: center; margin-top: 20px;">
                    <div style="font-size: 2.2rem; margin-bottom: 12px;">🎤 🎵</div>
                    <h2 style="font-size: 1.3rem; font-weight: 700; margin-bottom: 8px;">Search by Song Title or Lyrics Line</h2>
                    <p style="color: var(--text-secondary); max-width: 620px; margin: 0 auto 20px auto; font-size: 0.92rem; line-height: 1.6;">
                        Don't know the exact song title? <strong>Just type any line of lyrics from the song!</strong> MusicWave will recognize the lyrics and present the exact track in both Official Studio and Lo-Fi Chill versions.
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <span style="font-size: 0.82rem; color: var(--text-muted); align-self: center;">Try typing lyrics:</span>
                        <button class="search-version-tab" onclick="UI.triggerSearchExample('apna bana le piya')">🎤 "apna bana le piya"</button>
                        <button class="search-version-tab" onclick="UI.triggerSearchExample('tere vaaste falak se main chaand')">🎤 "tere vaaste falak se"</button>
                        <button class="search-version-tab" onclick="UI.triggerSearchExample('dil diyan gallan karange naal naal')">🎤 "dil diyan gallan"</button>
                        <button class="search-version-tab" onclick="UI.triggerSearchExample('i took an arrow to the heart')">🎤 "i took an arrow to the heart"</button>
                    </div>
                </div>
            `}

            <div id="search-results-container">
                ${query ? '<div style="color: var(--text-muted); padding: 20px;">Searching across all songs, lyrics, and providers...</div>' : ''}
            </div>
        `;

        if (query) {
            // 1. Fetch side-by-side Official & Lo-Fi versions
            API.getTrackVersions(query).then(vRes => {
                const dualContainer = document.getElementById('search-dual-version-container');
                if (!dualContainer) return;

                const official = vRes.official_version;
                const lofi = vRes.lofi_version;

                if (official || lofi) {
                    const offJSON = official ? JSON.stringify(official).replace(/"/g, '&quot;') : null;
                    const lofiJSON = lofi ? JSON.stringify(lofi).replace(/"/g, '&quot;') : null;

                    dualContainer.innerHTML = `
                        <div class="dual-version-card" style="box-sizing: border-box; width: 100%; max-width: 100%; overflow: hidden;">
                            <div class="dual-version-header" style="box-sizing: border-box; width: 100%; max-width: 100%;">
                                <div style="font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                                    <span>🔀 Song Versions for "${query}"</span>
                                </div>
                                <span style="font-size: 0.8rem; color: var(--text-secondary);">Official studio release vs chill relaxing Lo-Fi version</span>
                            </div>
                            <div class="dual-version-grid" style="box-sizing: border-box; width: 100%; max-width: 100%;">
                                ${official ? `
                                    <div class="version-box" style="box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0; overflow: hidden; display: flex; align-items: center; gap: 14px;" onclick="App.playTrack(${offJSON})">
                                        <img src="${official.artwork_url || '/static/images/default-cover.png'}" class="version-box-img" style="flex-shrink: 0; width: 64px; height: 64px; object-fit: cover; border-radius: 8px;" alt="Official"/>
                                        <div class="version-box-info" style="flex: 1 1 0%; min-width: 0; width: 0; overflow: hidden;">
                                            <span class="badge" style="background: rgba(139, 92, 246, 0.25); color: var(--primary); font-size: 0.72rem; padding: 2px 8px; display: inline-block;">👑 Official Studio Version</span>
                                            <div style="font-weight: 700; font-size: 0.95rem; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${official.title}">${official.title}</div>
                                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${official.artist_name}">${official.artist_name}</div>
                                        </div>
                                        <button class="btn-primary version-box-btn" style="flex-shrink: 0; white-space: nowrap; padding: 8px 18px; font-size: 0.82rem;" onclick="event.stopPropagation(); App.playTrack(${offJSON})">▶ Play Official</button>
                                    </div>
                                ` : ''}

                                ${lofi ? `
                                    <div class="version-box" style="box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0; overflow: hidden; display: flex; align-items: center; gap: 14px;" onclick="App.playTrack(${lofiJSON})">
                                        <img src="${lofi.artwork_url || '/static/images/default-cover.png'}" class="version-box-img" style="flex-shrink: 0; width: 64px; height: 64px; object-fit: cover; border-radius: 8px;" alt="Lo-Fi"/>
                                        <div class="version-box-info" style="flex: 1 1 0%; min-width: 0; width: 0; overflow: hidden;">
                                            <span class="badge" style="background: rgba(245, 158, 11, 0.25); color: var(--accent-amber); font-size: 0.72rem; padding: 2px 8px; display: inline-block;">☕ Lo-Fi Chill Version</span>
                                            <div style="font-weight: 700; font-size: 0.95rem; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${lofi.title}">${lofi.title}</div>
                                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${lofi.artist_name}">${lofi.artist_name}</div>
                                        </div>
                                        <button class="btn-primary version-box-btn" style="background: var(--accent-amber); color: #12121c; flex-shrink: 0; white-space: nowrap; padding: 8px 18px; font-size: 0.82rem;" onclick="event.stopPropagation(); App.playTrack(${lofiJSON})">▶ Play Lo-Fi</button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }
            }).catch(() => {});

            // 2. Fetch full search results
            API.search(query).then(res => {
                const resultsEl = document.getElementById('search-results-container');
                const correctionEl = document.getElementById('search-spell-correction');
                if (!resultsEl) return;

                if (res.correction && correctionEl) {
                    correctionEl.innerHTML = `✨ Showing results for <strong>${res.correction}</strong> (auto-corrected from "${query}")`;
                }

                State.set('lastSearchResults', res.results || []);

                if (res.results && res.results.length > 0) {
                    resultsEl.innerHTML = `
                        <div class="grid-cards" id="search-grid-cards">
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

    filterSearchResults(filter) {
        document.querySelectorAll('.search-version-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });

        const allTracks = State.get('lastSearchResults') || [];
        const grid = document.getElementById('search-grid-cards');
        if (!grid) return;

        let filtered = allTracks;
        if (filter === 'official') {
            filtered = allTracks.filter(t => t.version_type !== 'lofi' && !/lofi|lo-fi|slowed|reverb/i.test(t.title));
        } else if (filter === 'lofi') {
            filtered = allTracks.filter(t => t.version_type === 'lofi' || /lofi|lo-fi|slowed|reverb/i.test(t.title));
        }

        if (filtered.length > 0) {
            grid.innerHTML = filtered.map(t => this.createMusicCardHTML(t)).join('');
        } else {
            grid.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">No ${filter} versions found in current results.</div>`;
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
                <div style="display: flex; gap: 10px;">
                    <button class="btn-secondary" onclick="App.openJoinJamModal()">🔑 Join with Code / ID</button>
                    <button class="btn-primary" onclick="App.openCreateJamModal()">+ Host a Jam</button>
                </div>
            </div>

            <!-- Join by Code Banner -->
            <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(22, 21, 35, 0.9) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: var(--radius-lg); padding: 22px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
                <div>
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 4px;">Have a 4-Digit Join Code?</h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem;">Enter the host's 4-digit code to instantly join their listening room before it expires.</p>
                </div>
                <button class="btn-primary" style="padding: 8px 20px; font-size: 0.88rem;" onclick="App.openJoinJamModal()">Enter 4-Digit Code</button>
            </div>

            <h2 class="section-title" style="font-size: 1.15rem; margin-bottom: 16px;">Active Listening Parties</h2>
            <div class="grid-cards" id="jams-page-grid">
                <div style="color: var(--text-muted); padding: 20px;">Fetching active rooms...</div>
            </div>
        `;

        API.getJams().then(res => {
            const grid = document.getElementById('jams-page-grid');
            if (!grid) return;
            const currentUser = State.get('user');
            if (res.jams && res.jams.length > 0) {
                grid.innerHTML = res.jams.map(j => {
                    const isMyRoom = currentUser && (j.host_id === currentUser.id);
                    return `
                    <div class="music-card" onclick="App.enterJamRoom('${j.id}')">
                        <div class="music-card-cover-wrapper">
                            <img src="${j.cover_url || '/static/images/default-jam.png'}" class="music-card-cover" alt="${j.name}"/>
                            <span class="version-badge official-badge" style="top: 8px; left: 8px;">🔑 ${j.join_code ? j.join_code : 'Open'}</span>
                            ${isMyRoom ? '<span class="version-badge" style="top: 8px; right: 8px; background: rgba(245, 158, 11, 0.9); color: #000; font-weight: 700;">👑 Your Room</span>' : ''}
                            <div class="music-card-play-overlay">
                                <div class="play-circle-btn">
                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                            </div>
                        </div>
                        <div class="music-card-title truncate">${j.name}</div>
                        <div class="music-card-subtitle truncate">Host: ${isMyRoom ? 'You' : j.host_name} • ${j.participant_count} listening</div>
                        <div style="font-size: 0.72rem; color: #10b981; margin-top: 4px;">● Active until ended by ${isMyRoom ? 'you' : 'host'}</div>
                    </div>
                `;
                }).join('');
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

    // Render Jam Room Live Detail View (Synchronized Playback & 4-Digit Code)
    renderJamRoom(data) {
        const container = document.getElementById('main-content');
        const room = data.room;
        const isHost = data.is_host;
        const currentTrack = data.current_track;
        const participants = data.participants || [];
        const isExpired = data.is_code_expired;
        const remSec = data.remaining_seconds || 0;

        const safeName = (room.name || '').replace(/'/g, "\\'");

        container.innerHTML = `
            <div class="section-header">
                <div>
                    <span class="badge" style="background: rgba(139, 92, 246, 0.25); color: var(--primary);">
                        ${isHost ? '👑 You are the Jam Host' : '🎧 Joined as Listener'}
                    </span>
                    <h1 class="section-title" style="font-size: 2rem; margin-top: 6px;">${room.name}</h1>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 4px;">
                        ${room.description || 'Synchronized music jam party'}
                        <span style="display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; color: #10b981; font-weight: 600; font-size: 0.8rem; background: rgba(16, 185, 129, 0.12); padding: 2px 8px; border-radius: 999px;">
                            ● Active until ended by ${isHost ? 'you (Owner)' : 'Owner'}
                        </span>
                    </p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    ${isHost ? `
                        <button class="btn-secondary" onclick="App.leaveCurrentJam('${room.id}', true)">← Step Out (Keep Active)</button>
                        <button class="btn-primary" style="background: var(--accent-rose, #f43f5e); border: none; padding: 8px 16px;" onclick="App.endCurrentJam('${room.id}', '${safeName}')">⛔ End Jam</button>
                    ` : `
                        <button class="btn-secondary" onclick="App.leaveCurrentJam('${room.id}', false)">← Leave Jam</button>
                    `}
                </div>
            </div>

            <!-- 4-Digit Join Code Box with Live Countdown & Room Persistence Info -->
            <div class="jam-code-box">
                <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 4px;">
                        Room ID: <strong style="color: var(--text-primary);">${room.id}</strong> (Permanent ID)
                    </div>
                    <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                        <div>
                            <span style="font-size: 0.82rem; color: var(--text-secondary);">4-Digit Join Code:</span>
                            <div class="jam-code-digits" id="jam-room-code-display">${room.join_code || '----'}</div>
                        </div>
                        <div>
                            <div id="jam-code-timer-badge" class="jam-timer-badge ${isExpired ? 'expired' : ''}">
                                ${isExpired ? '⚠️ Code Expired (10 min passed)' : `⏱ Expires in: <span id="jam-countdown-text">${UI.formatTime(remSec)}</span>`}
                            </div>
                            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
                                Codes expire every 10 min for security • Room stays alive until ended by owner
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Host Settings & Regeneration -->
                ${isHost ? `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button class="btn-primary" style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);" onclick="App.regenerateJamCode('${room.id}')">
                            🔄 Generate New 4-Digit Code
                        </button>
                        <button class="btn-secondary" style="border-color: rgba(244, 63, 94, 0.4); color: var(--accent-rose, #f43f5e); font-size: 0.78rem; padding: 5px 10px;" onclick="App.endCurrentJam('${room.id}', '${safeName}')">
                            ⛔ Close / End Room
                        </button>
                        <span style="font-size: 0.72rem; color: var(--text-muted); text-align: center;">Jam Settings • Host Control</span>
                    </div>
                ` : `
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        ${isExpired ? 'The 4-digit code expired, but the room is still running! Ask host for a fresh code.' : 'Share this 4-digit code with friends to let them join.'}
                    </div>
                `}
            </div>

            <!-- Jam Room Workspace -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                <!-- Left: Now Playing in Jam -->
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 24px;">
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 16px;">Now Playing in Jam</h3>
                    ${currentTrack ? `
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <img src="${currentTrack.artwork_url || '/static/images/default-cover.png'}" style="width: 100px; height: 100px; border-radius: var(--radius-md); object-fit: cover;" />
                            <div style="flex: 1; min-width: 0;">
                                <h4 style="font-size: 1.2rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentTrack.title}</h4>
                                <p style="color: var(--text-secondary); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentTrack.artist_name}</p>
                                <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; margin-top: 8px; display: inline-flex; align-items: center; gap: 6px;">
                                    <span class="status-indicator-dot"></span> Live Synchronized with Host
                                </span>
                                <div style="display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap;">
                                    ${isHost ? `
                                        <button class="btn-primary" style="padding: 7px 16px; font-size: 0.85rem;" onclick="App.navigateTo('search')">🔍 Change Song</button>
                                    ` : `
                                        <button class="btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 7px 18px; font-size: 0.85rem;" onclick="App.syncWithHostNow()">▶ Listen in Sync with Host</button>
                                    `}
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div style="padding: 30px; text-align: center; color: var(--text-secondary);">
                            No track is playing right now.
                            ${isHost ? `
                                <p style="margin-top: 12px;">
                                    <button class="btn-primary" onclick="App.navigateTo('search')">Search & Play Song for Everyone</button>
                                </p>
                            ` : `
                                <p style="margin-top: 10px; color: var(--text-muted); font-size: 0.88rem;">
                                    Waiting for the host to pick a song... Audio will start automatically in sync!
                                </p>
                            `}
                        </div>
                    `}
                </div>

                <!-- Right: Active Listeners -->
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 24px;">
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 16px;">Listeners (${participants.length})</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${participants.map(p => `
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="user-avatar-sm" style="width: 32px; height: 32px; font-size: 0.8rem;">
                                    ${p.username ? p.username.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <span style="font-size: 0.88rem; font-weight: 600;">${p.display_name || p.username}</span>
                                ${p.is_host ? '<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: var(--accent-amber); font-size: 0.65rem; margin-left: auto;">👑 Host</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        App.startJamCountdown(remSec, isHost, room.id);
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
