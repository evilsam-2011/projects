item = input("what would you like to buy: ")
price = float(input("how much would you like to pay: "))
quantity = int(input("how much would you like to buy: "))

total = price * quantity
print(f"you have bought {quantity} x {item}/s for {total}")
