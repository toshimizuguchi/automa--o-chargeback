from django.contrib import admin
from .models import Chargeback

@admin.register(Chargeback)
class ChargebackAdmin(admin.ModelAdmin):
    list_display = ('id_chargeback', 'nome_aluno', 'valor', 'status_processo', 'data_cadastro')
    list_filter = ('status_processo', 'data_cadastro')
    search_fields = ('nome_aluno', 'id_transacao_pagarme', 'cpf_aluno')
    ordering = ('-data_cadastro',)
