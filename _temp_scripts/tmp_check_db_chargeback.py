import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chargeguard_project.settings')
django.setup()

with connection.cursor() as cursor:
    cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chargeback'")
    columns = cursor.fetchall()
    print("CHARGEBACK_COLUMNS:", columns)

    cursor.execute("SELECT * FROM chargeback LIMIT 1")
    rows = cursor.fetchall()
    print("CHARGEBACK_ROWS:", rows)
