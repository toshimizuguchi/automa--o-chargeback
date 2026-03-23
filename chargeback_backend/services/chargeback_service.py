from repositories.chargeback_repository import salvar

def processar_chargeback(chargeback):
    """
    Coordena o processamento de um chargeback recebido.
    Verifica a prioridade do caso e aciona o repositório para persistência.
    """
    if chargeback.tipo == "fraude" and chargeback.valor > 1000:
        print("Chargeback com alta prioridade")
    else:
        print("Chargeback com análise normal")
    salvar(chargeback)

