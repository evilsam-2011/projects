from ollama import Client

LLM_MODEL = "qwen:0.5b"


def get_llm_client():
    return Client(host="http://localhost:11434")


def generate_answer(query, search_results):
    client = get_llm_client()

    # Extract documents and distances
    documents = search_results.get("documents", [[]])[0]
    distances = search_results.get("distances", [[]])[0]

    # Filter out poor matches
    valid_docs = []
    for doc, dist in zip(documents, distances):
        # Tightened threshold for mxbai-embed-large
        if dist < 0.6:
            valid_docs.append(doc)

    if not valid_docs:
        return "I don't know."

    # Use a very structured format that small models can't easily ignore
    context_block = "\n".join([f"- {doc}" for doc in valid_docs])

    prompt = f"""<|im_start|>system
You are a helpful assistant. Use ONLY the provided context to answer the question. If the answer is not in the context, say "I don't know". Do not use external knowledge.<|im_end|>
<|im_start|>user
Context:
{context_block}

Question: {query}<|im_end|>
<|im_start|>assistant
"""

    # print(f"DEBUG PROMPT:\n{prompt}\n")

    response = client.generate(
        model=LLM_MODEL,
        prompt=prompt,
        options={
            "temperature": 0,
            "num_predict": 50,
            "stop": ["<|im_start|>", "<|im_end|>"],
        },
    )

    answer = response.response.strip()

    # Simple semantic verification for small models:
    # If the answer contains words not in the query or the context,
    # and it's not a common connector word, it might be a hallucination.
    # However, for now, we rely on the aggressive prompt.
    return answer
