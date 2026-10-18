import random

user_score = 0
computer_score = 0

options = [
    "stone",
    "paper",
    "scissors",
]

while True:
    users_choice = input(
        "what will you choose stone/paper/scissors or q to quit: "
    ).lower()
    if users_choice == "q":
        break

    if users_choice not in options:
        continue

    random_num = random.randint(0, 2)

    computer_choice = options[random_num]
    print("computer picked", computer_choice + ".")

    if (
        users_choice == "stone"
        and computer_choice == "scissors"
        or users_choice == "paper"
        and computer_choice == "stone"
        or users_choice == "scissors"
        and computer_choice == "paper"
    ):
        print("you win")
        user_score += 1
    elif users_choice == computer_choice:
        print("tie")
    else:
        print("you loose")
        computer_score += 1

print("you won", user_score, "times")
print("computer wins", computer_score, "times")
