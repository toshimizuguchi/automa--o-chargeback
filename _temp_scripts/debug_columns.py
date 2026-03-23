import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chargeguard_project.settings')
django.setup()

with connection.cursor() as cursor:
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'chargeback'")
    print("Columns:", [row[0] for row in cursor.fetchall()])
