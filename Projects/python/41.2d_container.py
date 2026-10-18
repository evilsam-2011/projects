fruits = ["apple", "banana", "cherry"]
vegetables = ["carrot", "broccoli", "spinach"]
meats = ["beef", "chicken", "pork"]

groceries = [fruits, vegetables, meats]

# print(groceries[0][0])

for container in groceries:
    for foods in container:
        print(foods, end=" ")
    print()
