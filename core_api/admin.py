from django.contrib import admin
from .models import Chargeback, MotivoChargeback

@admin.register(MotivoChargeback)
class MotivoAdmin(admin.ModelAdmin):
    list_display = ('codigo_motivo', 'descricao_motivo', 'tipo_chargeback')

@admin.register(Chargeback)
class ChargebackAdmin(admin.ModelAdmin):
    list_display = (
        'id_chargeback', 'empresa_pagadora', 'nome_aluno', 'valor', 
        'status_processo', 'codigo_motivo', 'data_cadastro'
    )
    list_filter = ('status_processo', 'empresa_pagadora', 'codigo_motivo')
    search_fields = ('nome_aluno', 'id_transacao_pagarme', 'cpf_aluno', 'nome_titular_cartao')
    ordering = ('-data_cadastro',)
    readonly_fields = ('data_cadastro', 'data_atualizacao')
