from processor import generate_answer
from storage import query_knowledge_base, save_entry


def main():
    print("\n--- Snap Knowledge Base ---")
    print("1. Save a new entry")
    print("2. Ask a question")
    choice = input("\nChoose an option (1/2): ").strip()

    if choice == "1":
        user_input = input("\nWhat's on your mind? ")
        save_entry(user_input)
        print("Entry saved to ChromaDB!")
    elif choice == "2":
        query = input("\nAsk your question: ")
        print(f"Searching for: '{query}'...")

        # 1. Semantic Search
        results = query_knowledge_base(query)

        # 2. Generate Answer using LLM
        print("Generating answer...")
        answer = generate_answer(query, results)

        print("\n--- ANSWER ---")
        print(answer)
        print("\n--- SOURCES (Ranked by Semantic Relevance) ---")
        documents = results.get("documents", [[]])[0]
        distances = results.get("distances", [[]])[0]
        for i, (doc, dist) in enumerate(zip(documents, distances)):
            # Lower distance means more similar
            relevance = max(0, 100 - (dist * 50))
            print(f"{i + 1}. [Relevance: {relevance:.1f}%] {doc[:100]}...")
    else:
        print("Invalid choice.")


if __name__ == "__main__":
    main()
