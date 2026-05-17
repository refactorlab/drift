from django.urls import path
from . import views

urlpatterns = [
    path("users/", views.show_users),
    path("create/", views.create_users),
    path("count/", views.count_for_exists),
    path("len/", views.len_check),
    path("raw/<str:who>/", views.raw_with_fstring),
    path("clean/", views.clean_handler),
]
