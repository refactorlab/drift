# laravel/laravel #6536 — [11.x] remove `APP_TIMEZONE` environment variable

**[View PR on GitHub](https://github.com/laravel/laravel/pull/6536)**

| | |
|---|---|
| **Author** | @browner12 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @a-h-abid
> Funny, it was added after long request by various users, now its revert back to old way.

### @GrahamCampbell
> People can just edit their own config file to their preference, and pull things from env variables if they want.

### @ItsRD
> When Laravel 11 was released, did newly installed Laravel application have the `config/app.php` file installed? I thought they didn't.

### @wjvankesteren
> Other settings remains in the .env file, e.g. the database connection, which could have a specific timezone set...It will be strange at that point to have to change code for that.

### @browner12
> some things **should not** be overwritten at the environment level.

### @Anticom
> Does not make any sense at all. If your local dev environment is using another timezone throughout all data stored in local DB...I see hardly any scenario where you would end up with something that would work in your local environment but break in production.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
