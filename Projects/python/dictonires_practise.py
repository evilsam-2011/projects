capitals = {}

while True:
    input_country = input("Enter a country: ")
    input_capital = input("Enter a capital or q to quit: ")
    if input_capital == "q":
        break
    capitals.update({input_country: input_capital})

print(capitals)
