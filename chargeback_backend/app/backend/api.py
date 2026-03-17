from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.supabase_bn import conn
import psycopg2.extras

app = FastAPI()

# Permite que o seu frontend (que roda no 127.0.0.1:8080) acesse esta API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/chargebacks")
def get_chargebacks():
    try:
        # Reabre a conexão se ela tiver sido fechada por timeout
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Query para buscar os dados da sua tabela original
            # Mapeamos as colunas do banco para os nomes que o seu frontend (app.js) espera
            sql = """
                SELECT 
                    id_chargeback as db_id,
                    id_transacao_pagarme as id_txn,
                    motivo_informado as motivo,
                    valor,
                    status_processo as status,
                    empresa_pagadora as cliente_nome,
                    data_cadastro as data
                FROM chargeback
                ORDER BY data_cadastro DESC
            """
            cur.execute(sql)
            results = cur.fetchall()
            
            # Formata os dados para o padrão que o app.js entende
            formatted_data = []
            for row in results:
                formatted_data.append({
                    "id": f"CB-{row['db_id']}",
                    "cliente": { "nome": row['cliente_nome'], "email": "contato@empresa.com" },
                    "transacao": { "id": row['id_txn'], "valor": float(row['valor']), "bandeira": "visa" },
                    "motivo": row['motivo'],
                    "status": "recebido", # Você pode mapear o status do banco aqui
                    "dataRecebimento": row['data'].isoformat() if row['data'] else None,
                    "prazo": None
                })
            
            return formatted_data
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
