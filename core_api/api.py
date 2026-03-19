from ninja import NinjaAPI, Schema
from typing import List, Optional
from .models import Chargeback
from datetime import datetime

api = NinjaAPI(title="ChargeGuard API Ninja")

# Schemas (Pydantic models)
class ClienteSchema(Schema):
    nome: str
    email: str = "contato@empresa.com"

class TransacaoSchema(Schema):
    id: str
    valor: float
    bandeira: str = "visa"

class ChargebackOut(Schema):
    id: str
    cliente: ClienteSchema
    transacao: TransacaoSchema
    motivo: str
    status: str
    dataRecebimento: Optional[str] = None
    prazo: Optional[str] = None

@api.get("/chargebacks/", response=List[ChargebackOut])
def get_chargebacks(request):
    """
    Busca os chargebacks no banco e formata para o frontend.
    """
    queryset = Chargeback.objects.all().order_by('-data_cadastro')
    
    formatted_data = []
    for cb in queryset:
        # Pega a descrição do motivo através da Foreign Key
        motivo_str = cb.codigo_motivo.descricao_motivo if cb.codigo_motivo else (cb.motivo_informado or "Outros")
        
        formatted_data.append({
            "id": f"CB-{cb.id_chargeback}",
            "cliente": { 
                "nome": cb.nome_aluno or cb.empresa_pagadora or "Desconhecido", 
                "email": "contato@empresa.com" 
            },
            "transacao": { 
                "id": cb.id_transacao_pagarme or "N/A", 
                "valor": float(cb.valor), 
                "bandeira": "visa" 
            },
            "motivo": motivo_str,
            "status": cb.status_processo.lower() if cb.status_processo else "recebido",
            "dataRecebimento": cb.data_cadastro.isoformat() if cb.data_cadastro else None,
            "prazo": None
        })
    
    return formatted_data
