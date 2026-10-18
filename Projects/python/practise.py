questions = (
    "what is capital of india: ",
    "who is pm of india: ",
    "where is mumbai located: ",
    "what is the best codeing language",
)

options = (
    ("A.Mumbai B.Delhi C.Pune D.Latur"),
    ("A.Ambani B.Adani C.Elon musk D.Modi"),
    ("A.Maharashtra B.Karnataka C.Jambu & kashmir D.Gujrat"),
    ("A.Rust B.c++ C.Python D.java"),
)

answers = ("B", "D", "A", "C")
guesses = []
score = 0
question_num = 0

for question in questions:
    print(question)
    for option in options[question_num]:
        print(option)
