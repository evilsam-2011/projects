menu = {
    "pizza": 5.00,
    "burger": 3.30,
    "salad": 4.00,
    "fries": 2.50,
    "soda": 1.00,
}

cart = []
total = 0

print("Welcome to the menu!")
print("---------------------")
for key, value in menu.items():
    print(f"{key:10}: ${value:.2f}")
print("---------------------")

while True:
    food = input("what would you like to order?").lower()
    if food == "q":
        break
