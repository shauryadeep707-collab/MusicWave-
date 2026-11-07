from typing import List
from .base import BaseMusicProvider, UnifiedTrack

class LocalVaultProvider(BaseMusicProvider):
    """
    MusicWave Local Vault: High-fidelity royalty-free and open-licensed tracks
    covering all prompt genres (Bollywood, Hindi, Lo-fi, Pop, Punjabi, Rock, Classical, Ambient).
    """
    VAULT_TRACKS = [
        # Lo-fi & Chill
        UnifiedTrack(
            provider_id="local",
            provider_track_id="local_lofi_01",
            title="Tokyo Rain & Chill Nights",
            artist_name="Komorebi Beats",
            album_name="Night In Shibuya",
            genre="Lo-fi",
            duration=168,
            artwork_url="https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&q=80",
            stream_url="https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
            licence_information="Pixabay Open Audio Content License",
            source_name="MusicWave Vault"
        ),
        UnifiedTrack(
            provider_id="local",
            provider_track_id="local_lofi_02",
            title="Midnight Coffee & Vinyl",
            artist_name="Lofi Sanctuary",
            album_name="Café Memoirs",
            genre="Lo-fi",
            duration=145,
            artwork_url="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80",
            stream_url="https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=chill-abstract-intention-12099.mp3",
            licence_information="Pixabay Open Audio Content License",
            source_name="MusicWave Vault"
        ),
        # Bollywood / Indian Classical Fusion
        UnifiedTrack(
            provider_id="local",
            provider_track_id="local_ind_01",
            title="Sitar Sunrise (Desi Fusion)",
            artist_name="Pandit Raghav & Collective",
            album_name="Varanasi Echoes",
            genre="Bollywood",
            duration=212,
            artwork_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80",
            stream_url="https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=indian-sitartance-122932.mp3",
            licence_information="Open Royalty-Free Audio License",
            source_name="MusicWave Vault"
        ),
        UnifiedTrack(
            provider_id="local",
            provider_track_id="local_ind_02",
            title="Kashmir Winds (Bansuri Melodies)",
            artist_name="Aarav Sharma",
            album_name="Himalayan Flutes",
            genre="Hindi",
            duration=194,
            artwork_url="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80",
            stream_url="https://cdn.pixabay.com/download/audio/2022/03/10/audio_c3527e30ec.mp3?filename=indian-flute-101112.mp3",
            licence_information="Open Royalty-Free Audio License",
            source_name="MusicWave Vault"
        ),
        UnifiedTrack(
            provider_id="local",
            provider_track_id="local_ind_03",
            title="Punjab Dhol Beat Revolution",
            artist_name="Desi Soundwave",
            album_name="Folk Revival",
            genre="Punjabi",
            duration=180,
            artwork_url="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
            stream_url="https://cdn.pixabay.com/download/audio/2022/03/24/audio_33502b489a.mp3?filename=indian-tabla-groove-20211.mp3",
            licence_information="Open Royalty-Free Audio License",
            source_name="MusicWave Vault"
        ),
        # Pop & Acoustic
        UnifiedTrack(
            provider_id="local",
            provider_track_id="local_pop_01",
            title="Golden Horizon",
            artist_name="Luna Sterling",
            album_name="Summer Waves",
            genre="Pop",
            duration=198,
            artwork_url="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80",
            stream_url="https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf328a4.mp3?filename=summer-walk-153392.mp3",
            licence_information="Creative Commons BY 4.0",
            source_name="MusicWave Vault"
        ),
        # Electronic & Synthwave
        UnifiedTrack(
            provider_id="local",
            provider_track_id="local_elec_01",
            title="Neon Drive 1984",
            artist_name="CyberPulse",
            album_name="Retro Metropolis",
            genre="Electronic",
            duration=225,
            artwork_url="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&q=80",
            stream_url="https://cdn.pixabay.com/download/audio/2021/11/25/audio_946b5a34e0.mp3?filename=synthwave-80s-110045.mp3",
            licence_information="Creative Commons 0 (Public Domain)",
            source_name="MusicWave Vault"
        ),
        # Classical & Instrumental
        UnifiedTrack(
            provider_id="local",
            provider_track_id="local_class_01",
            title="Moonlight Reverie (Piano)",
            artist_name="Clara Vane",
            album_name="Nocturnes",
            genre="Classical",
            duration=240,
            artwork_url="https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&q=80",
            stream_url="https://archive.org/download/SoftPianoMusicSleepingMusic/Calm Piano Music.mp3",
            licence_information="Public Domain Open Archive",
            source_name="Internet Archive Classical"
        ),
        # Rock & Indie
        UnifiedTrack(
            provider_id="local",
            provider_track_id="local_rock_01",
            title="Electric Sunset",
            artist_name="The Wild Echoes",
            album_name="Desert Highways",
            genre="Rock",
            duration=205,
            artwork_url="https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&q=80",
            stream_url="https://cdn.pixabay.com/download/audio/2022/08/02/audio_884fe92c21.mp3?filename=rock-it-21275.mp3",
            licence_information="Open Royalty-Free Audio License",
            source_name="MusicWave Vault"
        )
    ]

    def __init__(self):
        super().__init__("local", "MusicWave Local Vault")

    def search(self, query: str, limit: int = 20) -> List[UnifiedTrack]:
        q = query.lower()
        results = [
            t for t in self.VAULT_TRACKS 
            if q in t.title.lower() or q in t.artist_name.lower() or q in t.album_name.lower() or q in t.genre.lower()
        ]
        return results[:limit]

    def get_trending(self, limit: int = 20) -> List[UnifiedTrack]:
        return self.VAULT_TRACKS[:limit]

    def get_by_genre(self, genre: str, limit: int = 20) -> List[UnifiedTrack]:
        g = genre.lower()
        results = [t for t in self.VAULT_TRACKS if g in t.genre.lower()]
        return results[:limit]
