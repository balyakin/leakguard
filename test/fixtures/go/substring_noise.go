package fixture

import "os"

func ReadWithSubstringNoise(path string, fail bool) error {
	r, err := os.Open(path)
	if err != nil {
		return err
	}

	other.Close()

	if fail {
		return err
	}

	return nil
}
