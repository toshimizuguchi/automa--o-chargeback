import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chargeguard_project.settings')
django.setup()

from django.contrib.auth.models import User
from django.contrib.admin.sites import site
from django.test import RequestFactory
from core_api.models import Chargeback

try:
    rf = RequestFactory()
    request = rf.get('/admin/core_api/chargeback/add/')
    
    # Create a mock superuser
    user = User(username='admin', is_staff=True, is_active=True, is_superuser=True)
    request.user = user
    
    admin_instance = site._registry[Chargeback]
    
    # This usually triggers the form generation and any related queries
    form_class = admin_instance.get_form(request)
    form = form_class()
    
    print("Form generated successfully.")
    
    # Try to render it
    rendered = form.as_p()
    print("Form rendered successfully.")
    
except Exception:
    traceback.print_exc()
