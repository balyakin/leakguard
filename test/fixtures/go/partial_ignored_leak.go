package fixture

import "database/sql"

func UpdatePartiallyIgnored(db *sql.DB, first bool, second bool) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	if first {
		// leakguard:ignore reason=known_issue
		return err
	}

	if second {
		return err
	}

	return tx.Commit()
}
