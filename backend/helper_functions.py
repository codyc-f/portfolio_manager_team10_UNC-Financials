def get_required_fields(db, database_name, table_name):
    """Return columns that must be provided when inserting into a table."""
    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s
          AND TABLE_NAME = %s
          AND IS_NULLABLE = 'NO'
          AND COLUMN_DEFAULT IS NULL
          AND EXTRA NOT LIKE '%%auto_increment%%'
          AND EXTRA NOT LIKE '%%DEFAULT_GENERATED%%'
    """

    cursor.execute(sql, (database_name, table_name))
    fields = {row["COLUMN_NAME"] for row in cursor.fetchall()}
    cursor.close()

    return fields
