package fixture

import "database/sql"

func TestLeakyCase(db *sql.DB, fail bool) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	if fail {
		return err
	}

	return tx.Commit()
}
