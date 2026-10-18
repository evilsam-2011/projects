import random

top_of_range = input("type a number: ")

if top_of_range.isdigit():
    top_of_range = int(top_of_range)

    if top_of_range <= 0:
        print("number should be greater than 0")
        quit()

else:
    print("please enter a number")
    quit()

random_num = random.randint(0,top_of_range)
guesses = 0

while True:
    guesses += 1 
    guess = input("guess the number: ")
    if guess.isdigit():
        guess = int(guess)
    else:
        print("please enter a number")
        continue

    if guess == random_num:
        print("you got it right")
        break
    elif guess > random_num:
        print("you were above the number")
    else:
        print("you were below the number")
     
print("you got it in", guesses, "guesses")
