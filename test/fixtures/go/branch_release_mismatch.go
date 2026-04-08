package fixture

import "database/sql"

func UpdateBranchRelease(db *sql.DB, fail bool) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	if fail {
		return err
	} else {
		tx.Rollback()
	}

	return tx.Commit()
}
