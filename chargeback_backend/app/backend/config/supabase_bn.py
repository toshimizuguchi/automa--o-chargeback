import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import os

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

# Substitua pelos valores do seu projeto Supabase via .env
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres") # Nome PADRÃO é sempre postgres
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASS")


try:
    print(f"Tentando conectar ao host: {DB_HOST} na porta {DB_PORT}...")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode="require"
    )

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT now() as now;")
            resultado = cur.fetchone()
            print("✅ Sucesso! Conectado ao banco.")
            print("Hora atual no banco:", resultado['now'])
    
    conn.close()

except Exception as e:
    print(f"❌ Falha ao conectar: {e}")
    print("\nDica: Verifique se a senha e o host no .env estão corretos (veja o painel do Supabase).")
