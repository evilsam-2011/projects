import os
from datetime import datetime
from pathlib import Path

import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ollama import Client

# Configuration for ChromaDB and Ollama
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CHROMA_PATH = str(BASE_DIR / "chroma_db")
COLLECTION_NAME = "brain_logs"
EMBEDDING_MODEL = "mxbai-embed-large:latest"
DEFAULT_FILE_PATH = str(BASE_DIR / "data" / "brain_log.txt")


def get_embedding_client():
    return Client(host="http://localhost:11434")  # Assuming Ollama runs locally


def get_chroma_collection():
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=None,  # We will handle embeddings manually with Ollama
    )
    return collection


def get_current_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_text_splitter():
    return RecursiveCharacterTextSplitter(
        chunk_size=1000, chunk_overlap=200, separators=["\n\n", "\n", ". ", " ", ""]
    )


def chunk_file(file_path=DEFAULT_FILE_PATH):
    if not os.path.exists(file_path):
        # Create the file if it doesn't exist to avoid error
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w") as f:
            f.write("")

    with open(file_path, "r") as f:
        data = f.read()

    text_splitter = get_text_splitter()
    return text_splitter.create_documents([data])


def save_entry(data):
    collection = get_chroma_collection()
    ollama_client = get_embedding_client()
    timestamp = get_current_time()

    text_splitter = get_text_splitter()
    chunks = text_splitter.create_documents([data])
    texts = [chunk.page_content for chunk in chunks]

    if not texts:
        return

    # Batch embed all chunks
    response = ollama_client.embed(model=EMBEDDING_MODEL, input=texts)
    embeddings = response.embeddings

    # Prepare data for ChromaDB batch addition
    metadatas = [
        {"timestamp": timestamp, "source": "user_input", "chunk_index": i}
        for i in range(len(chunks))
    ]
    ids = [f"log_{timestamp}_{i}" for i in range(len(chunks))]

    collection.add(
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )
    print(f"Saved {len(chunks)} chunks to ChromaDB.")


def query_knowledge_base(query_text, n_results=5):
    collection = get_chroma_collection()
    ollama_client = get_embedding_client()

    # Embed the query
    response = ollama_client.embed(model=EMBEDDING_MODEL, input=query_text)
    query_embedding = response.embeddings[0]

    # Perform semantic search
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "distances", "metadatas"],
    )

    return results
