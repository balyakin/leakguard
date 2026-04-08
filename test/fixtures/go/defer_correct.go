package fixture

import "database/sql"

func UpdateUserSafe(db *sql.DB, fail bool) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	defer tx.Rollback()

	if fail {
		return err
	}

	return tx.Commit()
}
