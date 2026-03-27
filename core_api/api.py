from django.http import JsonResponse
import requests
from ninja import NinjaAPI, Schema
from typing import List, Optional
from .models import Chargeback

api = NinjaAPI(title="ChargeGuard API Ninja")

@api.get("/ping")
def ping(request):
    """
    Endpoint simples para testar se a API está online sem precisar de senha.
    Acesse: https://[seu-dominio]/api/ping
    """
    return {"status": "OK", "message": "ChargeGuard API está online e pronta!"}

@api.get("/cnpj/{cnpj}")
def get_cnpj_info(request, cnpj: str):
    """
    Proxy para consulta de CNPJ via BrasilAPI (evita erro de CORS no frontend).
    """
    url = f"https://brasilapi.com.br/api/cnpj/v1/{cnpj}"
    try:
        response = requests.get(url, timeout=10)
        # Retorna o JSON da BrasilAPI com o mesmo status code original (ex: 404 se não achar)
        return JsonResponse(response.json(), status=response.status_code, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# Schemas (Pydantic models)
class ClienteSchema(Schema):
    nome: str
    email: str = "contato@empresa.com"

class TransacaoSchema(Schema):
    id: str
    valor: float
    data: Optional[str] = None
    bandeira: str = "visa"

class HistoricoSchema(Schema):
    data: str
    texto: str

class ChargebackOut(Schema):
    id: str
    cliente: ClienteSchema
    transacao: TransacaoSchema
    motivo: str
    status: str
    dataRecebimento: Optional[str] = None
    prazo: Optional[str] = None
    historico: List[HistoricoSchema] = []

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
                "data": cb.data_cadastro.isoformat() if cb.data_cadastro else None,
                "bandeira": "visa" 
            },
            "motivo": str(motivo_str),
            "status": cb.status_processo.lower() if cb.status_processo else "recebido",
            "dataRecebimento": cb.data_cadastro.isoformat() if cb.data_cadastro else None,
            "prazo": None,
            "historico": [
                {"data": cb.data_cadastro.isoformat() if cb.data_cadastro else "", "texto": "Caso registrado no banco de dados."}
            ]
        })
    
    return formatted_data
