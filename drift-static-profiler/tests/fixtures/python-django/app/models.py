from django.db import models


class Group(models.Model):
    name = models.CharField(max_length=120)


class User(models.Model):
    name = models.CharField(max_length=120)
    email = models.CharField(max_length=200, unique=True)
    active = models.BooleanField(default=True)
    # m2m used by views.cartesian_values to exercise DJ-PROJ-010
    groups = models.ManyToManyField(Group, related_name="users")


class Post(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
    title = models.CharField(max_length=200)
    body = models.TextField()
