capitals = {
    "France": "Paris",
    "Germany": "Berlin",
    "Spain": "Madrid",
    "Italy": "Rome",
    "United Kingdom": "London",
}

# print(capitals.get("Spain"))  # get the value of a key
capitals.update({"India": "New Delhi"})  # update the value of key
# capitals.update({"France": "new york"})  # change the value of key
# capitals.pop("France")  # remove the key
# capitals.popitem()  # remove the last key-value pair
# capitals.clear()  # remove all key-value pairs

keys = capitals.keys()  # get all keys
values = capitals.values()  # get all values
items = capitals.items()  # get all key-value pairs

# for key, value in items:
#     print(f"{key}: {value}")
