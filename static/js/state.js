/**
 * MusicWave - Reactive Application State
 * Centralized store with subscription listener pattern
 */
const State = {
    data: {
        user: null,
        isOnline: navigator.onLine,
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        repeatMode: 'off', // 'off' | 'all' | 'one'
        shuffle: false,
        queue: [],
        queueIndex: -1,
        activePage: 'home',
        activeJam: null,
        drawerTab: null // 'queue' | 'chat' | null
    },

    listeners: {},

    get(key) {
        return this.data[key];
    },

    set(key, value) {
        const prev = this.data[key];
        this.data[key] = value;
        if (this.listeners[key]) {
            this.listeners[key].forEach(fn => fn(value, prev));
        }
    },

    update(partial) {
        Object.entries(partial).forEach(([key, val]) => this.set(key, val));
    },

    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);
        // Call immediately with current value
        callback(this.data[key], undefined);
        return () => {
            this.listeners[key] = this.listeners[key].filter(fn => fn !== callback);
        };
    }
};

window.State = State;
