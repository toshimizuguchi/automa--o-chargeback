from django.db import models

class Chargeback(models.Model):
    """
    Modelo de dados para Chargebacks, sincronizado com a tabela do Supabase.
    """
    id_chargeback = models.AutoField(primary_key=True)
    empresa_pagadora = models.CharField(max_length=255, null=True, blank=True)
    codigo_motivo = models.CharField(max_length=50, null=True, blank=True)
    motivo_informado = models.CharField(max_length=255, null=True, blank=True)
    id_transacao_pagarme = models.CharField(max_length=255, null=True, blank=True)
    cpf_aluno = models.CharField(max_length=20, null=True, blank=True)
    nome_aluno = models.CharField(max_length=255, null=True, blank=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    status_processo = models.CharField(max_length=50, default="Pendente")
    data_cadastro = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chargeback' # Nome exato da tabela no Supabase
        managed = False        # Django não deve tentar criar essa tabela (já existe)

    def __str__(self):
        return f"{self.id_chargeback} - {self.nome_aluno} (R$ {self.valor})"
