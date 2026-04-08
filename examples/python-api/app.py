def process(path, fail):
    file_obj = open(path, "r")
    if fail:
        return None
    data = file_obj.read()
    file_obj.close()
    return data
