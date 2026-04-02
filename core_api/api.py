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
    """
    return {"status": "OK", "message": "ChargeGuard API está online e pronta!"}

class SyncSchema(Schema):
    api_key: str
    ambiente: str = "test"

@api.post("/sync")
def sync_pagarme(request, data: SyncSchema):
    """
    Busca chargebacks reais direto da API do Pagar.me v5.
    """
    api_key = data.api_key
    url = "https://api.pagar.me/core/v5/chargebacks"
    
    try:
        # Chamada real para o Pagar.me usando Basic Auth (sk_...)
        response = requests.get(url, auth=(api_key, ""), timeout=15)
        
        if not response.ok:
            return JsonResponse({"status": "error", "message": f"Erro Pagar.me: {response.text}"}, status=response.status_code)
        
        pagarme_data = response.json()
        chargebacks_list = pagarme_data.get('data', [])
        
        new_count = 0
        for item in chargebacks_list:
            # Verifica se já temos esse chargeback (usando transaction_id como chave de busca simplificada)
            # Idealmente usaríamos o ID do chargeback da Pagar.me se tivéssemos essa coluna no banco.
            txn_id = item.get('transaction_id')
            
            if not Chargeback.objects.filter(id_transacao_pagarme=txn_id).exists():
                # Tenta extrair dados do cliente de metadados ou da transação (se a API v5 retornar)
                # Nota: Na lista simples as vezes vem apenas o básico, adaptamos.
                
                # Criar novo registro
                Chargeback.objects.create(
                    id_transacao_pagarme=txn_id,
                    valor=float(item.get('amount', 0)) / 100,
                    motivo_informado=item.get('reason_message', 'Motivo não informado'),
                    status_processo="recebido",
                    empresa_pagadora="Pagar.me API",
                    nome_aluno="Cliente Pagar.me", # Fallback pois a lista v5 as vezes exige outro fetch p/ cliente
                    origem_arquivo="Sincronização API Pagar.me"
                )
                new_count += 1
        
        return {"status": "success", "new_cases": new_count, "total_processed": len(chargebacks_list)}

    except Exception as e:
        # IMPORTANTE: Isso vai mostrar o erro real no seu terminal do VS Code
        import traceback
        print("=== ERRO NA SINCRONIZAÇÃO PAGAR.ME ===")
        traceback.print_exc() 
        return JsonResponse({"status": "error", "message": f"Erro interno: {str(e)}"}, status=500)

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
    try:
        queryset = Chargeback.objects.all().order_by('-data_cadastro')
        
        formatted_data = []
        for cb in queryset:
            # Pega a descrição do motivo através da Foreign Key
            motivo_str = "Outros"
            if cb.codigo_motivo:
                motivo_str = cb.codigo_motivo.descricao_motivo or cb.codigo_motivo.codigo_motivo or "Outros"
            elif cb.motivo_informado:
                motivo_str = cb.motivo_informado
                
            def add_business_days(start_date, add_days):
                current_date = start_date
                while add_days > 0:
                    from datetime import timedelta
                    current_date += timedelta(days=1)
                    if current_date.weekday() < 5: 
                        add_days -= 1
                return current_date

            prazo_data = None
            if cb.data_cadastro:
                prazo_dt = add_business_days(cb.data_cadastro, 10)
                prazo_data = prazo_dt.isoformat()

            formatted_data.append({
                "id": f"CB-{cb.id_chargeback}",
                "cliente": { 
                    "nome": cb.nome_aluno or cb.empresa_pagadora or "Cliente Desconhecido", 
                    "email": "contato@empresa.com", # Campo não existe no seu models.py atualmente
                    "cpf": cb.cpf_aluno or "000.000.000-00", # Corrigido de documento_aluno para cpf_aluno
                    "telefone": "(00) 00000-0000" # Campo não existe no seu models.py
                },
                "transacao": { 
                    "id": cb.id_transacao_pagarme or "N/A", 
                    "valor": float(cb.valor or 0), 
                    "data": cb.data_cadastro.isoformat() if cb.data_cadastro else None,
                    "bandeira": "visa" # Campo não existe no seu models.py, fixamos em visa
                },
                "motivo": str(motivo_str).lower().replace(' ', '-'),
                "status": cb.status_processo.lower() if cb.status_processo else "recebido",
                "dataRecebimento": cb.data_cadastro.isoformat() if cb.data_cadastro else None,
                "prazo": prazo_data,
                "historico": [
                    {"data": cb.data_cadastro.isoformat() if cb.data_cadastro else "", "texto": "Caso registrado no sistema."}
                ]
            })
        return formatted_data
    except Exception as e:
        import traceback
        print("=== ERRO AO BUSCAR DO BANCO ===")
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
