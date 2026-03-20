import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT", "5432"),
    dbname=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASS")
)
cur = conn.cursor()

cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'chargeback'
    ORDER BY ordinal_position;
""")
cols = cur.fetchall()
for col in cols:
    print(f"Column: {col[0]}, Type: {col[1]}, Nullable: {col[2]}")

cur.close()
conn.close()
