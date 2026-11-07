import re
import math
from typing import Dict, Any, List, Optional
from backend.database.db import query_db, execute_db, is_postgres
from backend.providers.base import is_single_track, COMPILATION_KEYWORDS

ARTIST_AFFINITY_GRAPH = {
    # Bollywood / Romantic / Melody
    "arijit singh": ["atif aslam", "pritam", "shreya ghoshal", "mohit chauhan", "jubin nautiyal", "sachin-jigar", "vishal mishra", "armaan malik"],
    "atif aslam": ["arijit singh", "pritam", "shreya ghoshal", "rahat fateh ali khan", "mohit chauhan", "mustafa zahid"],
    "shreya ghoshal": ["arijit singh", "sunidhi chauhan", "sonu nigam", "pritam", "shankar mahadevan", "alisha chinai"],
    "pritam": ["arijit singh", "atif aslam", "kk", "mohit chauhan", "sachin-jigar"],
    "kk": ["pritam", "emraan hashmi", "shaan", "lucky ali", "arijit singh"],
    
    # Punjabi / Bhangra / Desi Hip-Hop
    "sidhu moosewala": ["karan aujla", "ap dhillon", "shubh", "diljit dosanjh", "prem dhillon", "amrit maan", "ammy virk"],
    "karan aujla": ["sidhu moosewala", "ap dhillon", "shubh", "diljit dosanjh", "ikky", "deep jandu"],
    "diljit dosanjh": ["sidhu moosewala", "karan aujla", "ammy virk", "badshah", "guru randhawa", "honey singh"],
    "ap dhillon": ["gurinder gill", "shinda kahlon", "shubh", "karan aujla", "sidhu moosewala"],
    "shubh": ["ap dhillon", "karan aujla", "sidhu moosewala", "diljit dosanjh"],
    
    # Retro / Golden Classics
    "kishore kumar": ["mohammed rafi", "mukesh", "lata mangeshkar", "asha bhosle", "rd burman", "manna dey"],
    "mohammed rafi": ["kishore kumar", "mukesh", "lata mangeshkar", "asha bhosle", "talat mahmood"],
    "lata mangeshkar": ["kishore kumar", "mohammed rafi", "mukesh", "asha bhosle", "geeta dutt"],
    "mukesh": ["kishore kumar", "mohammed rafi", "lata mangeshkar", "raj kapoor"],
    
    # Global Pop & Chart Toppers
    "the weeknd": ["drake", "post malone", "bruno mars", "dua lipa", "daft punk", "kendrick lamar"],
    "taylor swift": ["ed sheeran", "billie eilish", "olivia rodrigo", "selena gomez", "ariana grande", "sabrina carpenter"],
    "ed sheeran": ["taylor swift", "shawn mendes", "justin bieber", "charlie puth", "lewis capaldi"],
    "billie eilish": ["finneas", "olivia rodrigo", "lana del rey", "lorde", "taylor swift"]
}

class MusicWaveRecommendationEngine:
    """
    Self-training Recommendation & Song Transition Engine.
    Combines:
    1. Markov Chain Song-to-Song Transition Matrix (learned from real playback)
    2. Artist Affinity Graph & Collab similarity
    3. Mood & Acoustic Genre alignment
    4. Real-time dynamic discovery fallback via live providers
    """

    def __init__(self):
        pass

    def extract_features(self, track: Dict[str, Any]) -> Dict[str, Any]:
        """Extract classification tokens from track title, artist, and genre."""
        title = (track.get('title') or '').lower()
        artist = (track.get('artist_name') or '').lower()
        genre = (track.get('genre') or '').lower()
        combined = f"{title} {artist} {genre}"

        is_bollywood = any(k in combined for k in ['bollywood', 'hindi', 'arijit', 'atif', 'shreya', 'pritam', 'kumar sanu', 'sonu nigam', 'filmi', 't-series', 'zeemusic', 'jubin', 'neha kakkar', 'badshah', 'vishal'])
        is_punjabi = any(k in combined for k in ['punjabi', 'moosewala', 'diljit', 'aujla', 'dhillon', 'shubh', 'bhangra', 'sidhu', 'ammy virk', 'karan'])
        is_hiphop = any(k in combined for k in ['hip-hop', 'hip hop', 'hiphop', 'rap', 'trap', 'emiway', 'raftaar', 'krsna', 'divine', 'mc stan', 'drake', 'eminem'])
        is_retro = any(k in combined for k in ['retro', 'kishore', 'lata', 'rafi', 'mukesh', 'burman', '70s', '80s', '90s', 'purane', 'classic', 'old hindi'])
        is_lofi = any(k in combined for k in ['lofi', 'lo-fi', 'slowed', 'reverb', 'chill', 'study', 'relax', 'chillhop', 'ambient'])
        is_sad = any(k in combined for k in ['sad', 'dard', 'judai', 'heartbreak', 'broken', 'cry', 'emotional', 'slowed', 'alone'])
        is_rock = any(k in combined for k in ['rock', 'metal', 'guitar', 'linkin', 'queen', 'acdc', 'nirvana'])
        is_pop = any(k in combined for k in ['pop', 'swift', 'weeknd', 'sheeran', 'drake', 'billie', 'dua lipa', 'bieber'])

        dominant_genre = 'general'
        if genre and any(g in genre for g in ['bollywood', 'punjabi', 'hip-hop', 'lo-fi', 'pop', 'rock', 'retro', 'sad', 'classical', 'electronic']):
            dominant_genre = genre.strip()
        elif is_bollywood: dominant_genre = 'bollywood'
        elif is_punjabi: dominant_genre = 'punjabi'
        elif is_hiphop: dominant_genre = 'hip-hop'
        elif is_retro: dominant_genre = 'retro'
        elif is_lofi: dominant_genre = 'lo-fi'
        elif is_sad: dominant_genre = 'sad'
        elif is_rock: dominant_genre = 'rock'
        elif is_pop: dominant_genre = 'pop'

        return {
            'dominant_genre': dominant_genre,
            'clean_artist': artist.strip(),
            'is_lofi': is_lofi
        }

    def calculate_similarity(self, current_features: Dict[str, Any], candidate: Dict[str, Any]) -> float:
        """Calculate score [0.0 - 1.0] between current track and a candidate track."""
        cand_features = self.extract_features(candidate)
        score = 0.0

        # 1. Same genre match (Weight: 0.35)
        if current_features['dominant_genre'] == cand_features['dominant_genre']:
            score += 0.35

        # 2. Artist match or Related Artist (Weight: 0.40)
        curr_art = current_features['clean_artist']
        cand_art = cand_features['clean_artist']

        if curr_art and cand_art and (curr_art in cand_art or cand_art in curr_art):
            score += 0.40
        else:
            # Check artist affinity graph
            for key_artist, related in ARTIST_AFFINITY_GRAPH.items():
                if key_artist in curr_art:
                    if any(r in cand_art for r in related):
                        score += 0.30
                        break

        # 3. Lofi / Vibe match (Weight: 0.15)
        if current_features['is_lofi'] == cand_features['is_lofi']:
            score += 0.15

        # 4. Play count popularity boost (Weight: 0.10)
        play_count = candidate.get('play_count', 0) or 0
        popularity_boost = min(0.10, math.log1p(play_count) * 0.02)
        score += popularity_boost

        return score

    def predict_next(
        self,
        current_track: Dict[str, Any],
        user_id: Optional[int] = None,
        exclude_ids: Optional[List[int]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Predicts and recommends the ideal NEXT song to play after current_track finishes.
        """
        if not current_track:
            return None

        current_id = current_track.get('id')
        exclude = set(exclude_ids or [])
        if current_id:
            exclude.add(current_id)

        # Step 1: Check Markov Transition Matrix (Learned user habits)
        if current_id:
            transition_match = query_db("""
                SELECT t.*, st.transition_count
                FROM song_transitions st
                JOIN tracks t ON st.to_track_id = t.id
                WHERE st.from_track_id = ?
                ORDER BY st.transition_count DESC, st.last_transition_at DESC
                LIMIT 5
            """, (current_id,))

            for tm in transition_match:
                if tm['id'] not in exclude and is_single_track(tm.get('title'), tm.get('artist_name'), tm.get('duration', 0)):
                    return tm

        # Step 2: Search local database candidates
        current_features = self.extract_features(current_track)
        curr_artist = current_features['clean_artist']
        pattern_art = f"%{curr_artist}%" if curr_artist else "%"
        pattern_genre = f"%{current_features['dominant_genre']}%"

        db_candidates = query_db("""
            SELECT * FROM tracks
            WHERE artist_name LIKE ? OR genre LIKE ?
            ORDER BY play_count DESC
            LIMIT 25
        """, (pattern_art, pattern_genre))

        valid_db_candidates = [
            c for c in db_candidates
            if c['id'] not in exclude and is_single_track(c.get('title'), c.get('artist_name'), c.get('duration', 0))
        ]

        if valid_db_candidates:
            scored = []
            for c in valid_db_candidates:
                sim = self.calculate_similarity(current_features, c)
                scored.append((sim, c))
            scored.sort(key=lambda x: x[0], reverse=True)
            if scored and scored[0][0] >= 0.35:
                return scored[0][1]

        # Step 3: Dynamic Live Discovery via YouTube Provider
        # Query siblings based on current artist and dominant genre
        from backend.providers import music_service
        yt_provider = music_service.providers.get('youtube')

        # Prevent searching for record labels or compilation creators as artists
        label_names = ['saregama', 't-series', 'tseries', 'zee music', 'speed records', 'tips official', 'tips', 'sony music', 'yrf', 'eros now', 'venus']
        is_label = any(lbl in curr_artist.lower() for lbl in label_names)
        dominant_genre = current_features['dominant_genre']

        if is_label or not curr_artist:
            genre_seeds = {
                'retro': 'Kishore Kumar',
                'bollywood': 'Arijit Singh',
                'punjabi': 'Diljit Dosanjh',
                'lo-fi': 'Romantic Hindi Lofi',
                'hip-hop': 'Divine',
                'pop': 'The Weeknd',
                'rock': 'Linkin Park',
                'sad': 'Arijit Singh',
                'classical': 'Ustad Zakir Hussain'
            }
            artist_seed = genre_seeds.get(dominant_genre, 'Arijit Singh')
            discovery_query = f"{artist_seed} {dominant_genre} official audio single song"
        else:
            discovery_query = f"{curr_artist} {dominant_genre} official audio single song"

        discovered_tracks = []
        if yt_provider:
            try:
                discovered_tracks = yt_provider.search(discovery_query, limit=10)
            except Exception as e:
                print(f"[Recommendation Discovery error]: {e}")

        if not discovered_tracks:
            discovered_tracks = music_service.search(discovery_query, limit=10)

        # Filter and score discovered tracks - STRICT single song enforcement
        candidate_dicts = []
        for dt in discovered_tracks:
            d = dt.to_dict() if hasattr(dt, 'to_dict') else dt
            # Avoid repeating current track ID or provider track ID
            if d.get('provider_track_id') == current_track.get('provider_track_id'):
                continue
            if d.get('title', '').lower() == current_track.get('title', '').lower():
                continue
            # Strictly reject any multi-hour mixes, jukeboxes, or podcasts
            if not is_single_track(d.get('title'), d.get('artist_name'), d.get('duration', 0)):
                continue
            sim = self.calculate_similarity(current_features, d)
            candidate_dicts.append((sim, d))

        candidate_dicts.sort(key=lambda x: x[0], reverse=True)

        if candidate_dicts:
            best_track = candidate_dicts[0][1]
            # Persist selected track into DB so it has an internal id for future recommendations
            persisted = music_service._persist_tracks([best_track])
            return persisted[0] if persisted else best_track

        # Fallback to general trending (strictly verified single songs)
        trending = music_service.get_trending(limit=8)
        for tr in trending:
            if tr.get('id') not in exclude and tr.get('title') != current_track.get('title'):
                if is_single_track(tr.get('title'), tr.get('artist_name'), tr.get('duration', 0)):
                    return tr

        return None

    def train_transition(self, from_track_id: int, to_track_id: int, user_id: Optional[int] = None):
        """
        Train the Markov transition matrix and update user taste profiles when a song transitions.
        """
        if not from_track_id or not to_track_id or from_track_id == to_track_id:
            return

        is_pg = is_postgres()
        try:
            if is_pg:
                execute_db("""
                    INSERT INTO song_transitions (from_track_id, to_track_id, transition_count, last_transition_at)
                    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT (from_track_id, to_track_id)
                    DO UPDATE SET transition_count = song_transitions.transition_count + 1, last_transition_at = CURRENT_TIMESTAMP
                    RETURNING from_track_id
                """, (from_track_id, to_track_id))
            else:
                execute_db("""
                    INSERT INTO song_transitions (from_track_id, to_track_id, transition_count, last_transition_at)
                    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(from_track_id, to_track_id)
                    DO UPDATE SET transition_count = transition_count + 1, last_transition_at = CURRENT_TIMESTAMP
                """, (from_track_id, to_track_id))

            # Record in listening history if user_id is present
            if user_id:
                execute_db("""
                    INSERT INTO listening_history (user_id, track_id, completed)
                    VALUES (?, ?, 1)
                """, (user_id, from_track_id))

        except Exception as e:
            print(f"[Recommendation Training Notice]: {e}")

# Global instance
recommendation_engine = MusicWaveRecommendationEngine()
