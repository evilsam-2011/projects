from storage import chunk_file, save_entry


def test_system():
    # 1. Save a few notes to make sure the separation works
    save_entry("I need to learn how to deploy Python on Android.")
    save_entry("Remember to buy milk on the way home.")

    # 2. Now, test the Librarian's chunking ability
    print("Reading and chunking brain_log...")
    chunks = chunk_file()

    print(f"Successfully created {len(chunks)} chunks!\n")

    # 3. Print each chunk to see how the AI will "see" your notes
    for i, chunk in enumerate(chunks):
        print(f"--- Chunk {i + 1} ---")
        print(chunk.page_content)
        print("-" * 20)


if __name__ == "__main__":
    test_system()
