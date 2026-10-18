from storage import COLLECTION_NAME, get_chroma_collection, save_entry


def verify_system():
    print(f"--- Verifying ChromaDB Collection: {COLLECTION_NAME} ---")
    collection = get_chroma_collection()

    # 1. Check initial count
    initial_count = collection.count()
    print(f"Initial items in collection: {initial_count}")

    # 2. Save a long entry to force chunking (chunk_size=1000 in storage.py)
    long_text = (
        "This is paragraph one. It's meant to be part of a larger document. " * 20
        + "\n\n"
        + "This is paragraph two. We are adding more text to ensure we cross the 1000 character limit for chunking. "
        * 20
    )
    print(f"\nSaving a long entry (approx {len(long_text)} characters)...")
    save_entry(long_text)

    # 3. Check new count
    new_count = collection.count()
    print(f"New items in collection: {new_count}")
    print(f"Chunks added: {new_count - initial_count}")

    # 4. Peek at the data
    print("\n--- Querying last 2 added chunks ---")
    results = collection.get(limit=2, include=["documents", "metadatas", "embeddings"])

    for i in range(len(results["ids"])):
        print(f"\nID: {results['ids'][i]}")
        print(f"Metadata: {results['metadatas'][i]}")
        doc_snippet = results["documents"][i][:100] + "..."
        print(f"Document Snippet: {doc_snippet}")

        embedding = results["embeddings"][i]
        print(f"Embedding dimensions: {len(embedding)}")
        print(f"Embedding preview (first 5): {embedding[:5]}")


if __name__ == "__main__":
    verify_system()
