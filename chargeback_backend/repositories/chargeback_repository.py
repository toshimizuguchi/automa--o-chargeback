from config.supabase_bn import conn  # Importa a conexão que configuramos

def salvar(chargeback):
    """
    Persiste um objeto Chargeback na tabela 'chargeback' do Supabase.
    Mapeia os campos do objeto para as colunas SQL esperadas.
    """
    print(f"Salvando no banco real: {chargeback.tipo} - R$ {chargeback.valor}")
    
    try:
        # Abre um cursor para executar comandos SQL
        with conn.cursor() as cur:
            # Preenchendo todos as colunas obrigatórias (NOT NULL) detectadas na sua tabela original 'chargeback'
            sql = """
                INSERT INTO chargeback (
                    empresa_pagadora, 
                    codigo_motivo, 
                    motivo_informado, 
                    id_transacao_pagarme,
                    cpf_aluno,
                    nome_aluno,
                    valor, 
                    status_processo
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            cur.execute(sql, ("ChargeGuard", "FRD", chargeback.tipo, "TEST_ID_001", "000.000.000-00", "Aluno Teste", chargeback.valor, "Pendente"))
            conn.commit() # Salva as alterações
            print("✅ Dados salvos com sucesso na sua tabela original 'chargeback'!")
    except Exception as e:
        print(f"❌ Erro ao salvar: {e}")
