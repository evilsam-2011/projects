from snap.processor import generate_answer
from snap.storage import query_knowledge_base


def test_rag():
    query = "How do I deploy Python on Android?"
    print(f"Query: {query}")
    results = query_knowledge_base(query)

    # Check what was retrieved
    documents = results.get("documents", [[]])[0]
    distances = results.get("distances", [[]])[0]
    print(f"Retrieved {len(documents)} documents.")
    for i, (doc, dist) in enumerate(zip(documents, distances)):
        print(f"Doc {i} (dist {dist:.4f}): {doc[:50]}...")

    answer = generate_answer(query, results)
    print(f"\nAnswer: {answer}")


if __name__ == "__main__":
    test_rag()
