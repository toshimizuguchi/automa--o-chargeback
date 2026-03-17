import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")

try:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        sslmode="require"
    )
    with conn.cursor() as cur:
        # Check chargebacks_pagarme
        print("--- chargebacks_pagarme ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chargebacks_pagarme';")
        for column in cur.fetchall():
            print(f"- {column[0]} ({column[1]})")
            
    conn.close()
except Exception as e:
    print(f"Erro: {e}")
