foods = []
prices = []
total = 0

while True:
    food = input("Add a food item to the cart (q to quit): ")
    if food.lower() == "q":
        break
    else:
        price = float(input(f"Enter the price of a {food}: $"))
        foods.append(food)
        prices.append(price)


print("----- Your Cart -----")

for food in foods:
    print(food)

for price in prices:
    total += price

print("-----Total-----")
print(f"you total is ${total}")
