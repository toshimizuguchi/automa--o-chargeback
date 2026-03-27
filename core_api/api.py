import os
from ninja import NinjaAPI, Schema
from ninja.security import APIKeyHeader
from typing import List, Optional
from .models import Chargeback

class ApiKeyAuth(APIKeyHeader):
    param_name = "X-API-Key"

    def authenticate(self, request, key):
        # SEGURANÇA: Chave definida no .env ou nas Configs do Vercel.
        # Caso não exista, usa o padrão abaixo.
        API_TOKEN = (os.getenv("CHARGEGUARD_API_TOKEN") or "super-secret-default-token").strip()
        
        # Limpa espaços e valida (Proteção contra tokens 'undefined' ou vazios)
        if key and key.strip() != "" and key.strip() == API_TOKEN:
            return key
        return None

api = NinjaAPI(title="ChargeGuard API Ninja", auth=ApiKeyAuth())

@api.get("/ping", auth=None)
def ping(request):
    """
    Endpoint simples para testar se a API está online sem precisar de senha.
    Acesse: https://[seu-dominio]/api/ping
    """
    return {"status": "OK", "message": "ChargeGuard API está online e pronta!"}

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
        # Segurança: Garante que motivo_str nunca seja None para não quebrar o Schema
        motivo_str = "Outros"
        if cb.codigo_motivo:
            motivo_str = cb.codigo_motivo.descricao_motivo or cb.codigo_motivo.codigo_motivo or "Outros"
        elif cb.motivo_informado:
            motivo_str = cb.motivo_informado
            
        formatted_data.append({
            "id": f"CB-{cb.id_chargeback}",
            "cliente": { 
                "nome": cb.nome_aluno or cb.empresa_pagadora or "Desconhecido", 
                "email": "contato@empresa.com" 
            },
            "transacao": { 
                "id": cb.id_transacao_pagarme or "N/A", 
                "valor": float(cb.valor or 0), 
                "bandeira": "visa" 
            },
            "motivo": str(motivo_str),
            "status": cb.status_processo.lower() if cb.status_processo else "recebido",
            "dataRecebimento": cb.data_cadastro.isoformat() if cb.data_cadastro else None,
            "prazo": None
        })
    
    return formatted_data
