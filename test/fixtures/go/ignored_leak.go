package fixture

import "database/sql"

func UpdateIgnored(db *sql.DB, fail bool) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	if fail {
		// leakguard:ignore reason=known_issue
		return err
	}

	return tx.Commit()
}
