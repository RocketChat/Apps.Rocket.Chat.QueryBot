import {
    IHttp,
    IRead,
    IEnvironmentRead,
    IAppAccessors,
} from "@rocket.chat/apps-engine/definition/accessors";

export class LlmService {
    private readonly endpoints = {
        "llama3-70b": "http://llama3-70b/v1",
        "mistral-7b": "http://mistral-7b/v1",
    };
    private vectorDbEndpoint: string;
    private embeddingEndpoint: string =
        "http://text-embedding-api:8020/embed_multiple";

    constructor(private readonly accessors: IAppAccessors) {
        this.vectorDbEndpoint = "";
        this.initializeSettings();
    }

    private async initializeSettings() {
        this.vectorDbEndpoint =
            ((await this.accessors.environmentReader
                .getSettings()
                .getValueById("vector_db_endpoint")) as string) || "";
    }

    public async queryLLM(
        model: string,
        prompt: string,
        userId: string
    ): Promise<string> {
        const endpoint = this.endpoints[model];
        if (!endpoint) {
            throw new Error(`Unknown model: ${model}`);
        }

        console.log(`Using LLM endpoint: ${endpoint}`);

        const headers = {
            "Content-Type": "application/json",
        };

        const payload = {
            messages: [{ role: "user", content: prompt, user: userId }],
            model,
        };

        try {
            const response = await this.accessors.http.post(
                endpoint + "/chat/completions",
                {
                    headers,
                    data: payload,
                }
            );

            if (response.statusCode !== 200 || !response.data) {
                throw new Error("Failed to fetch response from LLM");
            }

            return response.data.choices[0].message.content.trim();
        } catch (error) {
            throw new Error(`LLM request failed: ${error.message}`);
        }
    }

    public async createEmbedding(text: string): Promise<number[]> {
        const headers = {
            accept: "application/json",
            "Content-Type": "application/json",
        };

        const data = JSON.stringify([text]);

        try {
            const response = await this.accessors.http.post(
                this.embeddingEndpoint,
                {
                    headers,
                    data,
                }
            );

            if (response.statusCode !== 200 || !response.data) {
                throw new Error("Failed to fetch embedding");
            }

            return response.data.embeddings[0];
        } catch (error) {
            throw new Error(`Embedding request failed: ${error.message}`);
        }
    }

    public async storeMessageEmbedding(
        messageId: string,
        embedding: number[]
    ): Promise<void> {
        const url = `${this.vectorDbEndpoint}/v1/graphql`;
        const content = {
            query: `
                mutation {
                    CreateRocketChatDoc(
                        input: {
                            content: "${messageId}",
                            vector: ${JSON.stringify(embedding)}
                        }
                    ) {
                        id
                    }
                }
            `,
        };

        await this.accessors.http.post(url, {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(content),
        });
    }

    public async queryVectorDB(embedding: number[]): Promise<string[]> {
        const url = `${this.vectorDbEndpoint}/v1/graphql`;
        const content = {
            query: `{
                Get {
                    RocketChatDocs(
                        nearVector: {
                            vector: ${JSON.stringify(embedding)},
                            distance: 0.6
                        }
                        limit: 5
                    ) {
                        content
                        _additional {
                            certainty
                            distance
                        }
                    }
                }
            }`,
        };

        const response = await this.accessors.http.post(url, {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(content),
        });

        if (response.statusCode !== 200 || !response.data) {
            throw new Error("Failed to fetch results from vector DB");
        }

        return response.data.data.Get.RocketChatDocs.map(
            (result: any) => result.content
        );
    }

    public async getMessageById(
        messageId: string,
        read: IRead
    ): Promise<string> {
        const message = await read.getMessageReader().getById(messageId);
        if (!message || !message.text) {
            throw new Error(
                `Failed to fetch message text with ID ${messageId}`
            );
        }
        return message.text;
    }
}

export default LlmService;
