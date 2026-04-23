import re
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_vader = SentimentIntensityAnalyzer()

URGENCY_KEYWORDS = [
    'refund', 'broken', 'not working', 'doesnt work', "doesn't work",
    'cancel', 'cancelled', 'outage', 'down', 'offline', 'urgent',
    'asap', 'immediately', 'emergency', 'critical', 'help',
    'terrible', 'awful', 'horrible', 'useless', 'worst',
    'unacceptable', 'disgusting', 'furious', 'angry', 'frustrated',
    'disappointed', 'scam', 'fraud', 'lie', 'lied', 'stolen',
    'charge', 'overcharged', 'wrong charge', 'double charged',
    'never received', 'never arrived', 'missing', 'lost'
]

TIME_PRESSURE_KEYWORDS = [
    'still', 'days', 'weeks', 'hours', 'since', 'already',
    'waiting', 'waited', 'no response', 'no reply', 'ignored'
]

# Order must match the order used when training the model
FEATURE_COLS = [
    'has_urgency_kw',
    'exclamation_count',
    'has_time_pressure',
    'char_count',
    'sentiment_neg',
    'question_mark_count',
    'caps_ratio',
    'word_count',
    'has_help',
    'all_caps_words'
]


def engineer_features(text: str) -> dict:
    """Extract the 10 features exactly as in the notebook."""
    if not isinstance(text, str):
        text = ''

    text_lower = text.lower()
    words = text.split()
    letters = [c for c in text if c.isalpha()]
    caps_letters = [c for c in letters if c.isupper()]
    sentiment = _vader.polarity_scores(text)

    return {
        'has_urgency_kw':      int(any(kw in text_lower for kw in URGENCY_KEYWORDS)),
        'exclamation_count':   text.count('!'),
        'has_time_pressure':   int(any(kw in text_lower for kw in TIME_PRESSURE_KEYWORDS)),
        'char_count':          len(text),
        'sentiment_neg':       sentiment['neg'],
        'question_mark_count': text.count('?'),
        'caps_ratio':          len(caps_letters) / max(len(letters), 1),
        'word_count':          len(words),
        'has_help':            int('help' in text_lower),
        'all_caps_words':      sum(1 for w in words if w.isupper() and len(w) > 1),
    }