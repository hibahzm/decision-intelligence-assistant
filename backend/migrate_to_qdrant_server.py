import sqlite3
import pickle
import time
import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from qdrant_client.http.exceptions import ResponseHandlingException

# Load environment variables from .env file
load_dotenv()

# ---------- CONFIGURATION ----------
LOCAL_DB_PATH = "./qdrant_db"          # path to your local qdrant_db folder
COLL_NAME = "support_tickets"
EMBED_DIM = 384
BATCH_SIZE = 100
RETRY_DELAY = 2
REQUEST_TIMEOUT = 60

# Read from environment (or .env)
QDRANT_CLOUD_URL = os.getenv("QDRANT_CLOUD_URL")
QDRANT_API_KEY   = os.getenv("QDRANT_API_KEY")

if not QDRANT_CLOUD_URL or not QDRANT_API_KEY:
    raise ValueError("Missing QDRANT_CLOUD_URL or QDRANT_API_KEY in environment/.env")
# -----------------------------------

# Connect to Qdrant Cloud
client = QdrantClient(
    url=QDRANT_CLOUD_URL,
    api_key=QDRANT_API_KEY,
    timeout=REQUEST_TIMEOUT
)
print(f"Connected to Qdrant Cloud: {QDRANT_CLOUD_URL}")

# Create collection if it doesn't exist
if not client.collection_exists(COLL_NAME):
    client.create_collection(
        collection_name=COLL_NAME,
        vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE)
    )
    print(f"Created collection '{COLL_NAME}'")
else:
    print(f"Collection '{COLL_NAME}' already exists")

# Connect to local SQLite
sqlite_path = f"{LOCAL_DB_PATH}/collections/{COLL_NAME}/storage.sqlite"
conn = sqlite3.connect(sqlite_path)
cursor = conn.cursor()

cursor.execute("SELECT id, point FROM points")
rows = cursor.fetchall()
total = len(rows)
print(f"Found {total} points in local database")

# Upload in batches
uploaded = 0
for i in range(0, total, BATCH_SIZE):
    batch = rows[i:i+BATCH_SIZE]
    points = []
    for _, point_blob in batch:
        point_obj = pickle.loads(point_blob)
        points.append(PointStruct(
            id=point_obj.id,
            vector=point_obj.vector,
            payload=point_obj.payload
        ))
    
    # Upsert with retry
    for attempt in range(3):
        try:
            client.upsert(collection_name=COLL_NAME, points=points)
            uploaded += len(points)
            print(f"Uploaded {uploaded} / {total}")
            break
        except ResponseHandlingException as e:
            print(f"Batch {i//BATCH_SIZE + 1} failed (attempt {attempt+1}): {e}")
            if attempt < 2:
                time.sleep(RETRY_DELAY)
            else:
                print("Skipping batch after 3 failures")
                break

conn.close()
print("Migration complete (with possible skipped batches).")