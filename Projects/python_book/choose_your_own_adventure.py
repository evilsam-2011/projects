name = input("what is your name: ")
print(f"welcome {name} to this adventure.")

answer = input(
    "you have came to end of the road would you like to go to the right path or to the left path?: "
).lower()

if answer == "right":
    answer = input(
        "thier is a river infront of you would you like to walk around it or would you like to swim across: "
    ).lower()
    if answer == "swim":
        print("there was a alligator inside the river you loose")
    elif answer == "walk":
        print("you walked a lot and died out of tiredness you loose")
    else:
        print("not a valid option")
elif answer == "left":
    answer = input(
        "there is a bridge infront of you would you like to cross it or go back"
    ).lower()
    if answer == "back":
        print("you go back and loose")
    elif answer == "cross":
        print("you cross the bridge safely")
        answer = input(
            "you see a staranger there would you like to meet him or ignore him"
        ).lower()
        if answer == "meet":
            print("he gave you gold you win")
        elif answer == "ignore":
            print("you ignore him you loose")
        else:
            print("not a valid option")

    else:
        print("not a valid option")
else:
    print("not a valid option")

print("thank you for playing")
