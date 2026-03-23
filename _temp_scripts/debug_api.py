import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chargeguard_project.settings')
django.setup()

from core_api.api import api
from django.test import RequestFactory

try:
    rf = RequestFactory()
    request = rf.get('/api/chargebacks/')
    status, response = api.handle_request(request)
    print(f"Status: {status}")
    print(f"Response: {response}")
except Exception as e:
    import traceback
    traceback.print_exc()
