import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chargeguard_project.settings')
django.setup()

from core_api.api import get_chargebacks

class FakeRequest:
    pass

data = get_chargebacks(FakeRequest())
print(json.dumps(data, indent=2, default=str))
