package main

import "database/sql"

func handler(db *sql.DB, fail bool) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	if fail {
		return err
	}
	return tx.Commit()
}
