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

cur.execute("SELECT id_chargeback, nome_aluno, valor, data_cadastro FROM chargeback ORDER BY data_cadastro DESC LIMIT 5;")
rows = cur.fetchall()
for row in rows:
    print(row)

cur.close()
conn.close()
