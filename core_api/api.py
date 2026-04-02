from django.contrib.auth import authenticate, login, logout
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

class LoginSchema(Schema):
    username: str
    password: str

@api.post("/login")
def auth_login(request, data: LoginSchema):
    """
    Realiza o login interno.
    """
    user = authenticate(username=data.username, password=data.password)
    if user:
        login(request, user)
        return {"status": "success", "user": user.username}
    return JsonResponse({"status": "error", "message": "Credenciais inválidas"}, status=401)

@api.get("/check-auth")
def check_auth(request):
    """
    Verifica se o usuário já possui uma sessão ativa.
    """
    if request.user.is_authenticated:
        return {"authenticated": True, "user": request.user.username}
    return {"authenticated": False}

@api.post("/logout")
def auth_logout(request):
    """
    Encerra a sessão.
    """
    logout(request)
    return {"status": "success"}

class UpdateStatusSchema(Schema):
    status: str

@api.patch("/chargebacks/{cb_id}")
def update_chargeback_status(request, cb_id: str, data: UpdateStatusSchema):
    """
    Atualiza o status de um chargeback no banco de dados.
    """
    # Remove prefixo 'CB-' se vier do frontend
    numeric_id = cb_id.replace('CB-', '')
    try:
        cb = Chargeback.objects.get(id_chargeback=numeric_id)
        cb.status_processo = data.status
        cb.save()
        return {"status": "success", "new_status": cb.status_processo}
    except Chargeback.DoesNotExist:
        return JsonResponse({"error": "Chargeback não encontrado"}, status=404)

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
            
        # Função interna para calcular 10 dias úteis (Seg-Sex)
        def add_business_days(start_date, add_days):
            current_date = start_date
            while add_days > 0:
                current_date += timedelta(days=1)
                if current_date.weekday() < 5: # 0-4 são Seg-Sex
                    add_days -= 1
            return current_date

        # Calcula prazo (10 dias úteis após data_cadastro/recebimento)
        prazo_data = None
        if cb.data_cadastro:
            from datetime import timedelta
            prazo_dt = add_business_days(cb.data_cadastro, 10)
            prazo_data = prazo_dt.isoformat()

        formatted_data.append({
            "id": f"CB-{cb.id_chargeback}",
            "cliente": { 
                "nome": cb.nome_aluno or cb.empresa_pagadora or "Desconhecido", 
                "email": cb.email_aluno or "contato@empresa.com",
                "cpf": cb.documento_aluno or "000.000.000-00",
                "telefone": cb.telefone_aluno or "(11) 99999-9999"
            },
            "transacao": { 
                "id": cb.id_transacao_pagarme or "N/A", 
                "valor": float(cb.valor or 0), 
                "data": cb.data_cadastro.isoformat() if cb.data_cadastro else None,
                "bandeira": cb.bandeira_cartao.lower() if cb.bandeira_cartao else "visa" 
            },
            "motivo": str(motivo_str).lower().replace(' ', '-'), # Normaliza para o frontend
            "status": cb.status_processo.lower() if cb.status_processo else "recebido",
            "dataRecebimento": cb.data_cadastro.isoformat() if cb.data_cadastro else None,
            "prazo": prazo_data,
            "historico": [
                {"data": cb.data_cadastro.isoformat() if cb.data_cadastro else "", "texto": "Caso registrado no sistema via importação/sincronização."}
            ]
        })
    
    return formatted_data
