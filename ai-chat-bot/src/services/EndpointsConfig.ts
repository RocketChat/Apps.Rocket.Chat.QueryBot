const endpoints = {
    "llama3-70b": "http://llama3-70b/v1",
    "mistral-7b": "http://mistral-7b/v1",
};

export function getEndpoint(model: string): string {
    const endpoint = endpoints[model];
    if (!endpoint) {
        throw new Error(`Unknown model: ${model}`);
    }
    return endpoint;
}
