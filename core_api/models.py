from django.db import models

class MotivoChargeback(models.Model):
    codigo_motivo = models.CharField(primary_key=True, max_length=50)
    descricao_motivo = models.CharField(max_length=255, null=True, blank=True)
    tipo_chargeback = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'motivo_chargeback'
        managed = False

    def __str__(self):
        return f"{self.codigo_motivo} - {self.descricao_motivo}"

class Chargeback(models.Model):
    id_chargeback = models.AutoField(primary_key=True)
    empresa_pagadora = models.CharField(max_length=255, null=True, blank=True)
    # Vinculando ao modelo de Motivos
    codigo_motivo = models.ForeignKey(
        MotivoChargeback, 
        on_delete=models.PROTECT, 
        db_column='codigo_motivo',
        to_field='codigo_motivo',
        null=True, 
        blank=True
    )
    motivo_informado = models.CharField(max_length=255, null=True, blank=True)
    id_transacao_pagarme = models.CharField(max_length=255, null=True, blank=True)
    cpf_aluno = models.CharField(max_length=20, null=True, blank=True)
    nome_aluno = models.CharField(max_length=255, null=True, blank=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    status_processo = models.CharField(max_length=50, default="Pendente")
    data_cadastro = models.DateTimeField(auto_now_add=True)

    # Campos adicionais encontrados no banco
    nome_titular_cartao = models.CharField(max_length=255, null=True, blank=True)
    origem_arquivo = models.CharField(max_length=255, null=True, blank=True)
    linha_origem = models.IntegerField(null=True, blank=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chargeback'
        managed = False

    def __str__(self):
        return f"Case {self.id_chargeback} - {self.nome_aluno}"
