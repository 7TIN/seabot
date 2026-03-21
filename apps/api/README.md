# SeaBot API

The core backend service for SeaBot, providing a high-performance RAG (Retrieval-Augmented Generation) pipeline for documentation search and AI chat.

## Tech Stack

* **Runtime:** [Bun](https://bun.sh/)
* **Crawler:** [Crawlee](https://crawlee.dev/) for automated documentation ingestion.
* **Search Engine:** [Typesense](https://typesense.org/) for lightning-fast keyword and typo-tolerant search.
* **Vector Database:** [Qdrant](https://qdrant.tech/) for high-dimensional vector similarity search.
* **Embeddings:** Qwen2-7B-Instruct (via Hugging Face) for both document indexing and query vectorization.
* **LLM:** Gemini 2.5 Flash for context-aware response generation and reasoning.
* **Caching:** [Redis](https://redis.io/) for session management and response caching.
* **Reranking:** Cross-encoder based reranking to ensure the most relevant context is fed to the LLM.

## Project Structure

```text
apps/api/
├── src/
│   ├── modules/
│   │   ├── indexing/      # Crawler and document processing
│   │   ├── embeddings/    # Hugging Face Qwen integration
│   │   ├── qdrant/        # Vector DB operations
│   │   ├── search/        # Typesense keyword search
│   │   ├── rag/           # LLM (Gemini) and RAG logic
│   │   └── cache/         # Redis implementation
│   └── index.ts           # API entry point
├── scripts/               # Maintenance and utility scripts
└── package.json           # Dependencies and scripts
```

## 🛠 Getting Started

### Prerequisites
* Bun installed
* Running instances of Redis, Qdrant, and Typesense

### Installation
```bash
# From the root or apps/api directory
bun install
```

### Environment Setup
Create a `.env` file in this directory based on `.env.example`:
```env
TYPESENSE_API_KEY=your_key
QDRANT_URL=your_url
HUGGINGFACE_TOKEN=your_token
GEMINI_API_KEY=your_key
REDIS_URL=redis://localhost:6379
```

### Available Scripts
* `bun run dev`: Starts the API in development mode with hot reloading.
* `bun run start:crawler`: Initiates the Crawlee-based documentation ingestion.
* `bun run export-dataset`: Utility to export processed data.

## RAG Pipeline Workflow
1.  **Ingestion:** Crawlee scrapes documentation and splits it into chunks.
2.  **Embedding:** Chunks are vectorized using the Qwen model.
3.  **Storage:** Metadata is stored in Typesense; vectors are stored in Qdrant.
4.  **Retrieval:** Hybrid search (Typesense + Qdrant) retrieves potential candidates.
5.  **Reranking:** Results are re-ordered for maximum relevance.
6.  **Generation:** Gemini 2.5 Flash generates the final answer using the reranked context.