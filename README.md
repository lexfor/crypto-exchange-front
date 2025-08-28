# Using local AI pr reviewer
This repository contains a simple implementation of a local AI-powered code reviewer using ollama and qwen2.5-coder:14b.
It leverages the capabilities of large language models to analyze code changes and provide feedback on pull requests.

## How to set up Local AI PR Reviewer
1. Install ollama from [https://ollama.com/download](https://ollama.com/download)
2. Install the qwen2.5-coder:14b model by running the following command:
   ```bash
   ollama pull qwen2.5-coder:14b
   ```
3. Verify the installation by running:
   ```bash
   ollama list
   ```
   You should see `qwen2.5-coder:14b` in the list of available models.
## Usage
1. Make file with embeddings of project files
   ```bash
   npm run ai:index 
   ```
2. Run the local AI PR reviewer
   ```bash
    npm run ai:review
    ```
