import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chargeguard_project.settings')
django.setup()

from core_api.api import get_chargebacks
from django.test import RequestFactory

try:
    rf = RequestFactory()
    request = rf.get('/api/chargebacks/')
    # Ninja handles the response wrapping, but let's see if the logic works.
    result = get_chargebacks(request)
    print("API Result:", result)
except Exception as e:
    import traceback
    traceback.print_exc()
