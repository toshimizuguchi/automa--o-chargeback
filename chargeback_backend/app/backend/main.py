from models.Chargeback import Chargeback
from services.chargeback_service import processar_chargeback


#iniciando sistema
def iniciar():
    print("Iniciando sistema...")
    cb = Chargeback("fraude", 1500)
    processar_chargeback(cb)

if __name__ == "__main__":
    iniciar()