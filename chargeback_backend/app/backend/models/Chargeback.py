class Chargeback:
    """
    Representação de um caso de chargeback no sistema.
    Possui atributos básicos como tipo e valor para processamento inicial.
    """
    def __init__(self, tipo, valor):
        self.tipo = tipo
        self.valor = valor
    