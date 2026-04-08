def read_data(path, fail):
    handle = open(path, "r")
    if fail:
        return None
    payload = handle.read()
    handle.close()
    return payload
