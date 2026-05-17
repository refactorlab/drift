use sqlx::PgPool;

// SQLX-RAW-001: format!-built SQL passed to sqlx::query.
pub async fn lookup_unsafe(pool: &PgPool, name: &str) -> Result<(), sqlx::Error> {
    let q = sqlx::query(&format!("SELECT * FROM users WHERE name = '{}'", name));
    q.execute(pool).await?;
    Ok(())
}

// SQLX-N1-002: sqlx::query! macro inside a for-loop.
pub async fn n_plus_one(pool: &PgPool, ids: Vec<i64>) -> Result<(), sqlx::Error> {
    for id in ids {
        let _ = sqlx::query!("SELECT * FROM users WHERE id = $1", id)
            .fetch_one(pool)
            .await?;
    }
    Ok(())
}

// Negative: a single bulk query using ANY($1).
pub async fn clean_bulk(pool: &PgPool, ids: &[i64]) -> Result<(), sqlx::Error> {
    let _ = sqlx::query!("SELECT * FROM users WHERE id = ANY($1) LIMIT 100", ids)
        .fetch_all(pool)
        .await?;
    Ok(())
}
