import re
from typing import Dict, Any, Tuple

# Canonical database of popular artists & their common phonetic misspellings/transliterations
ARTIST_CORRECTIONS = {
    "arijit sing": "Arijit Singh",
    "arjit singh": "Arijit Singh",
    "arjeet singh": "Arijit Singh",
    "arijeet singh": "Arijit Singh",
    "arijit": "Arijit Singh",
    "sidhu musawala": "Sidhu Moosewala",
    "sidhu mossewala": "Sidhu Moosewala",
    "sidhu moose wala": "Sidhu Moosewala",
    "moosewala": "Sidhu Moosewala",
    "diljit dosanj": "Diljit Dosanjh",
    "diljeet dosanjh": "Diljit Dosanjh",
    "diljit": "Diljit Dosanjh",
    "karan ojla": "Karan Aujla",
    "karan aujila": "Karan Aujla",
    "aujla": "Karan Aujla",
    "shreya ghosal": "Shreya Ghoshal",
    "shreya gosal": "Shreya Ghoshal",
    "pritam da": "Pritam",
    "pritom": "Pritam",
    "ateef aslam": "Atif Aslam",
    "atif": "Atif Aslam",
    "kishore kumaar": "Kishore Kumar",
    "kishor kumar": "Kishore Kumar",
    "kishore": "Kishore Kumar",
    "mohd rafi": "Mohammed Rafi",
    "mohammad rafi": "Mohammed Rafi",
    "rafi": "Mohammed Rafi",
    "lata mangeshkar": "Lata Mangeshkar",
    "lata": "Lata Mangeshkar",
    "tylor swift": "Taylor Swift",
    "tayler swift": "Taylor Swift",
    "taylor": "Taylor Swift",
    "ed sheran": "Ed Sheeran",
    "the weekend": "The Weeknd",
    "weeknd": "The Weeknd",
    "bilie eilish": "Billie Eilish",
    "billie elish": "Billie Eilish",
    "ap dhilon": "AP Dhillon",
    "ap dhillon": "AP Dhillon",
    "shubh": "Shubh",
    "badshah": "Badshah",
    "yo yo honey singh": "Honey Singh",
    "honey sing": "Honey Singh"
}

# Common transliterated song title typos and phonetic corrections
SONG_CORRECTIONS = {
    "keshariya": "Kesariya",
    "kesariyaa": "Kesariya",
    "kesriya": "Kesariya",
    "kahani sunoo": "Kahani Suno",
    "khani suno": "Kahani Suno",
    "apna bna le": "Apna Bana Le",
    "apna bana le piya": "Apna Bana Le",
    "tum hi hooo": "Tum Hi Ho",
    "pasuri": "Pasoori",
    "pasoori nu": "Pasoori",
    "chana mereya": "Channa Mereya",
    "chanan mereya": "Channa Mereya",
    "rata lambiya": "Raataan Lambiyan",
    "raatan lambiyan": "Raataan Lambiyan",
    "kalnk": "Kalank",
    "tera ban jaunga": "Tera Ban Jaunga",
    "tere vaste": "Tere Vaaste",
    "tere vaaste falak se": "Tere Vaaste",
    "dil diyan gallan karange": "Dil Diyan Gallan",
    "shayad kabhi na keh saku": "Shayad",
    "o maahi": "O Maahi",
    "pehle bhi main": "Pehle Bhi Main",
    "saari duniya jalaa denge": "Saari Duniya Jalaa Denge",
    "arjan vailly": "Arjan Vailly",
    "softly ikky": "Softly",
    "cheques": "Cheques",
    "with you": "With You",
    "starboy": "Starboy",
    "shape of you": "Shape of You",
    "blinding lights": "Blinding Lights",
    "stay justin bieber": "Stay"
}

TITLE_JUNK_REGEX = re.compile(
    r'(\(.*?video.*?\)|\[.*?video.*?\]|\(.*?audio.*?\)|\[.*?audio.*?\]|\(.*?lyrics.*?\)|\[.*?lyrics.*?\]|\(.*?4k.*?\)|\[.*?4k.*?\]|\(.*?hd.*?\)|\[.*?hd.*?\]|\(.*?visualizer.*?\)|\[.*?visualizer.*?\]|\(.*?out now.*?\)|\[.*?out now.*?\]|\b(full song|official video|official audio|lyrical video|audio song|video song|4k|hd|ultra hd|1080p)\b)',
    re.IGNORECASE
)

def normalize_search_query(raw_query: str) -> Dict[str, Any]:
    """
    Normalizes typos, Hinglish transliterations, and lyric phrases into
    clean canonical song titles and artists.
    """
    q = raw_query.strip()
    if not q:
        return {'original': '', 'normalized': '', 'was_corrected': False}

    q_lower = q.lower()

    # 1. Exact song corrections
    for typo, canonical in SONG_CORRECTIONS.items():
        if typo in q_lower:
            return {
                'original': q,
                'normalized': canonical,
                'was_corrected': canonical.lower() != q_lower,
                'type': 'song'
            }

    # 2. Artist corrections
    for typo, canonical in ARTIST_CORRECTIONS.items():
        if typo in q_lower:
            corrected = re.sub(re.escape(typo), canonical, q_lower, flags=re.IGNORECASE)
            return {
                'original': q,
                'normalized': corrected.title(),
                'was_corrected': True,
                'type': 'artist'
            }

    # 3. Phonetic vowel deduplication (e.g. "soooong" -> "song", "loooove" -> "love")
    deduped = re.sub(r'([a-zA-Z])\1{2,}', r'\1', q)

    return {
        'original': q,
        'normalized': deduped,
        'was_corrected': deduped.lower() != q.lower(),
        'type': 'clean'
    }

def clean_title(title: str) -> str:
    """Strip clutter (4K, Official Video, Lyric Video, etc.) from title."""
    cleaned = TITLE_JUNK_REGEX.sub('', title)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned or title

def clean_artist(channel_name: str) -> str:
    """Strip channel artifacts like '- Topic', 'VEVO', 'Official'."""
    name = re.sub(r'\s*-\s*Topic\b', '', channel_name, flags=re.IGNORECASE)
    name = re.sub(r'\b(VEVO|Official Channel|Music India)\b', '', name, flags=re.IGNORECASE)
    return name.strip() or channel_name
