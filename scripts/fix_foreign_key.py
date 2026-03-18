import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

def run():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT", "5432"),
            dbname=os.getenv("DB_NAME", "postgres"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASS"),
            sslmode="require"
        )
        with conn.cursor() as cur:
            # 1. Ver colunas de motivo_chargeback
            print("--- Colunas de motivo_chargeback ---")
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'motivo_chargeback';")
            cols = [c[0] for c in cur.fetchall()]
            print(cols)

            # 2. Tentar inserir um motivo FRD se não existir
            if 'codigo_motivo' in cols and 'descricao_motivo' in cols and 'tipo_chargeback' in cols:
                print("Inserindo motivo FRD com todas as colunas...")
                cur.execute("INSERT INTO motivo_chargeback (codigo_motivo, descricao_motivo, tipo_chargeback) VALUES ('FRD', 'Fraude', 'Fraude') ON CONFLICT (codigo_motivo) DO NOTHING;")
            elif 'codigo_motivo' in cols and 'descricao_motivo' in cols:
                print("Inserindo apenas codigo_motivo FRD...")
                cur.execute("INSERT INTO motivo_chargeback (codigo_motivo) VALUES ('FRD') ON CONFLICT DO NOTHING;")
            
            conn.commit()
            print("Sucesso!")
        conn.close()
    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    run()
