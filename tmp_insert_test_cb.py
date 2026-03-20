import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")

def insert_test_data():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS
        )
        cur = conn.cursor()
        
        insert_query = """
        INSERT INTO chargeback (
            empresa_pagadora, 
            codigo_motivo, 
            id_transacao_pagarme, 
            cpf_aluno, 
            nome_aluno, 
            valor, 
            status_processo, 
            data_cadastro
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        RETURNING id_chargeback;
        """
        
        test_values = [
            ("HUB", "FRD", "TXN_SYNC_TEST_001", "12345678901", "VINICIUS TESTE SYNC", 1250.50, "Pendente")
        ]
        
        for val in test_values:
            cur.execute(insert_query, val)
            new_id = cur.fetchone()[0]
            print(f"Inserido novo chargeback com ID: {new_id}")
            
        conn.commit()
        cur.close()
        conn.close()
        print("Dados de teste inseridos com sucesso!")
        
    except Exception as e:
        print(f"Erro ao inserir dados: {e}")

if __name__ == "__main__":
    insert_test_data()
