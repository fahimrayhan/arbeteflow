"""Clean up search terms before they are embedded.

Ads are written in Swedish, but people type English job titles, abbreviations, or
Swedish without å/ä/ö. Three fixes, all additive so the user's own words are never lost:

- whitespace / punctuation / unicode clean-up,
- Swedish spelling restored for ASCII-typed titles ("sjukskoterska" -> "sjuksköterska"),
- the Swedish equivalent of common English titles appended ("waiter" -> "waiter servitör").

Only short, title-like queries are expanded. CV text just gets the clean-up.
"""

import re
import unicodedata
from typing import Dict, Iterable, List

from config import DEFAULT_SEED_QUERIES

# Longer inputs are descriptions or CVs, not job titles: never expand those.
MAX_EXPANDED_WORDS = 8
MAX_ADDED_TERMS = 3

# English title (lower case) -> Swedish ad terms. Multi-word keys are matched as phrases.
ENGLISH_TO_SWEDISH: Dict[str, List[str]] = {
    # IT
    "developer": ["utvecklare"],
    "software developer": ["mjukvaruutvecklare"],
    "software engineer": ["mjukvaruutvecklare", "systemutvecklare"],
    "web developer": ["webbutvecklare"],
    "programmer": ["programmerare"],
    "system administrator": ["systemadministratör"],
    "sysadmin": ["systemadministratör"],
    "network engineer": ["nätverkstekniker"],
    "it support": ["it-support"],
    "helpdesk": ["it-support"],
    "tester": ["testare"],
    "qa engineer": ["testare"],
    "security": ["it-säkerhet"],
    "cybersecurity": ["it-säkerhet"],
    "architect": ["arkitekt"],
    "project manager": ["projektledare"],
    "product owner": ["produktägare"],
    # Healthcare / care
    "nurse": ["sjuksköterska"],
    "registered nurse": ["sjuksköterska"],
    "assistant nurse": ["undersköterska"],
    "nursing assistant": ["undersköterska"],
    "doctor": ["läkare"],
    "physician": ["läkare"],
    "dentist": ["tandläkare"],
    "dental nurse": ["tandsköterska"],
    "physiotherapist": ["fysioterapeut"],
    "physical therapist": ["fysioterapeut"],
    "occupational therapist": ["arbetsterapeut"],
    "psychologist": ["psykolog"],
    "midwife": ["barnmorska"],
    "pharmacist": ["apotekare", "receptarie"],
    "dietitian": ["dietist"],
    "social worker": ["socialsekreterare", "kurator"],
    "care assistant": ["vårdbiträde"],
    "personal assistant": ["personlig assistent"],
    # Education
    "teacher": ["lärare"],
    "preschool teacher": ["förskollärare"],
    "primary school teacher": ["grundskollärare"],
    "high school teacher": ["gymnasielärare"],
    "special education teacher": ["speciallärare", "specialpedagog"],
    "principal": ["rektor"],
    "school assistant": ["elevassistent"],
    "career counselor": ["studie- och yrkesvägledare"],
    # Engineering / construction / manufacturing
    "engineer": ["ingenjör"],
    "mechanical engineer": ["mekanikkonstruktör", "ingenjör"],
    "electrical engineer": ["elkonstruktör", "ingenjör"],
    "designer engineer": ["konstruktör"],
    "carpenter": ["snickare"],
    "electrician": ["elektriker"],
    "plumber": ["rörmokare", "vvs-montör"],
    "painter": ["målare"],
    "bricklayer": ["murare"],
    "construction worker": ["byggarbetare"],
    "site manager": ["platschef"],
    "welder": ["svetsare"],
    "machine operator": ["maskinoperatör"],
    "operator": ["operatör"],
    "assembler": ["montör"],
    "mechanic": ["mekaniker"],
    "car mechanic": ["bilmekaniker", "fordonsmekaniker"],
    "maintenance technician": ["underhållstekniker"],
    "production manager": ["produktionsledare"],
    "buyer": ["inköpare"],
    "purchaser": ["inköpare"],
    # Logistics / transport
    "warehouse worker": ["lagerarbetare"],
    "warehouse": ["lager", "lagerarbetare"],
    "forklift driver": ["truckförare"],
    "truck driver": ["lastbilschaufför"],
    "bus driver": ["buschaufför"],
    "taxi driver": ["taxiförare"],
    "delivery driver": ["budbilsförare", "chaufför"],
    "driver": ["chaufför", "förare"],
    "train driver": ["lokförare"],
    "logistics": ["logistiker"],
    # Retail / sales / service
    "shop assistant": ["butikssäljare"],
    "sales assistant": ["butikssäljare"],
    "retail": ["butik", "butikssäljare"],
    "cashier": ["kassapersonal"],
    "store manager": ["butikschef"],
    "salesperson": ["säljare"],
    "sales representative": ["säljare"],
    "sales": ["säljare"],
    "customer service": ["kundservice", "kundtjänst"],
    "customer support": ["kundservice", "kundtjänst"],
    # Hospitality / cleaning
    "waiter": ["servitör"],
    "waitress": ["servitör"],
    "chef": ["kock"],
    "cook": ["kock"],
    "head chef": ["kökschef"],
    "kitchen assistant": ["restaurangbiträde"],
    "dishwasher": ["diskare"],
    "bartender": ["bartender"],
    "barista": ["barista"],
    "receptionist": ["receptionist"],
    "hotel": ["hotell"],
    "cleaner": ["städare", "lokalvårdare"],
    "janitor": ["fastighetsskötare", "lokalvårdare"],
    # Finance / admin / legal / HR
    "accountant": ["redovisningsekonom", "ekonom"],
    "economist": ["ekonom"],
    "auditor": ["revisor"],
    "payroll": ["lönekonsult"],
    "financial analyst": ["finansanalytiker"],
    "bank advisor": ["bankrådgivare"],
    "administrator": ["administratör"],
    "office administrator": ["administratör"],
    "secretary": ["sekreterare", "assistent"],
    "assistant": ["assistent"],
    "lawyer": ["jurist", "advokat"],
    "attorney": ["advokat"],
    "recruiter": ["rekryterare"],
    "hr": ["hr-specialist"],
    "manager": ["chef"],
    "consultant": ["konsult"],
    "business developer": ["affärsutvecklare"],
    "investigator": ["utredare"],
    # Marketing / media
    "marketing": ["marknadsförare"],
    "marketer": ["marknadsförare"],
    "communicator": ["kommunikatör"],
    "graphic designer": ["grafisk formgivare"],
    "photographer": ["fotograf"],
    "journalist": ["journalist"],
    # Public / safety / agriculture / beauty
    "security guard": ["väktare"],
    "police officer": ["polis"],
    "firefighter": ["brandman"],
    "prison officer": ["kriminalvårdare"],
    "veterinarian": ["veterinär"],
    "vet": ["veterinär"],
    "farm worker": ["lantbruksarbetare"],
    "gardener": ["trädgårdsarbetare"],
    "forestry worker": ["skogsarbetare"],
    "hairdresser": ["frisör"],
    "barber": ["frisör"],
    "beautician": ["hudterapeut"],
    "massage therapist": ["massör"],
    "personal trainer": ["personlig tränare"],
}

# Short forms commonly used in Swedish ads and CVs.
ABBREVIATIONS: Dict[str, List[str]] = {
    "ssk": ["sjuksköterska"],
    "usk": ["undersköterska"],
    "ux": ["ux designer"],
    "pm": ["projektledare"],
    "vvs": ["vvs-montör"],
}

_SPACES = re.compile(r"\s+")
# Quotes, brackets and sentence punctuation only: "c++" / "c#" / ".net" must keep their symbols.
_EDGE_NOISE = re.compile(r"^[\s\"'“”‘’()\[\]{}!?,;:]+|[\s\"'“”‘’()\[\]{}!?.,;:]+$")
_REPEATED_PUNCT = re.compile(r"([!?.,;:])\1+")
_TRANSLATE_ASCII = str.maketrans({"å": "a", "ä": "a", "ö": "o", "é": "e", "ü": "u"})


def _ascii_fold(text: str) -> str:
    return text.casefold().translate(_TRANSLATE_ASCII)


def _build_swedish_spellings(terms: Iterable[str]) -> Dict[str, str]:
    """Folded (å/ä/ö -> a/a/o) -> proper spelling, only for terms that actually contain å/ä/ö."""
    spellings: Dict[str, str] = {}
    for term in terms:
        folded = _ascii_fold(term)
        if folded != term.casefold():
            spellings.setdefault(folded, term)
    return spellings


_SWEDISH_SPELLINGS = _build_swedish_spellings(DEFAULT_SEED_QUERIES)
# Longest first so "specialistsjukskoterska" wins over a shorter prefix.
_SPELLING_PATTERN = re.compile(
    r"(?<![\w-])(" + "|".join(re.escape(k) for k in sorted(_SWEDISH_SPELLINGS, key=len, reverse=True)) + r")(?![\w-])"
)


def _compile_phrases(mapping: Dict[str, List[str]]) -> re.Pattern:
    keys = sorted(mapping, key=len, reverse=True)
    return re.compile(r"(?<![\w-])(" + "|".join(re.escape(k) for k in keys) + r")(?![\w-])")


_ENGLISH_PATTERN = _compile_phrases(ENGLISH_TO_SWEDISH)
_ABBREVIATION_PATTERN = _compile_phrases(ABBREVIATIONS)


def clean_text(text: str) -> str:
    """Unicode-normalise and collapse whitespace/punctuation noise. Keeps the user's wording."""
    text = unicodedata.normalize("NFC", text)
    text = "".join(ch if ch.isprintable() or ch in "\n\t" else " " for ch in text)
    text = _REPEATED_PUNCT.sub(r"\1", text)
    return _SPACES.sub(" ", text).strip()


def normalize_query(text: str) -> str:
    """Clean a short search term and append Swedish equivalents of what was typed."""
    cleaned = clean_text(text)
    if not cleaned:
        return ""

    # Strip quote/punctuation wrapping a title-like query ('"waiter"!' -> 'waiter').
    if len(cleaned.split()) <= MAX_EXPANDED_WORDS:
        cleaned = _EDGE_NOISE.sub("", cleaned) or cleaned
    else:
        return cleaned

    lowered = cleaned.casefold()
    added: List[str] = []

    def add(terms: Iterable[str]) -> None:
        for term in terms:
            if term.casefold() not in lowered and term not in added:
                added.append(term)

    for match in _SPELLING_PATTERN.finditer(_ascii_fold(cleaned)):
        add([_SWEDISH_SPELLINGS[match.group(1)]])
    for match in _ENGLISH_PATTERN.finditer(lowered):
        add(ENGLISH_TO_SWEDISH[match.group(1)])
    for match in _ABBREVIATION_PATTERN.finditer(lowered):
        add(ABBREVIATIONS[match.group(1)])

    if not added:
        return cleaned
    return f"{cleaned} {' '.join(added[:MAX_ADDED_TERMS])}"
