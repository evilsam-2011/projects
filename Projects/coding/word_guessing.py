import random

words = ["rainbow", "linux", "sunflower", "clock", "bed"]
guessed = []
word = random.choice(words)
name = input("what is your name: ")
length = len(word)
tries = 12

print(f"Good luck {name}")

while tries != 0:
    print("guess the word")
    print("_" * len(word))
    guess = input("guess any charecter of the word: ")
    if len(guess) == 1:
        tries -= 1
        if guess in word:
            print("correct")
            guessed.append(guess)
            for letter in word:
                if letter in guessed:
                    print(letter, end=" ")
                else:
                    print("- ")
        else:
            print("wrong")
    else:
        print("you can only enter one word")
